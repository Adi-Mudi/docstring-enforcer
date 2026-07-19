/**
 * Docstring Enforcer Extension
 *
 * After any write or edit to a .gs or .ts file, scans the file for
 * named function declarations that are missing JSDoc docstrings.
 * If any are found, sends a steer message prompting the AI to add them.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGET_EXTENSIONS = [".gs", ".ts"];
const JS_KEYWORDS = new Set([
  "if", "while", "for", "switch", "catch", "with", "do", "try", "async",
]);

/**
 * Checks if a file path has a target extension (.gs or .ts).
 * @param {string} filePath - The file path to check.
 * @returns {boolean} True if the file is a .gs or .ts file.
 */
function isTargetFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return TARGET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Checks whether a JSDoc block comment exists directly above a given line.
 * @param {string[]} lines - All lines of the file.
 * @param {number} functionLineIndex - The line index of the function to check.
 * @returns {boolean} True if a JSDoc /** comment is found immediately above.
 */
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

/**
 * Scans file content for function declarations that are missing JSDoc docstrings.
 * @param {string} content - The full text content of the file.
 * @returns {string[]} Array of function names missing JSDoc comments.
 */
function findMissingDocstrings(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const missing: string[] = [];

  const patterns = [
    // function foo(...)
    { regex: /^\s*function\s+(\w+)(?:<[^>]+>)?\s*\(/, nameIndex: 1 },
    // const foo = function(...)
    { regex: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*function\s*\(/, nameIndex: 1 },
    // const foo = (args) =>  or  const foo = async (args) =>
    { regex: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/, nameIndex: 1 },
    // const foo = (args): Type =>  or  const foo = async (args): Type =>
    { regex: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*:\s*[^=]+?\s*=>/, nameIndex: 1 },
    // const foo = x =>  (single-param arrow without parens)
    { regex: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\w+\s*=>/, nameIndex: 1 },
    // shorthand method: foo() {
    { regex: /^\s*(\w+)\s*\([^)]*\)\s*\{/, nameIndex: 1, skipKeywords: true },
    // getter/setter: get foo() { / set foo(v) {
    { regex: /^\s*(?:get|set)\s+(\w+)\s*\(/, nameIndex: 1 },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) {
        const funcName = match[pattern.nameIndex];
        if (!funcName) continue;
        if (pattern.skipKeywords && JS_KEYWORDS.has(funcName)) continue;

        if (!hasJSDocAbove(lines, i)) {
          missing.push(funcName);
        }
        break;
      }
    }
  }

  return missing;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") {
      return undefined;
    }

    if (event.isError) {
      return undefined;
    }

    const filePath = event.input.path as string;
    if (!filePath) {
      return undefined;
    }

    const absolutePath = resolve(ctx.cwd, filePath);

    if (!isTargetFile(absolutePath)) {
      return undefined;
    }

    const normalizedPath = absolutePath.replace(/\\/g, "/").toLowerCase();
    const cwdNormalized = ctx.cwd.replace(/\\/g, "/").toLowerCase();
    if (!normalizedPath.startsWith(cwdNormalized)) {
      return undefined;
    }

    try {
      const content = readFileSync(absolutePath, "utf-8");
      const missing = findMissingDocstrings(content);

      if (missing.length > 0) {
        const fileName = absolutePath.split(/[\\/]/).pop();
        const funcList = missing.map((f) => `- \`${f}\``).join("\n");

        const message =
          `**Docstring Check:** The following functions in \`${fileName}\` are missing JSDoc docstrings:\n\n` +
          `${funcList}\n\n` +
          `Please add proper JSDoc comments with \`@param\` and \`@returns\` tags above each function. Example:\n\n` +
          `\`\`\`javascript\n` +
          `/**\n` +
          ` * Brief description of what this function does.\n` +
          ` * @param {Type} paramName - Description\n` +
          ` * @returns {Type} Description\n` +
          ` */\n` +
          `function example(paramName) { ... }\n` +
          `\`\`\``;

        pi.sendUserMessage(message, { deliverAs: "steer" });
      }
    } catch {
      // Silently ignore read errors
    }

    return undefined;
  });
}
