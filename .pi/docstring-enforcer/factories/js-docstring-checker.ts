import type { CheckResult, DocstringChecker, MissingDocstring } from "./index.ts";

const JS_KEYWORDS = new Set([
  "if",
  "while",
  "for",
  "switch",
  "catch",
  "with",
  "do",
  "try",
]);

function hasJSDocAbove(lines: string[], functionLineIndex: number): boolean {
  let inBlockComment = false;

  for (let i = functionLineIndex - 1; i >= 0; i--) {
    const line = lines[i].trim();

    if (line === "") {
      continue;
    }

    if (inBlockComment) {
      if (line.startsWith("/**")) {
        return true;
      }
      continue;
    }

    if (line.endsWith("*/")) {
      inBlockComment = true;
      if (line.startsWith("/*") && !line.startsWith("/**")) {
        return false;
      }
      if (line.startsWith("/**")) {
        return true;
      }
      continue;
    }

    return false;
  }

  return false;
}

interface Pattern {
  regex: RegExp;
  kind: MissingDocstring["kind"];
  nameIndex: number;
  skipKeywords?: boolean;
}

export const jsDocstringChecker: DocstringChecker = {
  check(content: string): CheckResult {
    const lines = content.split(/\r?\n/);
    const missing: MissingDocstring[] = [];

    const patterns: Pattern[] = [
      // function foo(...)
      { regex: /^\s*function\s+(\w+)(?:<[^>]+>)?\s*\(/, kind: "function", nameIndex: 1 },
      // const foo = function(...)
      { regex: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*function\s*\(/, kind: "function", nameIndex: 1 },
      // const foo = (args): Type =>  or  const foo = async (args): Type =>
      {
        regex: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*:\s*[^=]+?\s*=>/,
        kind: "function",
        nameIndex: 1,
      },
      // const foo = (args) =>  or  const foo = async (args) =>
      {
        regex: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
        kind: "function",
        nameIndex: 1,
      },
      // const foo = x =>  (single-param arrow without parens)
      {
        regex: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\w+\s*=>/,
        kind: "function",
        nameIndex: 1,
      },
      // shorthand method: foo() {
      { regex: /^\s*(\w+)\s*\([^)]*\)\s*\{/, kind: "method", nameIndex: 1, skipKeywords: true },
      // getter/setter: get foo() { / set foo(v) {
      { regex: /^\s*(?:get|set)\s+(\w+)\s*\(/, kind: "getter", nameIndex: 1 },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const name = match[pattern.nameIndex];
          if (!name) continue;
          if (pattern.skipKeywords && JS_KEYWORDS.has(name)) continue;

          if (!hasJSDocAbove(lines, i)) {
            missing.push({ name, kind: pattern.kind, line: i + 1 });
          }
          break;
        }
      }
    }

    return { missing };
  },
};
