# Contributing to Docstring Enforcer

## Getting Started

1. Clone or navigate to the project.
2. Symlink the extension into Pi's global extensions folder for live development:
   ```bash
   ln -s /path/to/project/.pi/docstring-enforcer ~/.pi/agent/extensions/docstring-enforcer
   ```
3. Start Pi and run `/reload`.

The entry point is `.pi/docstring-enforcer/index.ts`. Pi auto-discovers it from the symlinked folder.

## Running Tests

```bash
npx tsx --test .pi/docstring-enforcer/tests/**/*.test.ts
```

All tests should pass before submitting changes.

## Adding a New Language

1. Create a new checker in `.pi/docstring-enforcer/factories/<language>-docstring-checker.ts`.
2. Export a `DocstringChecker` implementation.
3. Register the extension in `docstring_config.json` under `supportedLanguages`.
4. Add unit tests in `.pi/docstring-enforcer/tests/<language>-docstring-checker.test.ts`.
5. Update `README.md`, `PRD.md`, and `RTM.md`.

## Code Style

- Use TypeScript.
- Follow existing patterns in the codebase.
- Add tests for new logic.
- Keep functions small and focused.

## Submitting Changes

1. Update `CHANGELOG.md` with a clear description.
2. Ensure all tests pass.
3. Update documentation if behavior changes.
4. Submit a pull request.
