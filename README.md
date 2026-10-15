# Docstring Enforcer

A Pi CLI extension that checks JavaScript, TypeScript, Google Apps Script, Python, Rust, R, C, and C++ files for missing docstrings after every `write` or `edit` tool call. When missing docstrings are found, it sends a steer message prompting the AI to add them.

## Features

- Supports `.js`, `.ts`, `.tsx`, `.gs`, `.py`, `.rs`, `.r`/`.R`, `.c`, `.cpp`/`.cc`/`.cxx`/`.hpp`/`.hh`/`.hxx` files.
- JSDoc enforcement for JS/TS/GAS.
- Google-style or NumPy-style docstring enforcement for Python.
- Rustdoc enforcement for Rust, mirroring rustc's `missing_docs` lint.
- Roxygen2-style (`#'`) enforcement for R, honoring `@noRd`.
- Doxygen/kernel-doc enforcement for C (static internals exempt unless `strictMode`).
- Doxygen enforcement for C++ (public API by default; `strictMode` extends to private members and static functions).
- Configurable ignore list.
- Informative messages for unsupported file types.
- First-time Python style selection prompt.

## Installation

### Quick test

```bash
pi -e /path/to/.pi/docstring-enforcer/docstring-enforcer.ts
```

### Symlink for development (recommended)

Symlink the extension folder so Pi auto-discovers it. This is best when you want live edits to apply immediately.

Global (all projects):

```bash
ln -s /path/to/your/project/.pi/docstring-enforcer ~/.pi/agent/extensions/docstring-enforcer
```

Project-local (this project only):

```bash
ln -s /path/to/your/project/.pi/docstring-enforcer /path/to/your/project/.pi/extensions/docstring-enforcer
```

Then start Pi or run `/reload`.

> **Verified:** The global symlink has been created and tested. When Pi writes a TypeScript function without JSDoc, the extension sends a steer message and the AI adds a docstring like the example below.

### Install via Pi CLI

```bash
pi install /absolute/path/to/.pi/docstring-enforcer
```

## Configuration

Edit `.pi/docstring-enforcer/docstring_config.json`:

```json
{
  "ignoreExtensions": [
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
    ".sql"
  ],
  "ignorePatterns": [
    "node_modules/",
    ".git/",
    "dist/",
    "build/",
    "out/",
    "coverage/",
    ".next/",
    ".venv/",
    "venv/",
    "__pycache__/"
  ],
  "ignoreFiles": [
    "README.md",
    "LICENSE",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
    ".env",
    ".env.example",
    ".gitignore"
  ],
  "supportedLanguages": {
    ".js": "javascript",
    ".ts": "javascript",
    ".tsx": "javascript",
    ".gs": "javascript",
    ".py": "python",
    ".rs": "rust",
    ".r": "r",
    ".R": "r",
    ".c": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".hh": "cpp",
    ".hxx": "cpp"
  },
  "pythonStyle": null,
  "strictMode": false
}
```

For Python projects, set `pythonStyle` to `"google"` or `"numpy"`.

For C/C++, `strictMode` (default `false`) extends coverage: C `static` internals and C++ private members / `static` free functions are also checked. Note that plain `.h` is intentionally not mapped (ambiguous between C and C++) — add it yourself to `supportedLanguages` if your project is unambiguous.

## Usage

1. Start Pi with the extension loaded.
2. Ask Pi to write or edit a supported source file.
3. If any function, method, class, getter, or setter is missing a docstring, the extension sends a steer message.
4. The AI adds the missing docstrings.

## What it looks like

If you ask Pi to create a TypeScript function without a docstring:

```ts
function hello(): string {
    return "world";
}
```

The extension prompts the AI, and the final file becomes:

```ts
/**
 * Returns the string "world".
 * @returns {string} The word "world".
 */
function hello(): string {
    return "world";
}
```

## Architecture

```
.pi/docstring-enforcer/
├── index.ts                    # Entry point for Pi auto-discovery
├── docstring-enforcer.ts       # Main engine
├── docstring_config.json       # Configuration
├── factories/
│   ├── index.ts                # Language detector and loader
│   ├── js-docstring-checker.ts # JS/TS/GAS checker
│   ├── python-docstring-checker.ts # Python checker
│   ├── rust-docstring-checker.ts   # Rust checker
│   ├── r-docstring-checker.ts      # R checker
│   ├── c-docstring-checker.ts      # C checker
│   └── cpp-docstring-checker.ts    # C++ checker
└── tests/                      # Unit and integration tests
```

## Testing

```bash
npx tsx --test .pi/docstring-enforcer/tests/**/*.test.ts
```

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## License

MIT
