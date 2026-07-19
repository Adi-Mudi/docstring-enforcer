import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsDocstringChecker } from "../factories/js-docstring-checker.ts";

describe("jsDocstringChecker", () => {
  it("finds functions without JSDoc", () => {
    const code = `function foo() {}`;
    const result = jsDocstringChecker.check(code);
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });

  it("ignores functions with JSDoc", () => {
    const code = `/** Docs. */\nfunction foo() {}`;
    const result = jsDocstringChecker.check(code);
    assert.equal(result.missing.length, 0);
  });

  it("finds arrow functions without JSDoc", () => {
    const code = `const foo = (x) => x;`;
    const result = jsDocstringChecker.check(code);
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });

  it("finds class methods without JSDoc", () => {
    const code = `class A {\n  method1() {}\n}`;
    const result = jsDocstringChecker.check(code);
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "method1");
  });

  it("ignores JS keywords like if/for/while", () => {
    const code = `if (true) { while (false) {} }`;
    const result = jsDocstringChecker.check(code);
    assert.equal(result.missing.length, 0);
  });

  it("finds getters without JSDoc", () => {
    const code = `class A {\n  get value() {\n    return 1;\n  }\n}`;
    const result = jsDocstringChecker.check(code);
    assert.ok(result.missing.some((m) => m.name === "value"));
  });

  it("finds setters without JSDoc", () => {
    const code = `class A {\n  set value(v) {}\n}`;
    const result = jsDocstringChecker.check(code);
    assert.ok(result.missing.some((m) => m.name === "value"));
  });

  it("finds async arrow functions", () => {
    const code = `const foo = async (x) => x;`;
    const result = jsDocstringChecker.check(code);
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });

  it("ignores multi-line JSDoc blocks", () => {
    const code = `/**\n * Docs.\n */\nfunction foo() {}`;
    const result = jsDocstringChecker.check(code);
    assert.equal(result.missing.length, 0);
  });

  it("does not confuse plain block comments with JSDoc", () => {
    const code = `/* Not JSDoc */\nfunction foo() {}`;
    const result = jsDocstringChecker.check(code);
    assert.equal(result.missing.length, 1);
  });
});
