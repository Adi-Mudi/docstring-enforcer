# Changelog

## [1.2.0] - 2026-10-15

### Added
- R support: `.r`/`.R` files checked for missing Roxygen2 (`#'`) comment blocks; `@noRd` honored; S3 methods and anonymous functions skipped.
- C support: `.c` files checked for missing Doxygen/kernel-doc blocks on functions, structs, typedefs, and macros; `static` internals exempt unless `strictMode`.
- C++ support: `.cpp`/`.cc`/`.cxx`/`.hpp`/`.hh`/`.hxx` checked for missing Doxygen blocks on free functions, classes/structs, enums, operators, and public members; `override`, `= delete`/`= default`, constructors/destructors, and anonymous-namespace entities exempt.
- New `strictMode` config key (default `false`) extending C/C++ coverage to static internals and private members.

### Known limitations
- The ambiguous `.h` extension is not mapped to C or C++ (add it manually if unambiguous).
- Line-based parsing: wrapped declarations are joined, but exotic macro/brace layouts can be missed.
- C++ trivial accessors (Google-style getters) are still flagged when undocumented.

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
