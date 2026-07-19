import type { CheckResult, DocstringChecker, MissingDocstring } from "./index.ts";

interface Pattern {
  regex: RegExp;
  kind: MissingDocstring["kind"];
}

function hasDocstring(lines: string[], definitionLineIndex: number): boolean {
  let i = definitionLineIndex + 1;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // A docstring must be the first statement and must be a triple-quoted string.
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      return true;
    }

    // First non-empty line is not a docstring.
    return false;
  }

  return false;
}

export function pythonDocstringChecker(style: "google" | "numpy"): DocstringChecker {
  return {
    check(content: string): CheckResult {
      const lines = content.split(/\r?\n/);
      const missing: MissingDocstring[] = [];

      const patterns: Pattern[] = [
        { regex: /^\s*(?:async\s+)?def\s+(\w+)\s*\(/, kind: "function" },
        { regex: /^\s*class\s+(\w+)\s*[:\(]/, kind: "class" },
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of patterns) {
          const match = line.match(pattern.regex);
          if (match) {
            const name = match[1];
            if (!hasDocstring(lines, i)) {
              missing.push({ name, kind: pattern.kind, line: i + 1 });
            }
            break;
          }
        }
      }

      return { missing };
    },
  };
}

