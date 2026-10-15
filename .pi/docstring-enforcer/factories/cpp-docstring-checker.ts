/**
 * C++ docstring checker.
 *
 * Enforces doxygen-style doc-comment presence on public C++ API entities
 * (D4/D5 of .IDE_Plans/docstring_enforcer_new_languages_discussion_20261015.md).
 *
 * Accepted doc forms (doxygen set per D4(a); plain `//` prose excluded):
 * - Blocks: `/** ... *\/`, `/*! ... *\/`
 * - Line runs: `///` or `//!` (2+ consecutive lines)
 * - Trailing member docs: `///<`, `//!<`, `/**<`, `/*!<`
 *
 * Rule set (two-tier per D5, `strictMode` per D6):
 * - Default: flag free functions, class/struct definitions, enum types,
 *   operator overloads, and PUBLIC member functions without a doc block.
 * - strictMode: also flag private/protected members and static free functions.
 * - Exempt always (research: Google C++ Style Guide + LLVM):
 *   `override` methods, `= delete` / `= default` declarations, constructors,
 *   destructors, lambdas, entities in anonymous namespaces, enum values,
 *   class data members, `namespace` blocks, macros.
 * - Dedupe by kind+name: documented at ANY declaration = documented everywhere.
 *
 * Known limitations (line-based scan, mirroring the rust/C checkers):
 * - Access specifier tracking (`public:`/`private:`) is brace-depth based;
 *   multiple specifiers on one line take the last one.
 * - Wrapped parameter lists are joined before matching.
 * - Trivial-accessor exemption (Google) is NOT applied in v1: a public
 *   getter without a doc block is still flagged.
 */

import type { CheckResult, DocstringChecker, MissingDocstring } from "./index.ts";

const DOC_BLOCK = /^\/\*/; // any block-comment open; banners rejected separately
const BANNER = /^\/\*{3,}/; // `/****...` banner is not a doc block
const LINE_DOC_RUN = /^\/\/[!/]/; // `///` or `//!`
const TRAILING_DOC = /\/\/[!<]|\/\*[!<]/; // trailing `///<` `//!<` `/**<` `/*!<`

