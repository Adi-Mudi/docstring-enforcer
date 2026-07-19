import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, isIgnored, detectLanguage, getSupportedExtensions } from "../factories/index.ts";

describe("factories", () => {
  describe("loadConfig", () => {
    it("creates default config when file is missing", () => {
      const path = join(tmpdir(), `missing-config-${Date.now()}.json`);
      const config = loadConfig(path);
      assert.ok(existsSync(path));
      assert.ok(config.supportedLanguages[".ts"]);
      unlinkSync(path);
    });
  });

  describe("isIgnored", () => {
    const config = loadConfig(join(tmpdir(), `ignore-config-${Date.now()}.json`));

    it("ignores markdown files", () => {
      assert.equal(isIgnored("/project/README.md", config), true);
    });

    it("ignores node_modules paths", () => {
      assert.equal(isIgnored("/project/node_modules/foo.ts", config), true);
    });

    it("does not ignore supported source files", () => {
      assert.equal(isIgnored("/project/src/foo.ts", config), false);
    });

    it("ignores build output folders", () => {
      assert.equal(isIgnored("/project/dist/bundle.js", config), true);
    });
  });

  describe("detectLanguage", () => {
    const config = loadConfig(join(tmpdir(), `detect-config-${Date.now()}.json`));

    it("detects TypeScript", () => {
      assert.equal(detectLanguage("/project/foo.ts", config), "javascript");
    });

    it("detects Python", () => {
      assert.equal(detectLanguage("/project/foo.py", config), "python");
    });

    it("returns undefined for unsupported files", () => {
      assert.equal(detectLanguage("/project/foo.rs", config), undefined);
    });
  });

  describe("getSupportedExtensions", () => {
    const config = loadConfig(join(tmpdir(), `supported-config-${Date.now()}.json`));

    it("returns supported extensions", () => {
      const exts = getSupportedExtensions(config);
      assert.ok(exts.includes(".ts"));
      assert.ok(exts.includes(".py"));
    });
  });
});
