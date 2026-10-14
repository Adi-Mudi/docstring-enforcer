import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { jsDocstringChecker } from "./js-docstring-checker.ts";
import { pythonDocstringChecker } from "./python-docstring-checker.ts";
import { rustDocstringChecker } from "./rust-docstring-checker.ts";

export type Language = "javascript" | "python" | "rust";

export interface MissingDocstring {
  name: string;
  kind:
    | "function"
    | "method"
    | "class"
    | "getter"
    | "setter"
    | "struct"
    | "field"
    | "enum"
    | "variant"
    | "trait"
    | "union"
    | "module"
    | "constant"
    | "static"
    | "typeAlias"
    | "macro";
  line: number;
}

export interface CheckResult {
  missing: MissingDocstring[];
}

export interface DocstringChecker {
  check(content: string): CheckResult;
}

export interface Config {
  ignoreExtensions: string[];
  ignorePatterns: string[];
  ignoreFiles: string[];
  supportedLanguages: Record<string, Language>;
  pythonStyle: "google" | "numpy" | null;
}

const DEFAULT_CONFIG: Config = {
  ignoreExtensions: [
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".csv",
    ".html",
    ".css",
    ".scss",
    ".less",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".excalidraw",
    ".db",
    ".sqlite",
    ".sqlite3",
    ".sql",
  ],
  ignorePatterns: [
    "node_modules/",
    ".git/",
    "dist/",
    "build/",
    "out/",
    "coverage/",
    ".next/",
    ".venv/",
    "venv/",
    "__pycache__/",
  ],
  ignoreFiles: [
    "README.md",
    "LICENSE",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
    ".env",
    ".env.example",
    ".gitignore",
    ".piignore",
  ],
  supportedLanguages: {
    ".js": "javascript",
    ".ts": "javascript",
    ".tsx": "javascript",
    ".gs": "javascript",
    ".py": "python",
    ".rs": "rust",
  },
  pythonStyle: null,
};

/**
 * Merges a partial loaded config over the defaults, falling back per field.
 * @param {Partial<Config>} loaded - Parsed config values from disk (any field may be missing).
 * @returns {Config} A complete config with defaults applied for missing fields.
 */
function mergeConfig(loaded: Partial<Config>): Config {
  return {
    ignoreExtensions: loaded.ignoreExtensions ?? DEFAULT_CONFIG.ignoreExtensions,
    ignorePatterns: loaded.ignorePatterns ?? DEFAULT_CONFIG.ignorePatterns,
    ignoreFiles: loaded.ignoreFiles ?? DEFAULT_CONFIG.ignoreFiles,
    supportedLanguages: loaded.supportedLanguages ?? DEFAULT_CONFIG.supportedLanguages,
    pythonStyle: loaded.pythonStyle ?? DEFAULT_CONFIG.pythonStyle,
  };
}

export function loadConfig(configPath: string): Config {
  try {
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<Config>;
      return mergeConfig(parsed);
    }
    // If config does not exist, write a default one so the user can edit it.
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf-8");
    return { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function detectLanguage(filePath: string, config: Config): Language | undefined {
  const lowerPath = filePath.toLowerCase();

  // Check exact file-name matches first (e.g. *.min.js should not be treated as .js).
  for (const [pattern, language] of Object.entries(config.supportedLanguages)) {
    if (lowerPath.endsWith(pattern)) {
      return language;
    }
  }

  return undefined;
}

export function isIgnored(filePath: string, config: Config): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();
  const fileName = normalizedPath.split("/").pop() ?? "";

  // Ignore by exact file name.
  for (const ignoredFile of config.ignoreFiles) {
    if (fileName === ignoredFile.toLowerCase()) {
      return true;
    }
  }

  // Ignore by extension.
  for (const ext of config.ignoreExtensions) {
    if (fileName.endsWith(ext.toLowerCase())) {
      return true;
    }
  }

  // Ignore by path pattern.
  for (const pattern of config.ignorePatterns) {
    const lowerPattern = pattern.toLowerCase().replace(/\\/g, "/");
    if (normalizedPath.includes(lowerPattern)) {
      return true;
    }
  }

  return false;
}

export function getChecker(language: Language, config: Config): DocstringChecker {
  if (language === "javascript") {
    return jsDocstringChecker;
  }
  if (language === "python") {
    return pythonDocstringChecker(config.pythonStyle ?? "google");
  }
  if (language === "rust") {
    return rustDocstringChecker;
  }
  throw new Error(`No docstring checker available for language: ${language}`);
}

export function getSupportedExtensions(config: Config): string[] {
  return Object.keys(config.supportedLanguages);
}
