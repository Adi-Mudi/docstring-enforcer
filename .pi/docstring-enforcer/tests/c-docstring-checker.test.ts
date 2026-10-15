import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { cDocstringChecker } from "../factories/c-docstring-checker.ts";

const fixture = readFileSync(
  new URL("./fixtures/c-sample.c", import.meta.url),
  "utf-8",
);

/**
 * Run the C checker over source text.
 * @param {string} src - C source to check.
 * @param {boolean} [strict=false] - Extend coverage to static entities.
 * @returns {import("../factories/index.ts").CheckResult} Check result with missing docs.
 */
const check = (src: string, strict = false) => cDocstringChecker(strict).check(src);

test("flags an undocumented function", () => {
  const { missing } = check("int foo(int x);\n");
  assert.equal(missing.length, 1);
  assert.equal(missing[0].name, "foo");
  assert.equal(missing[0].kind, "function");
});

test("passes a doxygen-documented function", () => {
  const src =
    "/**\n * Do a thing.\n * @param x input\n * @return status\n */\nint foo(int x);\n";
  assert.equal(check(src).missing.length, 0);
});

test("passes kernel-doc style (opens with /** too)", () => {
  const src =
    "/**\n * foo() - Brief.\n * @x: Input.\n *\n * Return: 0.\n */\nint foo(int x);\n";
  assert.equal(check(src).missing.length, 0);
});

test("passes GNU plain prose comment", () => {
  const src = "/* Compute the difference of two numbers. */\nint sub(int a, int b);\n";
  assert.equal(check(src).missing.length, 0);
});

test("passes /// line-run docs", () => {
  const src = "/// Multiply two values.\nint mul(int a, int b);\n";
  assert.equal(check(src).missing.length, 0);
});

test("banner comment is NOT a doc block", () => {
  const src = "/*********** banner **********/\nint foo(int x);\n";
  assert.equal(check(src).missing.length, 1);
});

test("static function not flagged by default, flagged in strictMode", () => {
  const src = "static int helper(void);\n";
  assert.equal(check(src).missing.length, 0);
  assert.equal(check(src, true).missing.length, 1);
});

test("struct, typedef, and macros are flagged when undocumented", () => {
  const src =
    "struct buffer { char *data; };\n\ntypedef void (*visit_fn)(void *);\n\n#define MAX_RETRIES 5\n\n#define CLAMP(v, lo, hi) ((v) < (lo) ? (lo) : (v))\n";
  const { missing } = check(src);
  const names = missing.map((m) => m.name);
  assert.ok(names.includes("buffer"));
  assert.ok(names.includes("visit_fn"));
  assert.ok(names.includes("MAX_RETRIES"));
  assert.ok(names.includes("CLAMP"));
});

test("documented struct/typedef/macro pass", () => {
  const src =
    "/** Growable byte buffer. */\nstruct buffer { char *data; };\n\n/**\n * typedef visit_fn - Callback per element.\n */\ntypedef void (*visit_fn)(void *);\n\n/**\n * define MAX_RETRIES - Default retry count.\n */\n#define MAX_RETRIES 5\n";
  assert.equal(check(src).missing.length, 0);
});

test("symbol documented at one declaration is not flagged at another (dedupe)", () => {
  const src =
    "/**\n * Parse config.\n * @param path file path\n */\nint parse_config(const char *path);\n\nint parse_config(const char *path) { return 0; }\n";
  const { missing } = check(src);
  assert.equal(missing.length, 0);
});

test("header + bare definition warns once only", () => {
  const src = "int foo(int x);\n\nint foo(int x) { return x; }\n";
  const { missing } = check(src);
  assert.equal(missing.length, 1); // once, not twice
});

test("global variable flagged when undocumented; static var default-exempt", () => {
  const src = "int g_mode;\n\nstatic int counter;\n";
  const { missing } = check(src);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].name, "g_mode");
  assert.equal(check(src, true).missing.length, 2);
});

test("control keywords and includes are not declarations", () => {
  const src = "#include <stdio.h>\n#ifdef FOO\n#endif\nint real(void);\n";
  const { missing } = check(src);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].name, "real");
});

test("wrapped parameter list joins and flags once", () => {
  const src = "int long_function(\n    int alpha,\n    int beta);\n";
  const { missing } = check(src);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].name, "long_function");
});

test("fixture: expected flagged names", () => {
  const { missing } = check(fixture);
  const names = missing.map((m) => m.name);
  assert.deepEqual(names, ["MAX_RETRIES", "CLAMP", "buffer", "visit_fn", "g_mode", "add"]);
  // parse_config documented, hash_key static (exempt), sub/mul documented
  assert.ok(!names.includes("parse_config"));
  assert.ok(!names.includes("sub"));
  assert.ok(!names.includes("mul"));
});
