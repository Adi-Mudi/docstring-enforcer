import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getChecker, loadConfig } from "../factories/index.ts";
import { jsDocstringChecker } from "../factories/js-docstring-checker.ts";
import { rustDocstringChecker } from "../factories/rust-docstring-checker.ts";

describe("getChecker", () => {
  const config = loadConfig("/tmp/docstring-dispatch-config.json");

  it("returns JS checker for javascript", () => {
    const checker = getChecker("javascript", config);
    assert.equal(checker, jsDocstringChecker);
  });

  it("returns Python checker for python", () => {
    const checker = getChecker("python", { ...config, pythonStyle: "google" });
    // Cannot compare directly because pythonDocstringChecker returns a new object each time.
    // Instead verify it works.
    const result = checker.check("def foo():\n    pass");
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });

  it("returns Rust checker for rust", () => {
    const checker = getChecker("rust", config);
    assert.equal(checker, rustDocstringChecker);
    const result = checker.check("pub fn foo() {}\n");
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });

  it("returns R checker for r", () => {
    const checker = getChecker("r", config);
    const result = checker.check("foo <- function() 1\n");
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });

  it("returns C checker for c", () => {
    const checker = getChecker("c", config);
    const result = checker.check("int foo(void);\n");
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
  });

  it("returns C++ checker for cpp", () => {
    const checker = getChecker("cpp", config);
    const result = checker.check("int foo() { return 0; }\n");
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].name, "foo");
    assert.equal(result.missing[0].kind, "function");
  });

  it("applies strictMode to C/C++ checkers", () => {
    const strict = getChecker("c", { ...config, strictMode: true });
    assert.equal(strict.check("static int helper(void);\n").missing.length, 1);
    const lenient = getChecker("c", { ...config, strictMode: false });
    assert.equal(lenient.check("static int helper(void);\n").missing.length, 0);
  });

  it("throws for unsupported language", () => {
    assert.throws(() => {
      // @ts-expect-error testing invalid input
      getChecker("go", config);
    });
  });
});
