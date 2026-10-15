/**
 * C docstring checker.
 *
 * Enforces doc-comment presence on externally visible C entities
 * (D3/D5 of .IDE_Plans/docstring_enforcer_new_languages_discussion_20261015.md).
 *
 * Accepted doc forms (presence-based, broadest adoption per research):
 * - Doxygen blocks: `/** ... *\/`, `/*! ... *\/`
 * - Doxygen line runs: `///` (2+ consecutive lines)
 * - `//!` line runs
 * - GNU-style plain prose: `/* ... *\/` (kernel-doc also opens with `/**`,
 *   so it is covered by the doxygen form; plain `/*` counts per D3(a))
 *
 * Rule set (two-tier per D5, `strictMode` per D6):
 * - Default: flag non-static function prototypes/definitions, struct/union/enum
 *   definitions, typedefs (incl. function-pointer), file-scope non-static
 *   variables, and ALL `#define` macros (function- and object-like).
 * - strictMode: also flag `static` functions and `static` file-scope variables.
 * - Dedupe: a symbol documented at ANY declaration in the file is not flagged
 *   at other occurrences (research: header/source docs count once per symbol).
 *
 * Known limitations (kept line-based, mirroring the rust checker philosophy):
 * - Declarations are recognized when they start at brace-depth 0 and the
 *   declarator name is findable on the same logical line; wrapped parameter
 *   lists are joined first.
 * - Trailing `///<` documents only struct members/enum values, which are not
 *   flagged in v1.
 * - `/**** banner *...` (3+ stars) is NOT a doc block (doxygen JAVADOC_BANNER=NO).
 */

import type { CheckResult, DocstringChecker, MissingDocstring } from "./index.ts";

/** A declaration kind this checker reports. */
type DeclKind = MissingDocstring["kind"];

/** A parsed declaration at brace depth 0. */
interface Decl {
  name: string;
  kind: DeclKind;
  line: number; // 1-based line of the declaration start
  isStatic: boolean;
  /** Symbol key for dedupe across occurrences. */
  key: string;
}

const DOC_BLOCK = /^\/\*/; // any block-comment open; banners are rejected separately
const BANNER = /^\/\*{3,}/; // `/****...` — plain banner unless JAVADOC_BANNER
const LINE_DOC_RUN = /^\/\/[!/]/; // `///` or `//!`

/** Remove line comments (`//`) and block comments (`/*` ... `*\/`), keeping newlines. */
function stripComments(src: string): string {
  const out = src.split("");
  /**
   * Blank out the character range [from, to), preserving line breaks.
   * @param {number} from - Start index (inclusive).
   * @param {number} to - End index (exclusive).
   * @returns {void}
   */
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to; k++) {
      if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
    }
  };
  let i = 0;
  const n = src.length;
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
        if (src[j] === "/" && src[j + 1] === "*") d++, (j += 2);
        else if (src[j] === "*" && src[j + 1] === "/") d--, (j += 2);
        else j++;
      }
      blank(i, j);
      i = j;
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
    if (c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== "'") {
        if (src[j] === "\\") j++;
        j++;
      }
      j = Math.min(j + 1, n);
      blank(i, j);
      i = j;
      continue;
    }
    i++;
  }
  return out.join("");
}

/** Count `{` minus `}` in a line of stripped code. */
function braceDelta(text: string): number {
  let d = 0;
  for (const ch of text) {
    if (ch === "{") d++;
    else if (ch === "}") d--;
  }
  return d;
}

/**
 * True when a doc comment sits directly above `line`, skipping blank lines.
 * Rejects banner comments (3+ asterisks).
 */
function hasDocAbove(rawLines: string[], line: number): boolean {
  let i = line - 1;
  while (i >= 0) {
    const t = rawLines[i].trim();
    if (t === "") {
      i--;
      continue;
    }
    if (BANNER.test(t)) return false;
    if (LINE_DOC_RUN.test(t)) return true;
    if (DOC_BLOCK.test(t)) return true;
    if (t.endsWith("*/")) {
      // walk up to the opening of this block comment
      let j = i;
      while (j >= 0) {
        const u = rawLines[j].trim();
        if (BANNER.test(u)) return false;
        if (DOC_BLOCK.test(u)) return true;
        if (u.startsWith("/*")) return false;
        j--;
      }
      return false;
    }
    return false;
  }
  return false;
}

/** Extract the identifier before `(` or `=` or `;` from a declarator tail. */
function declaratorName(tail: string): string | undefined {
  // function: `ret (*name)(args)` or `ret name(args)`
  const fnPtr = /\(\s*\*\s*(\w+)\s*\)/.exec(tail);
  if (fnPtr) return fnPtr[1];
  const fn = /\b(\w+)\s*\(/.exec(tail);
  if (fn) return fn[1];
  const varMatch = /\b(\w+)\s*(?:\[[^\]]*\])?\s*(?:=|;|$)/.exec(tail);
  if (varMatch) return varMatch[1];
  return undefined;
}

