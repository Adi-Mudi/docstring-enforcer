import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { cppDocstringChecker } from "../factories/cpp-docstring-checker.ts";

const fixture = readFileSync(
  new URL("./fixtures/cpp-sample.cpp", import.meta.url),
  "utf-8",
);

/**
 * Run the C++ checker over source text.
 * @param {string} src - C++ source to check.
 * @param {boolean} [strict=false] - Extend coverage to private/static entities.
 * @returns {import("../factories/index.ts").CheckResult} Check result with missing docs.
 */
const check = (src: string, strict = false) => cppDocstringChecker(strict).check(src);

test("flags an undocumented free function", () => {
  const { missing } = check("int foo(int x) { return x; }\n");
  assert.equal(missing.length, 1);
  assert.equal(missing[0].name, "foo");
  assert.equal(missing[0].kind, "function");
});

test("passes a ///-documented free function", () => {
  const src = "/// Does foo and bar.\n/// \\param Baz kind of foo.\nbool fooBar(bool Baz);\n";
  assert.equal(check(src).missing.length, 0);
});

test("passes a /** */-documented free function", () => {
  const src = "/**\n * Add two values.\n * @param a first\n * @param b second\n */\nint add(int a, int b);\n";
  assert.equal(check(src).missing.length, 0);
});

test("undocumented class flagged; documented class passes", () => {
  const bad = "class Table {\n public:\n  int size() const;\n};\n";
  const badResult = check(bad);
  assert.ok(badResult.missing.some((m) => m.name === "Table"));
  const good = "/** A lookup table. */\nclass Table {\n public:\n  /// Number of slots.\n  int size() const;\n};\n";
  assert.equal(check(good).missing.length, 0);
});

test("public method without doc is flagged; private is not (default)", () => {
  const src =
    "class Table {\n public:\n  int size() const;\n private:\n  void log_lookup();\n};\n";
  const { missing } = check(src);
  const names = missing.map((m) => m.name);
  assert.ok(names.includes("size"));
  assert.ok(!names.includes("log_lookup"));
});

test("private method flagged under strictMode", () => {
  const src = "/** A table. */\nclass Table {\n private:\n  void log_lookup();\n};\n";
  assert.equal(check(src).missing.length, 0);
  const strictNames = check(src, true).missing.map((m) => m.name);
  assert.ok(strictNames.includes("log_lookup"));
});

test("override methods are exempt (Google style)", () => {
  const src =
    "/** Base interface. */\nclass Base {\n public:\n  /// Resets state.\n  virtual void Reset();\n};\n\n/**\n * Derived table.\n */\nclass Derived : public Base {\n public:\n  void Reset() override;\n};\n";
  assert.equal(check(src).missing.length, 0);
});

test("= delete and = default declarations are exempt", () => {
  const src =
    "/** An iterator. */\nclass GargantuanTableIterator {\n public:\n  GargantuanTableIterator() = delete;\n  ~Table() = default;\n};\n";
  assert.equal(check(src).missing.length, 0);
});

test("anonymous namespace contents are exempt", () => {
  const src = "namespace internal {\nnamespace {\nint helper_count(int x) { return x; }\n}\n}\n";
  assert.equal(check(src).missing.length, 0);
});

test("static free function: default exempt, strictMode flags", () => {
  const src = "static int helper(int x);\n";
  // static free functions live at depth 0; reportable in strict mode only
  assert.equal(check(src, true).missing.length, 1);
});

test("operator overload flagged when undocumented", () => {
  const src = "int operator+(const Table& a, const Table& b);\n";
  const { missing } = check(src);
  assert.equal(missing.length, 1);
});

test("trailing ///< documents a member", () => {
  const src = "class Config {\n public:\n  int retries;  ///< retry count\n};\n";
  const { missing } = check(src);
  assert.equal(missing.filter((m) => m.name === "retries").length, 0);
});

test("enum class flagged when undocumented", () => {
  const src = "enum class Color { Red, Green, Blue };\n";
  assert.equal(check(src).missing.length, 1);
});

test("forward declaration (no body) is not flagged", () => {
  const src = "class GargantuanTableIterator;\n";
  assert.equal(check(src).missing.length, 0);
});

test("fixture: expected flagged names", () => {
  const { missing } = check(fixture);
  const names = missing.map((m) => m.name);
  // kMaxSize not tracked (const var, v1 skips), helper_count in anon ns exempt,
  // Color enum undocumented, Table documented, GargantuanTable documented,
  // Seek documented, done() NOT documented -> flagged, Reset override exempt,
  // GargantuanTableIterator() = delete exempt, log_lookup private (exempt default),
  // fooBar documented, operator+ and Config flagged
  assert.ok(names.includes("done"));
  assert.ok(names.includes("operator+"));
  assert.ok(names.includes("Config"));
  assert.ok(!names.includes("fooBar"));
  assert.ok(!names.includes("Table"));
  assert.ok(!names.includes("Seek"));
  assert.ok(!names.includes("Reset"));
  assert.ok(!names.includes("helper_count"));
  assert.ok(!names.includes("log_lookup"));
});
