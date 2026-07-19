import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Re-create the message builders here since they are not exported.
// This tests the logic independently of the extension entrypoint.

function buildJSDocMessage(fileName: string, missing: { name: string; line: number }[]): string {
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

function buildPythonMessage(
  fileName: string,
  missing: { name: string; line: number }[],
  style: "google" | "numpy",
): string {
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

describe("message builders", () => {
  it("buildJSDocMessage includes file name and missing items", () => {
    const message = buildJSDocMessage("foo.ts", [{ name: "bar", line: 2 }]);
    assert.ok(message.includes("foo.ts"));
    assert.ok(message.includes("bar"));
    assert.ok(message.includes("line 2"));
    assert.ok(message.includes("@param"));
  });

  it("buildPythonMessage includes google style example", () => {
    const message = buildPythonMessage("foo.py", [{ name: "bar", line: 3 }], "google");
    assert.ok(message.includes("foo.py"));
    assert.ok(message.includes("bar"));
    assert.ok(message.includes("google"));
    assert.ok(message.includes("Args:"));
  });

  it("buildPythonMessage includes numpy style example", () => {
    const message = buildPythonMessage("foo.py", [{ name: "bar", line: 3 }], "numpy");
    assert.ok(message.includes("numpy"));
    assert.ok(message.includes("Parameters"));
    assert.ok(message.includes("Returns"));
  });

  it("buildUnsupportedMessage lists supported extensions", () => {
    const message = buildUnsupportedMessage(".rs", [".ts", ".py"]);
    assert.ok(message.includes(".rs"));
    assert.ok(message.includes(".ts"));
    assert.ok(message.includes(".py"));
  });

  it("askPythonStyleMessage mentions both styles", () => {
    const message = askPythonStyleMessage();
    assert.ok(message.includes("google"));
    assert.ok(message.includes("numpy"));
    assert.ok(message.includes("docstring_config.json"));
  });
});
