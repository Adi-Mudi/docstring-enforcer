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

## Functional Requirements

1. **FR-001**: Listen to `write` and `edit` `tool_result` events.
2. **FR-002**: Detect supported file types by extension.
3. **FR-003**: Ignore configured file types, path patterns, and specific files.
4. **FR-004**: Detect missing JSDoc in JS/TS/GAS functions, methods, getters, and setters.
5. **FR-005**: Detect missing docstrings in Python functions, async functions, and classes.
6. **FR-006**: Send a steer message when missing docstrings are found.
7. **FR-007**: Ask the user to configure Python style on first Python file.
8. **FR-008**: Inform the user when an unsupported file type is encountered.

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
- Support for languages other than JS/TS/GAS and Python in v1.0.0.

## Success Criteria

- All supported file types trigger a steer message when docstrings are missing.
- No false positives for ignored files.
- No false positives for functions/methods that already have docstrings.
- Tests cover all public functions and integration scenarios.