/** Remove comments and string/char literals, keeping newlines. */
function stripCommentsAndStrings(src: string): string {
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

/** Count a single character in text. */
function countOf(text: string, ch: string): number {
  let n = 0;
  for (const c of text) if (c === ch) n++;
  return n;
}

/**
 * True when a doxygen doc block or trailing doc sits directly above `line`
 * (blank lines skipped), or the line itself ends with a trailing doc marker.
 * @param {string[]} rawLines - Original source lines (comments intact).
 * @param {number} line - 1-based declaration line.
 * @returns {boolean} True when the declaration counts as documented.
 */
function hasDocAbove(rawLines: string[], line: number): boolean {
  if (TRAILING_DOC.test(rawLines[line - 1] ?? "")) return true;
  let i = line - 2; // start strictly above
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

/** A matched declaration worth considering. */
interface Decl {
  name: string;
  kind: MissingDocstring["kind"];
  line: number;
  /** Member of a class/struct body (access decided by the region). */
  inClass: boolean;
  /** Private/protected member of a class/struct. */
  isPrivate: boolean;
  /** Free or member function declared `static`. */
  isStatic: boolean;
  /** Inside an anonymous namespace (always exempt). */
  inAnonymous: boolean;
  /** Exempt regardless of mode (override, =delete/default, ctor, dtor). */
  exempt: boolean;
}

/** A brace-delimited region the scan is inside. */
interface Region {
  openDepth: number;
  access: "public" | "private";
  anonymous: boolean;
  /** Enclosing class/struct name for ctor/dtor exemption. */
  className?: string;
}

/**
 * Match a declaration at the start of a stripped logical line.
 * @param {string} text - Stripped source line (comments removed).
 * @param {Region} [parent] - Innermost open region, if any.
 * @param {number} depth - Current brace depth.
 * @returns {Decl | undefined} The parsed declaration, if any.
 */
function matchDecl(text: string, parent: Region | undefined, depth: number): Decl | undefined {
  const t = text.trim();
  if (t === "" || t.startsWith("#")) return undefined;
  if (/^(?:if|for|while|switch|return|else|do|throw|catch)\b/.test(t)) return undefined;

  const isStatic = /^static\b/.test(t);
  const inClass = depth > 0 && parent !== undefined && parent.className !== undefined;
  const isPrivate = inClass && parent!.access === "private";
  const inAnonymous = parent?.anonymous === true;

  // class / struct / enum definitions with a body
  const cse = /^(?:template\s*<[^>]*>\s*)?(class|struct|enum(?:\s+class)?)\s+(\w+)/.exec(t);
  if (cse) {
    if (!t.includes("{")) return undefined; // forward declaration: not reported
    const kind = cse[1].startsWith("enum") ? "enum" : "class";
    return {
      name: cse[2],
      kind,
      line: 0,
      inClass: depth > 0,
      isPrivate: depth > 0 && parent !== undefined && parent.access === "private",
      isStatic: false,
      inAnonymous,
      exempt: false,
    };
  }

  // operator overload: `ret operator$(args)`
  const op = /\boperator\s*(?:\(\)|\[\]|[^\s(]+)\s*\(/.exec(t);
  if (op) {
    return {
      name: op[0].replace(/\s*\($/, "").trim(),
      kind: "method",
      line: 0,
      inClass,
      isPrivate,
      isStatic,
      inAnonymous,
      exempt: false,
    };
  }

  // function / method: `... name(args) ...`
  const fn = /^(?:[\w:<>~*&\s]+?)\b(\w+)\s*\(/.exec(t);
  if (fn) {
    const name = fn[1];
    const exempt =
      /(?:=\s*(?:delete|default))\s*;/.test(t) || // = delete / = default
      /\boverride\b/.test(t) || // override (Google: no doc needed)
      (parent?.className !== undefined && name === parent.className) || // constructor
      (parent?.className !== undefined && t.includes("~" + parent.className)); // destructor
    return {
      name,
      kind: inClass ? "method" : "function",
      line: 0,
      inClass,
      isPrivate,
      isStatic,
      inAnonymous,
      exempt,
    };
  }

  return undefined; // vars, typedefs, using, macros: not reported in v1
}

/** Build the checker; `strictMode` extends coverage to private/static entities. */
export function cppDocstringChecker(strictMode: boolean = false): DocstringChecker {
  return {
    check(content: string): CheckResult {
      const rawLines = content.split(/\r?\n/);
      const code = stripCommentsAndStrings(content).split(/\r?\n/);

      // Join wrapped parameter lists like the C checker.
      interface Logical {
        text: string;
        line: number;
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
        paren = Math.max(0, paren + countOf(t, "(") - countOf(t, ")"));
        const cont = paren > 0 || /\\\s*$/.test(t);
        if (!cont) {
          logical.push({ text: buf.replace(/\\\s+/g, " "), line: start + 1 });
          buf = "";
          paren = 0;
        }
      }
      if (buf.trim() !== "") logical.push({ text: buf, line: start + 1 });

      // Pass 1: collect declarations with brace/access region tracking.
      const decls: Decl[] = [];
      const regions: Region[] = [];
      let depth = 0;

      for (const l of logical) {
        while (regions.length > 0 && regions[regions.length - 1].openDepth > depth) {
          regions.pop();
        }
        const parent = regions.length > 0 ? regions[regions.length - 1] : undefined;
        const t = l.text.trim();

        // Access specifiers flip the current class region's access.
        const acc = /^(public|private|protected)\s*:/.exec(t);
        if (acc && parent) {
          parent.access = acc[1] === "public" ? "public" : "private";
        }

        // Anonymous namespace: everything inside is exempt.
        if (/^namespace\s*\{/.test(t)) {
          regions.push({ openDepth: depth + 1, access: "public", anonymous: true });
          depth += 1;
          continue;
        }

        const hit = matchDecl(l.text, parent, depth);
        if (hit) {
          decls.push({ ...hit, line: l.line });
        }

        // Track brace regions for class/struct/function/namespace bodies.
        const opens = countOf(l.text, "{");
        const closes = countOf(l.text, "}");
        if (opens > 0) {
          const isClassDef =
            /^(?:template\s*<[^>]*>\s*)?(class|struct)\s+\w+/.test(t) && parent?.className === undefined;
          const className = /(?:class|struct)\s+(\w+)/.exec(t)?.[1];
          regions.push({
            openDepth: depth + 1,
            access: isClassDef && t.startsWith("struct") ? "public" : isClassDef ? "private" : parent?.access ?? "public",
            anonymous: parent?.anonymous ?? false,
            className: isClassDef || parent?.className === undefined ? className : parent.className,
          });
        }
        depth = Math.max(0, depth + opens - closes);
        while (regions.length > 0 && regions[regions.length - 1].openDepth > depth) {
          regions.pop();
        }
      }

      // Pass 2: dedupe by key — documented at any occurrence covers the symbol.
      const documented = new Set<string>();
      for (const d of decls) {
        if (hasDocAbove(rawLines, d.line)) documented.add(`${d.kind}:${d.name}`);
      }

      const missing: MissingDocstring[] = [];
      const seen = new Set<string>();
      for (const d of decls) {
        const key = `${d.kind}:${d.name}`;
        if (d.exempt) continue;
        if (d.inAnonymous) continue;
        if (documented.has(key)) continue;
        if (d.inClass && d.isPrivate && !strictMode) continue;
        if (d.isStatic && !strictMode) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        missing.push({ name: d.name, kind: d.kind, line: d.line });
      }

      return { missing };
    },
  };
}
