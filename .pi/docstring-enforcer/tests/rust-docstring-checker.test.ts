import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rustDocstringChecker } from "../factories/rust-docstring-checker.ts";

const here = dirname(fileURLToPath(import.meta.url));

function names(src: string): string[] {
  return rustDocstringChecker.check(src).missing.map((m) => m.name);
}

function kinds(src: string): string[] {
  return rustDocstringChecker.check(src).missing.map((m) => m.kind);
}

describe("rustDocstringChecker", () => {
  it("flags an undocumented public function", () => {
    const src = "pub fn foo() {}\n";
    assert.deepEqual(names(src), ["foo"]);
    assert.deepEqual(kinds(src), ["function"]);
    assert.equal(rustDocstringChecker.check(src).missing[0].line, 1);
  });

  it("accepts `///` above the item", () => {
    assert.deepEqual(names("/// Docs.\npub fn foo() {}\n"), []);
  });

  it("accepts a `/** */` block doc", () => {
    assert.deepEqual(names("/**\n * Docs.\n */\npub fn foo() {}\n"), []);
  });

  it("accepts `#[doc = \"...\"]`", () => {
    assert.deepEqual(names('#[doc = "Docs."]\npub fn foo() {}\n'), []);
  });

  it("accepts a doc comment placed above an attribute", () => {
    assert.deepEqual(names("/// Docs.\n#[inline]\npub fn foo() {}\n"), []);
  });

  it("accepts a doc comment above a multi-line attribute", () => {
    assert.deepEqual(names("/// Docs.\n#[cfg(all(\n    feature = \"x\",\n))]\npub fn foo() {}\n"), []);
  });

  it("treats `////` as a plain comment", () => {
    assert.deepEqual(names("//// not a doc\npub fn foo() {}\n"), ["foo"]);
  });

  it("treats `/***/` as a plain comment", () => {
    assert.deepEqual(names("/***/\npub fn foo() {}\n"), ["foo"]);
  });

  it("ignores items inside string literals and comments", () => {
    const src = 'const S: &str = "pub fn not_real() {}";\n// pub fn commented() {}\n/* pub fn blocked() {} */\n';
    assert.deepEqual(names(src), []);
  });

  it("ignores a `pub fn` inside a raw string", () => {
    const src = 'const S: &str = r#"pub fn not_real() {}"#;\n';
    assert.deepEqual(names(src), []);
  });

  it("does not confuse lifetimes with char literals", () => {
    const src = "/// Docs.\npub fn foo<'a>(x: &'a str) -> &'a str { x }\n";
    assert.deepEqual(names(src), []);
  });

  it("does not flag a private function", () => {
    assert.deepEqual(names("fn foo() {}\n"), []);
  });

  it("does not flag `pub(crate)`", () => {
    assert.deepEqual(names("pub(crate) fn foo() {}\npub(super) struct Bar;\n"), []);
  });

  it("hides children of a `pub(crate)` module", () => {
    const src = "pub(crate) mod m {\n    pub fn foo() {}\n    pub struct Bar;\n}\n";
    assert.deepEqual(names(src), []);
  });

  it("checks children of a public module", () => {
    const src = "/// Docs.\npub mod m {\n    pub fn foo() {}\n}\n";
    assert.deepEqual(names(src), ["foo"]);
  });

  it("flags a struct, its public field, and skips private fields", () => {
    const src = "/// Docs.\npub struct S {\n    pub a: u8,\n    b: u8,\n}\n";
    assert.deepEqual(names(src), ["a"]);
    assert.deepEqual(kinds(src), ["field"]);
  });

  it("never checks tuple-struct fields", () => {
    assert.deepEqual(names("/// Docs.\npub struct S(pub u8);\n"), []);
  });

  it("flags enum variants that inherit the enum's reachability", () => {
    const src = "/// Docs.\npub enum E {\n    A,\n    B(u8),\n}\n";
    assert.deepEqual(names(src), ["A", "B"]);
    assert.deepEqual(kinds(src), ["variant", "variant"]);
  });

  it("does not flag variants of a private enum", () => {
    assert.deepEqual(names("enum E {\n    A,\n}\n"), []);
  });

  it("flags trait members without needing `pub`", () => {
    const src = "/// Docs.\npub trait T {\n    type Item;\n    fn go(&self);\n}\n";
    assert.deepEqual(names(src), ["Item", "go"]);
    assert.deepEqual(kinds(src), ["typeAlias", "method"]);
  });

  it("flags `pub fn` in an impl of a public type", () => {
    const src = "/// Docs.\npub struct S;\nimpl S {\n    pub fn go(&self) {}\n}\n";
    assert.deepEqual(names(src), ["go"]);
  });

  it("does not flag `pub fn` in an impl of a private type", () => {
    const src = "/// Docs.\npub mod m {\n    struct P;\n    impl P {\n        pub fn go(&self) {}\n    }\n}\n";
    assert.deepEqual(names(src), []);
  });

  it("does not flag a `pub const` inside a function body", () => {
    const src = "/// Docs.\npub fn f() {\n    const X: u8 = 1;\n}\n";
    assert.deepEqual(names(src), []);
  });

  it("flags public const, static, type alias, and union", () => {
    const src = "pub const A: u8 = 1;\npub static B: u8 = 2;\npub type C = u8;\npub union U {\n    pub x: u8,\n}\n";
    assert.deepEqual(names(src), ["A", "B", "C", "U", "x"]);
    assert.deepEqual(kinds(src), ["constant", "static", "typeAlias", "union", "field"]);
  });

  it("flags an exported macro and ignores a crate-local one", () => {
    const src = "#[macro_export]\nmacro_rules! exported { () => {} }\nmacro_rules! internal { () => {} }\n";
    assert.deepEqual(names(src), ["exported"]);
    assert.deepEqual(kinds(src), ["macro"]);
  });

  it("honours `#[allow(missing_docs)]` on an item", () => {
    assert.deepEqual(names("#[allow(missing_docs)]\npub fn foo() {}\n"), []);
  });

  it("honours `#[allow(missing_docs)]` on a module", () => {
    assert.deepEqual(names("#[allow(missing_docs)]\npub mod m {\n    pub fn foo() {}\n}\n"), []);
  });

  it("honours `#[doc(hidden)]` on an item and on a field", () => {
    const src = "#[doc(hidden)]\npub fn foo() {}\n/// Docs.\npub struct S {\n    #[doc(hidden)]\n    pub secret: u8,\n}\n";
    assert.deepEqual(names(src), []);
  });

  it("handles nested modules", () => {
    const src = "/// Docs.\npub mod a {\n    /// Docs.\n    pub mod b {\n        pub fn deep() {}\n    }\n}\n";
    assert.deepEqual(names(src), ["deep"]);
  });

  it("handles async, const, and unsafe fn modifiers", () => {
    const src = "pub async fn a() {}\npub const fn b() {}\npub unsafe fn c() {}\npub unsafe trait D {}\n";
    assert.deepEqual(names(src), ["a", "b", "c", "D"]);
  });

  it("reports correct line numbers across a multi-item file", () => {
    const src = "//! Crate.\n\n/// Docs.\npub fn ok() {}\n\npub fn bad() {}\n";
    const result = rustDocstringChecker.check(src);
    assert.equal(result.missing.length, 1);
    assert.equal(result.missing[0].line, 6);
  });

  it("matches rustc on the sample fixture", () => {
    const fixture = readFileSync(join(here, "fixtures", "rust-sample.rs"), "utf-8");
    assert.deepEqual(names(fixture), ["missingFn", "missingField", "V2", "missingMethod"]);
  });

  it("returns no findings for a fully documented file", () => {
    assert.deepEqual(names("//! Crate.\n\n/// Docs.\npub fn foo() {}\n"), []);
  });
});
