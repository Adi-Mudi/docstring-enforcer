# Product Requirements Document — Docstring Enforcer

## Overview

Docstring Enforcer is a Pi CLI extension that ensures code written by the AI is properly documented.

## Problem

AI coding agents often write functions, methods, and classes without docstrings. This hurts:
- Code readability
- Developer onboarding
- Long-term maintainability
- Generated API documentation

## Goal

After every file write or edit, automatically detect missing docstrings and prompt the AI to add them.

## Target Users

- Beginner, intermediate, and advanced developers using Pi CLI.
- Teams who want consistent documentation standards.
- Open-source maintainers who want contributions to include docs.

## Supported Languages

| Language | File Extensions | Docstring Style |
| --- | --- | --- |
| JavaScript | `.js` | JSDoc |
| TypeScript | `.ts`, `.tsx` | JSDoc |
| Google Apps Script | `.gs` | JSDoc |
| Python | `.py` | Google or NumPy |
| Rust | `.rs` | Rustdoc (`///`) |
| R | `.r`, `.R` | Roxygen2 (`#'`) |
| C | `.c` | Doxygen / kernel-doc (`/** */`, `//!`) |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh`, `.hxx` | Doxygen (`/** */`, `///`, `//!`) |

## Functional Requirements

1. **FR-001**: Listen to `write` and `edit` `tool_result` events.
2. **FR-002**: Detect supported file types by extension.
3. **FR-003**: Ignore configured file types, path patterns, and specific files.
4. **FR-004**: Detect missing JSDoc in JS/TS/GAS functions, methods, getters, and setters.
5. **FR-005**: Detect missing docstrings in Python functions, async functions, and classes.
6. **FR-006**: Send a steer message when missing docstrings are found.
7. **FR-007**: Ask the user to configure Python style on first Python file.
8. **FR-008**: Inform the user when an unsupported file type is encountered.
9. **FR-009**: Detect missing Rustdoc in Rust items that rustc's `missing_docs` lint would flag.
10. **FR-010**: Detect missing Roxygen2 comment blocks in R functions, S4 methods/classes/slots, and replacement functions; honor `@noRd` and skip S3 methods / anonymous functions.
11. **FR-011**: Detect missing Doxygen/kernel-doc comment blocks in C functions, structs, typedefs, and macros; exempt `static` internals unless `strictMode` is enabled; dedupe by symbol name across the file.
12. **FR-012**: Detect missing Doxygen comment blocks in C++ free functions, class/struct definitions, enums, operator overloads, and public member functions; exempt `override`/`= delete`/`= default` declarations, constructors/destructors, anonymous-namespace entities, and private members (unless `strictMode`).

## Non-Functional Requirements

1. **NFR-001**: No auto-fix; only warn/prompt.
2. **NFR-002**: Configurable via JSON file.
3. **NFR-003**: Extensible architecture for adding new languages.
4. **NFR-004**: Comprehensive unit and integration tests.
5. **NFR-005**: Minimal dependencies; use built-in Node.js modules where possible.

## Out of Scope

- Auto-fixing missing docstrings.
- Checking inline comments.
- Linting docstring quality or completeness.
- Support for languages other than JS/TS/GAS, Python, Rust, R, C, and C++.
- Mapping the ambiguous `.h` extension to C or C++ (projects can map it themselves).

## Installation / Distribution

- The extension is loaded by Pi via auto-discovery from `~/.pi/agent/extensions/docstring-enforcer/`.
- The entry point is `index.ts`.
- A symlink from the project folder to the Pi extensions folder is the recommended development setup.
- A global symlink has been created and verified on the development machine.

## Success Criteria

- All supported file types trigger a steer message when docstrings are missing.
- No false positives for ignored files.
- No false positives for functions/methods that already have docstrings.
- Tests cover all public functions and integration scenarios.
- Symlink installation works and live edits reflect after `/reload`.
