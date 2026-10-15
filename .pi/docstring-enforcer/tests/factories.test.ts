import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  isIgnored,
  detectLanguage,
  getSupportedExtensions,
  getChecker,
} from "../factories/index.ts";

describe("factories", () => {
  describe("loadConfig", () => {
    it("creates default config when file is missing", () => {
      const path = join(tmpdir(), `missing-config-${Date.now()}.json`);
      const config = loadConfig(path);
      assert.ok(existsSync(path));
      assert.ok(config.supportedLanguages[".ts"]);
      assert.ok(config.supportedLanguages[".mjs"]);
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

    it("ignores excalidraw and database/sql files", () => {
      assert.equal(isIgnored("/project/notes.excalidraw", config), true);
      assert.equal(isIgnored("/project/data.db", config), true);
      assert.equal(isIgnored("/project/data.sqlite", config), true);
      assert.equal(isIgnored("/project/data.sqlite3", config), true);
      assert.equal(isIgnored("/project/schema.sql", config), true);
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

    it("detects Rust", () => {
      assert.equal(detectLanguage("/project/foo.rs", config), "rust");
    });

    it("returns undefined for unsupported files", () => {
      assert.equal(detectLanguage("/project/foo.go", config), undefined);
    });

    // Phase 4 — new languages
    it("detects R", () => {
      assert.equal(detectLanguage("/project/foo.R", config), "r");
      assert.equal(detectLanguage("/project/foo.r", config), "r");
    });

    it("detects C", () => {
      assert.equal(detectLanguage("/project/foo.c", config), "c");
    });

    it("detects C++ from .cpp and .hpp", () => {
      assert.equal(detectLanguage("/project/foo.cpp", config), "cpp");
      assert.equal(detectLanguage("/project/foo.hpp", config), "cpp");
    });

    it("does not map .h to C (research D3: ambiguous)", () => {
      assert.equal(detectLanguage("/project/foo.h", config), undefined);
    });
  });

  describe("getChecker (Phase 4 smoke)", () => {
    const config = loadConfig(join(tmpdir(), `checker-config-${Date.now()}.json`));

    it("returns a working checker for r/c/cpp", () => {
      for (const lang of ["r", "c", "cpp"] as const) {
        const checker = getChecker(lang, config);
        assert.equal(typeof checker.check, "function");
        const { missing } = checker.check("");
        assert.ok(Array.isArray(missing));
      }
    });

    it("defaults strictMode to false in config", () => {
      assert.equal(config.strictMode, false);
    });
  });

  describe("getSupportedExtensions", () => {
    const config = loadConfig(join(tmpdir(), `supported-config-${Date.now()}.json`));

    it("returns supported extensions", () => {
      const exts = getSupportedExtensions(config);
      assert.ok(exts.includes(".ts"));
      assert.ok(exts.includes(".py"));
      assert.ok(exts.includes(".rs"));
    });
  });
});
