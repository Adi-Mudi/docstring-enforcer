# Docstring Enforcer

A Pi CLI extension that checks JavaScript, TypeScript, Google Apps Script, and Python files for missing docstrings after every `write` or `edit` tool call. When missing docstrings are found, it sends a steer message prompting the AI to add them.

## Features

- Supports `.js`, `.ts`, `.tsx`, `.gs`, and `.py` files.
- JSDoc enforcement for JS/TS/GAS.
- Google-style or NumPy-style docstring enforcement for Python.
- Configurable ignore list.
- Informative messages for unsupported file types.
- First-time Python style selection prompt.

## Installation

Load the extension in Pi:

```bash
pi -e /path/to/.pi/docstring-enforcer
```

To load it automatically for a project, add it to your Pi configuration.

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
    ".scss"
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
    ".py": "python"
  },
  "pythonStyle": null
}
```

For Python projects, set `pythonStyle` to `"google"` or `"numpy"`.

## Usage

1. Start Pi with the extension loaded.
2. Ask Pi to write or edit a supported source file.
3. If any function, method, class, getter, or setter is missing a docstring, the extension sends a steer message.
4. The AI adds the missing docstrings.

## Architecture

```
.pi/docstring-enforcer/
├── docstring-enforcer.ts       # Main engine
├── docstring_config.json       # Configuration
├── factories/
│   ├── index.ts                # Language detector and loader
│   ├── js-docstring-checker.ts # JS/TS/GAS checker
│   └── python-docstring-checker.ts # Python checker
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
