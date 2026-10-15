/**
 * R docstring checker.
 *
 * Enforces roxygen2 documentation blocks (D2/D5 of
 * .IDE_Plans/docstring_enforcer_new_languages_discussion_20261015.md):
 * a top-level named object must carry a contiguous `#'` block directly
 * above it. Plain `#` comments are NOT documentation (roxygen2 ignores
 * them; R CMD check only sees what roxygen2 compiles from `#'`).
 *
 * Rule set (presence-based, matching the extension's other checkers):
 * - Flagged: top-level named functions, replacement functions (`foo<-`),
 *   infix operators (`%op%`), S4 setGeneric/setMethod/setReplaceMethod calls,
 *   S3 generics (plain `generic <- function`), R6Class() definitions.
 * - NOT flagged: S3 methods (`generic.class <- function`; roxygen2 makes
 *   method docs optional), anonymous functions, nested/local functions,
 *   anything under a block containing `@noRd` (intentional opt-out),
 *   imported/re-exported references (`pkg::fun` alone on a line).
 *
 * Known limitations (kept simple per research gap G2):
 * - Only top-level (column-0) assignments are scanned; indented code is
 *   assumed to be inside a function body.
 * - R6 public-method inline docs are not checked in v1 (class block only).
 * - Datasets in `data/*.rda` are binary files this extension never reads.
 */

import type { CheckResult, DocstringChecker, MissingDocstring } from "./index.ts";

/** `foo <- function` or `` `foo<-` <- function `` / `` `%op%` <- function ``. */
const FN_ASSIGN = /^(`?[^`\s]+`?)\s*(?:<-|=)\s*(?:\w+:::\s*)?function\b/;
/** S3 method: `print.foo <- function` or `print.foo <- function`. */
const S3_METHOD = /^[A-Za-z.][\w.]*\.[\w.]+\s*(?:<-|=)\s*(?:\w+:::\s*)?function\b/;
/** S4 registration calls at column 0. */
const S4_CALL = /^(setGeneric|setMethod|setReplaceMethod|setClass|setClassUnion|setAs)\s*\(/;
/** R6 class definition. */
const R6_CLASS = /^(?:[\w.]+\s*(?:<-|=)\s*)?(?:\w+:::?\s*)?R6Class\s*\(/;
/** Intentional opt-out recognized by roxygen2. */
const NO_RD = /@noRd\b/;
/** Doc block opener: `#'` with optional single space. */
const ROXYGEN = /^#'/;

/**
 * True when a roxygen2 block sits directly above `line` (blank lines and
 * plain `#` comments are skipped; a plain comment does not document but
 * also does not break the block association for scan simplicity).
 * Returns the raw text of the block so the caller can test for `@noRd`.
 */
function findRoxygenBlockAbove(rawLines: string[], line: number): string | undefined {
  let i = line - 1;
  const collected: string[] = [];
  while (i >= 0) {
    const t = rawLines[i].trim();
    if (t === "") {
      i--;
      continue;
    }
    if (ROXYGEN.test(t)) {
      collected.unshift(rawLines[i]);
      i--;
      continue;
    }
    break;
  }
  return collected.length > 0 ? collected.join("\n") : undefined;
}

/** Name from an S4 call, e.g. `setMethod("show", ...` -> `setMethod("show"`. */
function s4Label(line: string): string {
  const m = /^(\w+)\s*\(\s*"([^"]*)"/.exec(line);
  if (m) return `${m[1]}("${m[2]}")`;
  const f = /^(\w+)\s*\(/.exec(line);
  return f ? f[1] : "S4 call";
}

/** R6Class name if present: `Foo <- R6::R6Class("Foo",` -> `Foo`. */
function r6Label(line: string): string {
  const m = /^([\w.]+)\s*(?:<-|=)/.exec(line);
  return m ? m[1] : "R6Class";
}

export const rDocstringChecker: DocstringChecker = {
  check(content: string): CheckResult {
    const rawLines = content.split(/\r?\n/);
    const missing: MissingDocstring[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      // Only column-0 code is top-level in R; skip indented lines.
      const line = rawLines[i];
      if (line.trim() === "" || /^\s/.test(line)) continue;
      const text = line.trim();

      let name: string | undefined;
      let kind: MissingDocstring["kind"] = "function";

      const fn = FN_ASSIGN.exec(text);
      if (fn) {
        name = fn[1].replace(/`/g, "");
        // S3 methods (`print.foo`) are exempt (roxygen2: optional by design).
        if (S3_METHOD.test(text)) continue;
      } else if (S4_CALL.test(text)) {
        name = s4Label(text);
        kind = "method";
      } else if (R6_CLASS.test(text)) {
        name = r6Label(text);
        kind = "class";
      }

      if (!name) continue;

      const block = findRoxygenBlockAbove(rawLines, i);
      if (block !== undefined) {
        // `@noRd` means "intentionally undocumented output" — exempt.
        if (NO_RD.test(block)) continue;
        continue; // documented
      }

      missing.push({ name, kind, line: i + 1 });
    }

    return { missing };
  },
};
