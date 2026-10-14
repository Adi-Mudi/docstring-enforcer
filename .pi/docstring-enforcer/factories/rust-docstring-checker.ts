/**
 * Rust docstring checker.
 *
 * Mirrors rustc's `missing_docs` lint (Level A): every publicly reachable item
 * must carry a doc comment.
 *
 * Rule set verified against rustc 1.99.0 (--edition 2021, #![deny(missing_docs)])
 * see .IDE_Plans/rust_docstring_research_20261014.md for the probe results.
 *
 * Accepted doc forms: `///`, `/** ... *\/`, `#[doc = "..."]`.
 * Honoured escape hatches: `#[doc(hidden)]`, `#[allow(missing_docs)]`.
 *
 * Known limitation: a field or variant written on the same line as its opening
 * brace (`pub struct S { pub f: u8 }`) is not checked. rustfmt never emits that
 * shape. A declaration whose `pub` and its keyword sit on different lines is
 * also not detected.
 */

import type { CheckResult, DocstringChecker, MissingDocstring } from "./index.ts";

/** How an item was declared. */
type Vis = "public" | "restricted" | "private";

/** A brace-delimited region the scan is currently inside. */
type RegionKind = "module" | "struct" | "enum" | "trait" | "union" | "impl" | "fn" | "block";

interface Region {
  kind: RegionKind;
  /** Brace depth of the body, i.e. the depth reached after the opening brace. */
  openDepth: number;
  /** Items declared directly inside are externally reachable. */
  reachable: boolean;
  /** `#[doc(hidden)]` or `#[allow(missing_docs)]` on this region silences every child. */
  skip: boolean;
}

interface ItemHit {
  kind: MissingDocstring["kind"];
  name: string;
  vis: Vis;
  /** Region to push when the item opens a brace. */
  region: RegionKind | null;
  /** true for enum variants and trait members: reachability comes from the parent. */
  inheritParent: boolean;
  /** true when items inside the new region are reachable. */
  regionReachable: boolean;
  /** false for `impl` lines, which open a region but are never reported. */
  report: boolean;
}

const RAW_STRING = /(?:b|c|br|cr)?r(#*)"/y;
const LINE_DOC = /^\/\/\/(?!\/)/;
const BLOCK_DOC_OPEN = /^\/\*\*(?!\*)/;
const DOC_ATTR = /#\[\s*doc\s*=/;
const DOC_HIDDEN = /#\[\s*doc\s*\(\s*hidden\s*\)\s*\]/;
const ALLOW_MISSING = /#\[\s*allow\s*\([^)]*missing_docs/;
const MACRO_EXPORT = /#\[\s*macro_export\s*\]/;
const FN_SIG = /^(?:const\s+|async\s+|unsafe\s+|extern\s+"[^"]*"\s+)*fn\s+(\w+)/;

/** Count `[` minus `]`, used to follow a multi-line attribute block. */
function bracketDelta(text: string): number {
  let d = 0;
  for (const ch of text) {
    if (ch === "[") d++;
    else if (ch === "]") d--;
  }
  return d;
}

/** Count occurrences of a single character. */
function countOf(text: string, ch: string): number {
  let n = 0;
  for (const c of text) if (c === ch) n++;
  return n;
}

/**
 * Replace every comment and string literal with spaces, keeping line breaks.
 * Nested block comments, raw strings and lifetimes are handled so that code
 * inside a string can never be mistaken for an item.
 */
function stripCommentsAndStrings(src: string): string {
  const out = src.split("");
  const n = src.length;
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to; k++) {
      if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
    }
  };

  let i = 0;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    if (c === "/" && c2 === "/") {
      let j = i;
      while (j < n && src[j] !== "\n") j++;
      blank(i, j);
      i = j;
      continue;
    }

    if (c === "/" && c2 === "*") {
      let d = 1;
      let j = i + 2;
      while (j < n && d > 0) {
        if (src[j] === "/" && src[j + 1] === "*") {
          d++;
          j += 2;
          continue;
        }
        if (src[j] === "*" && src[j + 1] === "/") {
          d--;
          j += 2;
          continue;
        }
        j++;
      }
      blank(i, j);
      i = j;
      continue;
    }

    RAW_STRING.lastIndex = i;
    const raw = RAW_STRING.exec(src);
    if (raw && c !== '"') {
      const terminator = '"' + raw[1];
      const bodyStart = i + raw[0].length;
      const end = src.indexOf(terminator, bodyStart);
      const stop = end === -1 ? n : end + terminator.length;
      blank(i, stop);
      i = stop;
      continue;
    }

    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === "\\") j++;
        j++;
      }
      j = Math.min(j + 1, n);
      blank(i, j);
      i = j;
      continue;
    }

    // `'` opens either a char literal or a lifetime.
    if (c === "'") {
      if (src[i + 1] === "\\") {
        let j = i + 2;
        while (j < n && src[j] !== "'") j++;
        j = Math.min(j + 1, n);
        blank(i, j);
        i = j;
        continue;
      }
      if (src[i + 2] === "'") {
        blank(i, i + 3);
        i += 3;
        continue;
      }
      i++;
      continue;
    }

    i++;
  }

  return out.join("");
}

