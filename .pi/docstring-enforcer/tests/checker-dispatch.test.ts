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

  it("throws for unsupported language", () => {
    assert.throws(() => {
      // @ts-expect-error testing invalid input
      getChecker("go", config);
    });
  });
});