/** Parse one logical (joined) declaration line into a Decl, if any. */
function parseDecl(text: string, line: number): Decl | undefined {
  let t = text.trim();
  const isStatic = /\bstatic\b/.test(t);

  // Skip preprocessor lines except #define handling below.
  if (t.startsWith("#")) {
    const def = /^#define\s+(\w+)\s*\(/.exec(t);
    if (def) return { name: def[1], kind: "macro", line, isStatic: false, key: `macro:${def[1]}` };
    const objDef = /^#define\s+(\w+)/.exec(t);
    if (objDef) return { name: objDef[1], kind: "macro", line, isStatic: false, key: `macro:${objDef[1]}` };
    return undefined;
  }

  // struct/union/enum definition (has a body brace) — skip forward decls without body.
  const su = /^(?:typedef\s+)?(struct|union|enum)\s+(\w*)\s*\{/.exec(t);
  if (su) {
    const name = su[2] || su[1];
    return { name, kind: su[1] === "enum" ? "enum" : "struct", line, isStatic, key: `${su[1]}:${name}` };
  }

  // typedef (incl. function-pointer typedef): `typedef ... name;`
  const td = /^typedef\s+/.exec(t);
  if (td) {
    const name = declaratorName(t.replace(/;\s*$/, ""));
    if (name) return { name, kind: "typeAlias", line, isStatic: false, key: `typedef:${name}` };
    return undefined;
  }

  // function prototype/definition: type + name + `(` at depth 0
  // skip control keywords
  if (/^(?:if|for|while|switch|return|else|do)\b/.test(t)) return undefined;

  const fn = /^[A-Za-z_][\w\s\*]*?\b(\w+)\s*\(/.exec(t);
  if (fn && !t.startsWith("typedef")) {
    const name = fn[1];
    return { name, kind: "function", line, isStatic, key: `fn:${name}` };
  }

  // file-scope variable: `type name;` / `type name = ...;`
  const vr = /^[A-Za-z_][\w\s\*]*?\b(\w+)\s*(?:\[[^\]]*\])?\s*(?:=|;)\s*$/.exec(t.replace(/\s+/g, " "));
  if (vr) {
    const name = vr[1];
    return { name, kind: "static", line, isStatic, key: `var:${name}` };
  }

  return undefined;
}

/** Build the checker; `strictMode` extends coverage to static/internal entities. */
export function cDocstringChecker(strictMode: boolean = false): DocstringChecker {
  return {
    check(content: string): CheckResult {
      const rawLines = content.split(/\r?\n/);
      const code = stripComments(content).split(/\r?\n/);

      // Join wrapped declarations: track paren depth; a line ending in an
      // unterminated paren/continuation merges with the next.
      interface Logical {
        text: string;
        line: number; // 1-based start line
      }
      const logical: Logical[] = [];
      let buf = "";
      let start = 0;
      let paren = 0;
      for (let i = 0; i < code.length; i++) {
        const t = code[i];
        if (buf === "" && t.trim() === "") continue;
        if (buf === "") start = i;
        buf += (buf ? " " : "") + t.trim();
        for (const ch of t) {
          if (ch === "(") paren++;
          else if (ch === ")") paren--;
        }
        const cont = paren > 0 || /\\\s*$/.test(t);
        if (!cont) {
          logical.push({ text: buf.replace(/\\\s+/g, " "), line: start + 1 });
          buf = "";
          paren = 0;
        }
      }
      if (buf.trim() !== "") logical.push({ text: buf, line: start + 1 });

      // Pass 1: collect declarations with brace-depth tracking.
      const decls: Decl[] = [];
      let depth = 0;
      for (const l of logical) {
        if (depth === 0) {
          const d = parseDecl(l.text, l.line);
          if (d) decls.push(d);
        }
        depth = Math.max(0, depth + braceDelta(l.text));
        // struct bodies: opening brace bumps depth, closing returns to 0.
      }

      // Pass 2: dedupe by symbol key — documented anywhere = documented everywhere.
      const documented = new Set<string>();
      for (const d of decls) {
        if (hasDocAbove(rawLines, d.line - 1) || hasDocAbove(rawLines, d.line)) {
          documented.add(d.key);
        }
      }
      // Also honor docs directly above the declaration line itself.
      for (const d of decls) {
        if (hasDocAbove(rawLines, d.line)) documented.add(d.key);
      }

      const missing: MissingDocstring[] = [];
      const seen = new Set<string>();
      for (const d of decls) {
        if (documented.has(d.key)) continue;
        if (d.isStatic && !strictMode) continue;
        if (seen.has(d.key)) continue; // warn once per symbol
        seen.add(d.key);
        missing.push({ name: d.name, kind: d.kind, line: d.line });
      }

      return { missing };
    },
  };
}