/** Split a leading `pub` / `pub(crate)` / `pub(super)` / `pub(in path)` off a declaration. */
function readVis(text: string): { vis: Vis; rest: string } {
  const m = /^\s*(pub)\s*(\([^)]*\))?\s+/.exec(text);
  if (!m) return { vis: "private", rest: text.trimStart() };
  return { vis: m[2] ? "restricted" : "public", rest: text.slice(m[0].length) };
}

/** Drop fully-bracketed attributes that sit at the start of a line. */
function stripLeadingAttributes(text: string): string {
  let rest = text;
  for (;;) {
    const m = /^\s*#!?\[/.exec(rest);
    if (!m) return rest;
    const open = rest.indexOf("[", m.index);
    let d = 0;
    let j = open;
    for (; j < rest.length; j++) {
      if (rest[j] === "[") d++;
      else if (rest[j] === "]") {
        d--;
        if (d === 0) {
          j++;
          break;
        }
      }
    }
    if (d !== 0) return ""; // attribute continues on the next line
    rest = rest.slice(j);
  }
}

/**
 * True when a doc comment sits directly above `line`, skipping blank lines and
 * attribute lines. A `////` line and a block comment opened with three stars
 * are plain comments, not docs.
 */
function hasDocCommentAbove(rawLines: string[], attrLine: boolean[], line: number): boolean {
  let i = line - 1;
  while (i >= 0) {
    if (attrLine[i]) {
      i--;
      continue;
    }
    const t = rawLines[i].trim();
    if (t === "") {
      i--;
      continue;
    }
    if (LINE_DOC.test(t)) return true;
    if (t !== "/**/" && BLOCK_DOC_OPEN.test(t)) return true;
    if (t.endsWith("*/")) {
      let j = i;
      while (j >= 0) {
        const u = rawLines[j].trim();
        if (u !== "/**/" && BLOCK_DOC_OPEN.test(u)) return true;
        if (u.startsWith("/*")) return false;
        j--;
      }
      return false;
    }
    return false;
  }
  return false;
}

/** Names of types declared without a plain `pub`, used to spot `impl` of a private type. */
function collectPrivateTypes(codeLines: string[]): Set<string> {
  const out = new Set<string>();
  for (const line of codeLines) {
    const { vis, rest } = readVis(line.trim());
    if (vis === "public") continue;
    const m = /^(?:struct|enum|union|trait|type)\s+(\w+)/.exec(rest);
    if (m) out.add(m[1]);
  }
  return out;
}

