import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { newURL } from "node:url";
import { rDocstringChecker } from "../factories/r-docstring-checker.ts";

const fixture = readFileSync(
  new URL("./fixtures/r-sample.R", import.meta.url),
  "utf-8",
);

test("flags an undocumented top-level function", () => {
  const { missing } = rDocstringChecker.check(
    "my_fun <- function(x) {\n  x + 1\n}\n",
  );
  assert.equal(missing.length, 1);
  assert.equal(missing[0].name, "my_fun");
  assert.equal(missing[0].kind, "function");
  assert.equal(missing[0].line, 1);
});

test("passes a roxygen2-documented function", () => {
  const src =
    "#' Add one\n#'\n#' @param x A number.\n#' @returns A number.\nmy_fun <- function(x) {\n  x + 1\n}\n";
  const { missing } = rDocstringChecker.check(src);
  assert.equal(missing.length, 0);
});

test("plain # comments do not count as documentation", () => {
  const src = "# just a comment\nmy_fun <- function(x) x\n";
  const { missing } = rDocstringChecker.check(src);
  assert.equal(missing.length, 1);
});

test("@noRd opt-out is exempt", () => {
  const src =
    "#' Internal\n#' @noRd\ninternal_util <- function(x) x * 2\n";
  const { missing } = rDocstringChecker.check(src);
  assert.equal(missing.length, 0);
});

test("S3 methods are not flagged (optional by design)", () => {
  const src = "print.myclass <- function(x, ...) cat(\"<myclass>\\n\")\n";
  const { missing } = rDocstringChecker.check(src);
  assert.equal(missing.length, 0);
});

test("S4 setMethod without block is flagged; with block passes", () => {
  const bad = "setMethod(\"show\", \"Account\", function(object) object)\n";
  assert.equal(rDocstringChecker.check(bad).missing.length, 1);
  const good =
    "#' Show an account\n#' @param object An object.\nsetMethod(\"show\", \"Account\", function(object) object)\n";
  assert.equal(rDocstringChecker.check(good).missing.length, 0);
});

test("replacement function and infix operator are flagged when undocumented", () => {
  const src =
    "`loud_name<-` <- function(x, value) x\n\n`%between%` <- function(x, r) x\n";
  const { missing } = rDocstringChecker.check(src);
  assert.equal(missing.length, 2);
  assert.equal(missing[0].name, "loud_name<-");
  assert.equal(missing[1].name, "%between%");
});

test("anonymous functions assigned to a name via lapply are not flagged", () => {
  const src = "result <- lapply(1:3, function(x) x * 2)\n";
  const { missing } = rDocstringChecker.check(src);
  assert.equal(missing.length, 0);
});

test("R6Class definition flagged without block, passes with block", () => {
  const bad = "Person <- R6::R6Class(\"Person\", public = list())\n";
  assert.equal(rDocstringChecker.check(bad).missing.length, 1);
  const good =
    "#' A person\nPerson <- R6::R6Class(\"Person\", public = list())\n";
  assert.equal(rDocstringChecker.check(good).missing.length, 0);
});

test("fixture: expected flagged names and lines", () => {
  const { missing } = rDocstringChecker.check(fixture);
  const names = missing.map((m) => m.name);
  assert.deepEqual(names, [
    "calc_mean",
    "loud_name<-",
    "%between%",
    "setGeneric(\"balance\")",
    "local_helper",
  ]);
  // calc_mean is line 4 of the fixture
  assert.equal(missing[0].line, 4);
  // Person (R6) is documented in the fixture — must NOT be flagged
  assert.ok(!names.includes("Person"));
});
