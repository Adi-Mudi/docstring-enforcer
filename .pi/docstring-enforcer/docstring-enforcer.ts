/**
 * Docstring Enforcer Extension
 *
 * After any write or edit, scans supported files for missing docstrings
 * and sends a steer message prompting the AI to add them.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  detectLanguage,
  getChecker,
  getSupportedExtensions,
  isIgnored,
  loadConfig,
  type Config,
  type MissingDocstring,
} from "./factories/index.ts";

const CONFIG_PATH = ".pi/docstring-enforcer/docstring_config.json";

function buildRustMessage(fileName: string, missing: MissingDocstring[]): string {
  const itemList = missing.map((m) => `- \`${m.name}\` (${m.kind}, line ${m.line})`).join("\n");
  return (
    `**Docstring Check:** The following public items in \`${fileName}\` are missing Rust doc comments:\n\n` +
    `${itemList}\n\n` +
    `Rust documents items with \`///\` comments rendered by rustdoc. Write a one-line summary in third person present tense, then the details, then an example:\n\n` +
    "```rust\n" +
    "/// Returns the parsed value for `key`, or `None` when absent.\n" +
    "///\n" +
    "/// # Examples\n" +
    "///\n" +
    "/// ```\n" +
    "/// assert_eq!(lookup(\"a\"), Some(1));\n" +
    "/// ```\n" +
    "pub fn lookup(key: &str) -> Option<i32> { ... }\n" +
    "```\n\n" +
    `Add \`# Errors\` when the function returns \`Result\`, \`# Panics\` when it can panic, and \`# Safety\` when it is \`unsafe\`. ` +
    `Prefer \`///\` over \`/** ... */\`, use \`//!\` only for module or crate docs, and place the comment directly above the item, above any attributes. ` +
    `If an item genuinely needs no docs, mark it \`#[doc(hidden)]\` or \`#[allow(missing_docs)]\`.`
  );
}

function buildJSDocMessage(fileName: string, missing: MissingDocstring[]): string {
  const itemList = missing.map((m) => `- \`${m.name}\` (line ${m.line})`).join("\n");
  return (
    `**Docstring Check:** The following functions/methods in \`${fileName}\` are missing JSDoc docstrings:\n\n` +
    `${itemList}\n\n` +
    `Please add proper JSDoc comments with \`@param\` and \`@returns\` tags above each item. Example:\n\n` +
    `\`\`\`javascript\n` +
    `/**\n` +
    ` * Brief description of what this function does.\n` +
    ` * @param {Type} paramName - Description\n` +
    ` * @returns {Type} Description\n` +
    ` */\n` +
    `function example(paramName) { ... }\n` +
    `\`\`\``
  );
}

function buildPythonMessage(fileName: string, missing: MissingDocstring[], style: "google" | "numpy"): string {
  const itemList = missing.map((m) => `- \`${m.name}\` (line ${m.line})`).join("\n");
  const example =
    style === "google"
      ? `\`\`\`python\n` +
        `def example(param_name: str) -> bool:\n` +
        `    """Brief description of what this function does.\n` +
        `\n` +
        `    Args:\n` +
        `        param_name: Description of the parameter.\n` +
        `\n` +
        `    Returns:\n` +
        `        bool: Description of the return value.\n` +
        `    """\n` +
        `\`\`\``
      : `\`\`\`python\n` +
        `def example(param_name: str) -> bool:\n` +
        `    """Brief description of what this function does.\n` +
        `\n` +
        `    Parameters\n` +
        `    ----------\n` +
        `    param_name : str\n` +
        `        Description of the parameter.\n` +
        `\n` +
        `    Returns\n` +
        `    -------\n` +
        `    bool\n` +
        `        Description of the return value.\n` +
        `    """\n` +
        `\`\`\``;

  return (
    `**Docstring Check:** The following functions/classes in \`${fileName}\` are missing ${style}-style docstrings:\n\n` +
    `${itemList}\n\n` +
    `Please add proper docstrings. Example:\n\n` +
    `${example}`
  );
}

function buildUnsupportedMessage(ext: string, supported: string[]): string {
  return (
    `**Docstring Enforcer:** File type \`${ext}\` is not supported.\n\n` +
    `Supported extensions: ${supported.join(", ")}\n\n` +
    `To add support, create a new language factory in \`.pi/docstring-enforcer/factories/\` and register it in \`docstring_config.json\`.`
  );
}

function askPythonStyleMessage(): string {
  return (
    `**Docstring Enforcer:** This project uses Python files, but no docstring style is configured.\n\n` +
    `Please choose a style by setting \`pythonStyle\` in \`.pi/docstring-enforcer/docstring_config.json\`:\n` +
    `- \`"google"\` (recommended for general projects)\n` +
    `- \`"numpy"\` (common for scientific/ML projects)\n\n` +
    `Example:\n` +
    `\`\`\`json\n` +
    `{\n` +
    `  "pythonStyle": "google"\n` +
    `}\n` +
    `\`\`\``
  );
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
    const normalizedPath = absolutePath.replace(/\\/g, "/").toLowerCase();
    const cwdNormalized = ctx.cwd.replace(/\\/g, "/").toLowerCase();
    if (!normalizedPath.startsWith(cwdNormalized)) {
      return undefined;
    }

    const config = loadConfig(resolve(ctx.cwd, CONFIG_PATH));

    if (isIgnored(absolutePath, config)) {
      return undefined;
    }

    const language = detectLanguage(absolutePath, config);
    const extIndex = absolutePath.lastIndexOf(".");
    const ext = extIndex >= 0 ? absolutePath.slice(extIndex).toLowerCase() : "";

    if (!language) {
      pi.sendUserMessage(buildUnsupportedMessage(ext, getSupportedExtensions(config)), { deliverAs: "steer" });
      return undefined;
    }

    if (language === "python" && !config.pythonStyle) {
      pi.sendUserMessage(askPythonStyleMessage(), { deliverAs: "steer" });
      return undefined;
    }

    try {
      const content = readFileSync(absolutePath, "utf-8");
      const checker = getChecker(language, config);
      const result = checker.check(content);

      if (result.missing.length > 0) {
        const fileName = absolutePath.split(/[\\/]/).pop() ?? absolutePath;
        let message: string;
        if (language === "python") {
          message = buildPythonMessage(fileName, result.missing, config.pythonStyle ?? "google");
        } else if (language === "rust") {
          message = buildRustMessage(fileName, result.missing);
        } else {
          message = buildJSDocMessage(fileName, result.missing);
        }
        pi.sendUserMessage(message, { deliverAs: "steer" });
      }
    } catch {
      // Silently ignore read errors
    }

    return undefined;
  });
}
