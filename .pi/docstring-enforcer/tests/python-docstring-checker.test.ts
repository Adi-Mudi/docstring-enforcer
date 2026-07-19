import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pythonDocstringChecker } from "../factories/python-docstring-checker.ts";

describe("pythonDocstringChecker", () => {
  it("finds functions without docstrings", () => {
    const code = `def foo():\n    pass`;
    const result = pythonDocstringChecker("google").check(code);
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });

  it("ignores functions with docstrings", () => {
    const code = `def foo():\n    """Docs."""\n    pass`;
    const result = pythonDocstringChecker("google").check(code);
    assert.equal(result.missing.length, 0);
  });

  it("finds async functions", () => {
    const code = `async def foo():\n    pass`;
    const result = pythonDocstringChecker("google").check(code);
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });

  it("finds classes without docstrings", () => {
    const code = `class Foo:\n    pass`;
    const result = pythonDocstringChecker("google").check(code);
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "Foo");
  });

  it("ignores classes with docstrings", () => {
    const code = `class Foo:\n    """Docs."""\n    pass`;
    const result = pythonDocstringChecker("google").check(code);
    assert.equal(result.missing.length, 0);
  });

  it("does not treat a comment as a docstring", () => {
    const code = `def foo():\n    # not a docstring\n    pass`;
    const result = pythonDocstringChecker("google").check(code);
    assert.equal(result.missing.length, 1);
  });

  it("handles single-quoted docstrings", () => {
    const code = `def foo():\n    '''Docs.'''\n    pass`;
    const result = pythonDocstringChecker("google").check(code);
    assert.equal(result.missing.length, 0);
  });

  it("finds methods inside classes", () => {
    const code = `class Foo:\n    def bar(self):\n        pass`;
    const result = pythonDocstringChecker("google").check(code);
    assert.equal(result.missing.length, 2);
    assert.ok(result.missing.some((m) => m.name === "Foo"));
    assert.ok(result.missing.some((m) => m.name === "bar"));
  });

  it("works with numpy style argument", () => {
    const code = `def foo():\n    pass`;
    const result = pythonDocstringChecker("numpy").check(code);
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });
});
