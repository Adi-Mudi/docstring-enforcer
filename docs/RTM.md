# Requirements Traceability Matrix — Docstring Enforcer

| ID | Requirement | Implementation | Tests |
| --- | --- | --- | --- |
| FR-001 | Listen to write/edit tool_result events | `docstring-enforcer.ts` `pi.on("tool_result", ...)` | `integration.test.ts` |
| FR-002 | Detect supported file types | `factories/index.ts` `detectLanguage()` | `factories.test.ts`, `integration.test.ts` |
| FR-003 | Ignore configured files/paths | `factories/index.ts` `isIgnored()` | `factories.test.ts`, `integration.test.ts` |
| FR-004 | Detect missing JSDoc in JS/TS/GAS | `js-docstring-checker.ts` | `js-docstring-checker.test.ts` |
| FR-005 | Detect missing Python docstrings | `python-docstring-checker.ts` | `python-docstring-checker.test.ts` |
| FR-006 | Send steer message | `docstring-enforcer.ts` `pi.sendUserMessage(...)` | `integration.test.ts`, `messages.test.ts` |
| FR-007 | Ask Python style on first .py file | `docstring-enforcer.ts` `askPythonStyleMessage()` | `integration.test.ts`, `messages.test.ts` |
| FR-008 | Inform user for unsupported file type | `docstring-enforcer.ts` `buildUnsupportedMessage()` | `messages.test.ts` |
| FR-009 | Detect missing Rustdoc in Rust | `rust-docstring-checker.ts` | `rust-docstring-checker.test.ts`, `checker-dispatch.test.ts`, `integration.test.ts` |
| FR-010 | Detect missing Roxygen2 blocks in R | `r-docstring-checker.ts` | `r-docstring-checker.test.ts`, `checker-dispatch.test.ts` |
| FR-011 | Detect missing Doxygen/kernel-doc blocks in C | `c-docstring-checker.ts` | `c-docstring-checker.test.ts`, `checker-dispatch.test.ts` |
| FR-012 | Detect missing Doxygen blocks in C++ | `cpp-docstring-checker.ts` | `cpp-docstring-checker.test.ts`, `checker-dispatch.test.ts` |
| NFR-001 | No auto-fix | `docstring-enforcer.ts` only sends steer | `integration.test.ts` |
| NFR-002 | Configurable via JSON | `docstring_config.json` + `loadConfig()` | `factories.test.ts` |
| NFR-003 | Extensible language architecture | `factories/index.ts` + per-language checkers | `checker-dispatch.test.ts` |
| NFR-004 | Comprehensive tests | Test suite in `.pi/docstring-enforcer/tests/` | `npx tsx --test ...` |
| NFR-005 | Minimal dependencies | Uses Node.js built-ins + `@earendil-works/pi-coding-agent` types | `package.json` |
| — | Pi auto-discovery entry point | `.pi/docstring-enforcer/index.ts` | Manual verification via symlink |
