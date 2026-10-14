# Changelog

## [1.1.0] - 2026-10-14

### Added
- Rust support: `.rs` files are now checked for missing doc comments.
- `rust-docstring-checker.ts` mirrors rustc's `missing_docs` lint (public functions, methods, structs, fields, enums, variants, traits, unions, modules, constants, statics, type aliases, exported macros).
- Rust steer message with a `///` example plus `# Errors` / `# Panics` / `# Safety` guidance.

### Known limitations
- Fields and variants written on the same line as their opening brace are not checked.
- Tuple-struct fields are never checked (matches rustc).

## [1.0.0] - 2026-07-19

### Added
- Initial release.
- Support for JavaScript, TypeScript, TSX, Google Apps Script, and Python.
- JSDoc enforcement for JS/TS/GAS.
- Google-style and NumPy-style docstring enforcement for Python.
- Configurable ignore list via `docstring_config.json`.
- Unsupported file type notifications.
- First-time Python style selection prompt.
- `index.ts` entry point for Pi auto-discovery.
- Verified symlink installation steps in README.
- Comprehensive unit and integration tests.