/** Match one declaration at the start of a line. */
function matchItem(
  text: string,
  parent: Region | undefined,
  attrs: string,
  privateTypes: Set<string>,
): ItemHit | undefined {
  const { vis, rest } = readVis(text);
  const p = parent?.kind;

  if (p === "struct" || p === "union") {
    const m = /^(\w+)\s*:/.exec(rest);
    if (m) {
      return { kind: "field", name: m[1], vis, region: null, inheritParent: false, regionReachable: false, report: true };
    }
  }

  if (p === "enum") {
    const m = /^([A-Z]\w*)\s*(?:[({=,;]|$)/.exec(rest);
    if (m) {
      return { kind: "variant", name: m[1], vis: "public", region: null, inheritParent: true, regionReachable: false, report: true };
    }
  }

  if (p === "trait" || p === "impl") {
    const f = FN_SIG.exec(rest);
    if (f) {
      return {
        kind: "method",
        name: f[1],
        vis: p === "trait" ? "public" : vis,
        region: "fn",
        inheritParent: p === "trait",
        regionReachable: false,
        report: true,
      };
    }
    if (p === "trait") {
      const t = /^type\s+(\w+)/.exec(rest);
      if (t) {
        return { kind: "typeAlias", name: t[1], vis: "public", region: null, inheritParent: true, regionReachable: false, report: true };
      }
      const c = /^const\s+(\w+)\s*:/.exec(rest);
      if (c) {
        return { kind: "constant", name: c[1], vis: "public", region: null, inheritParent: true, regionReachable: false, report: true };
      }
    }
  }

  const own = vis === "public";

  const mod = /^mod\s+(\w+)/.exec(rest);
  if (mod) {
    return { kind: "module", name: mod[1], vis, region: "module", inheritParent: false, regionReachable: own, report: true };
  }

  const fn = FN_SIG.exec(rest);
  if (fn) {
    return { kind: "function", name: fn[1], vis, region: "fn", inheritParent: false, regionReachable: false, report: true };
  }

  const st = /^struct\s+(\w+)/.exec(rest);
  if (st) {
    return { kind: "struct", name: st[1], vis, region: "struct", inheritParent: false, regionReachable: own, report: true };
  }

  const en = /^enum\s+(\w+)/.exec(rest);
  if (en) {
    return { kind: "enum", name: en[1], vis, region: "enum", inheritParent: false, regionReachable: own, report: true };
  }

  const tr = /^(?:unsafe\s+|auto\s+)?trait\s+(\w+)/.exec(rest);
  if (tr) {
    return { kind: "trait", name: tr[1], vis, region: "trait", inheritParent: false, regionReachable: own, report: true };
  }

  const un = /^union\s+(\w+)/.exec(rest);
  if (un) {
    return { kind: "union", name: un[1], vis, region: "union", inheritParent: false, regionReachable: own, report: true };
  }

  const co = /^const\s+(\w+)\s*:/.exec(rest);
  if (co) {
    return { kind: "constant", name: co[1], vis, region: null, inheritParent: false, regionReachable: false, report: true };
  }

  const sg = /^static\s+(?:mut\s+)?(\w+)\s*:/.exec(rest);
  if (sg) {
    return { kind: "static", name: sg[1], vis, region: null, inheritParent: false, regionReachable: false, report: true };
  }

  const ty = /^type\s+(\w+)/.exec(rest);
  if (ty) {
    return { kind: "typeAlias", name: ty[1], vis, region: null, inheritParent: false, regionReachable: false, report: true };
  }

  const im = /^(?:unsafe\s+)?impl\b/.exec(rest);
  if (im) {
    const target = /impl(?:<[^>]*>)?\s+(?:[\w:]+\s+for\s+)?([\w:]+)/.exec(rest);
    const typeName = target?.[1]?.split("::").pop() ?? "";
    return {
      kind: "function",
      name: typeName,
      vis,
      region: "impl",
      inheritParent: false,
      regionReachable: !privateTypes.has(typeName),
      report: false,
    };
  }

  const mc = /^macro_rules!\s*(\w+)/.exec(rest);
  if (mc && MACRO_EXPORT.test(attrs)) {
    return { kind: "macro", name: mc[1], vis: "public", region: null, inheritParent: true, regionReachable: false, report: true };
  }

  return undefined;
}

export const rustDocstringChecker: DocstringChecker = {
  check(content: string): CheckResult {
    const rawLines = content.split(/\r?\n/);
    const codeLines = stripCommentsAndStrings(content).split(/\r?\n/);
    const lineCount = codeLines.length;

    // Mark attribute lines and remember the attribute block that precedes each line.
    const attrLine: boolean[] = new Array(lineCount).fill(false);
    const attrsBefore: string[] = new Array(lineCount).fill("");
    let buf: string[] = [];
    let attrDepth = 0;
    for (let i = 0; i < lineCount; i++) {
      const t = codeLines[i].trim();
      if (attrDepth > 0) {
        attrLine[i] = true;
        buf.push(t);
        attrDepth = Math.max(0, attrDepth + bracketDelta(t));
        continue;
      }
      if (t === "") continue;
      if (/^#!?\[/.test(t)) {
        attrLine[i] = true;
        buf.push(t);
        attrDepth = Math.max(0, bracketDelta(t));
        continue;
      }
      attrsBefore[i] = buf.join(" ");
      buf = [];
    }

    const privateTypes = collectPrivateTypes(codeLines);
    const missing: MissingDocstring[] = [];
    const regions: Region[] = [];
    let depth = 0;
    let parenDepth = 0;

    for (let i = 0; i < lineCount; i++) {
      let rest = codeLines[i];

      // Close any region that ended with a `}` at the start of this line.
      for (;;) {
        const m = /^\s*\}/.exec(rest);
        if (!m) break;
        depth--;
        while (regions.length > 0 && regions[regions.length - 1].openDepth > depth) regions.pop();
        rest = rest.slice(m[0].length);
      }

      if (attrLine[i]) continue;

      const attrs = attrsBefore[i];
      const parent = regions.length > 0 ? regions[regions.length - 1] : undefined;
      const parentReachable = parent ? parent.reachable : true;
      const parentSkip = parent ? parent.skip : false;

      rest = stripLeadingAttributes(rest);

      // Inside a parameter or field list nothing is a declaration of its own.
      const atMemberStart = parenDepth === 0;
      const hit = rest.trim() === "" || !atMemberStart ? undefined : matchItem(rest, parent, attrs, privateTypes);

      if (hit && hit.report) {
        const hidden = DOC_HIDDEN.test(attrs);
        const allowed = ALLOW_MISSING.test(attrs);
        const attrDoc = DOC_ATTR.test(attrs);
        const commentDoc = hasDocCommentAbove(rawLines, attrLine, i);
        const reachable = hit.inheritParent
          ? parentReachable
          : hit.vis === "public" && parentReachable;
        if (!parentSkip && !hidden && !allowed && !attrDoc && !commentDoc && reachable) {
          missing.push({ name: hit.name, kind: hit.kind, line: i + 1 });
        }
      }

      const opens = countOf(rest, "{");
      const closes = countOf(rest, "}");

      if (opens > 0) {
        const bodyDepth = depth + 1;
        if (hit && hit.region) {
          regions.push({
            kind: hit.region,
            openDepth: bodyDepth,
            reachable: parentReachable && hit.regionReachable,
            skip: parentSkip || DOC_HIDDEN.test(attrs) || ALLOW_MISSING.test(attrs),
          });
        } else if (!hit) {
          regions.push({ kind: "block", openDepth: bodyDepth, reachable: false, skip: true });
        }
      }

      depth += opens - closes;
      while (regions.length > 0 && regions[regions.length - 1].openDepth > depth) regions.pop();

      parenDepth = Math.max(0, parenDepth + countOf(rest, "(") - countOf(rest, ")"));
    }

    return { missing };
  },
};
