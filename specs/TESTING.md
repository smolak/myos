# Testing Conventions

This document defines how tests are written, organized, and run in this project. Every AI agent and contributor must read this before implementing any task that involves code (not just types or config).

> **Source of truth:** This file defines testing conventions. `ARCHITECTURE.md` defines the high-level strategy (which tools for which layers). This file defines the how.

---

## Tools

| Layer | Test Runner | Libraries | When to Use |
|---|---|---|---|
| Core services (Bun main process) | `bun:test` | — | Database manager, event bus, action queue, scheduler, feature registry, migration runner |
| Feature logic (Bun side) | `bun:test` | — | Action handlers, query handlers, migrations, idempotency checks |
| UI components (webview) | Vitest | React Testing Library, `@testing-library/jest-dom` | Widgets, dashboard grid, settings panels, any React component |
| E2E | Deferred to phase 2 | — | Manual testing protocol for phase 1 |

**Why two test runners:** Core services and features run in the Bun main process and use `bun:sqlite`, which is only available in Bun. UI components run in the webview (browser-like environment) and need Vitest's jsdom/happy-dom environment for DOM APIs.

---

## File Organization

Tests are **co-located** with the code they test. No separate `__tests__/` directories.

```
src/core/bun/database-manager.ts
src/core/bun/database-manager.test.ts      ← co-located

src/core/bun/event-bus.ts
src/core/bun/event-bus.test.ts             ← co-located

src/features/todo/bun/actions.ts
src/features/todo/bun/actions.test.ts      ← co-located

src/shell/view/App.tsx
src/shell/view/App.test.tsx                ← co-located

src/features/todo/view/TodoWidget.tsx
src/features/todo/view/TodoWidget.test.tsx ← co-located
```

### Naming

- Test files: `{module}.test.ts` or `{Component}.test.tsx`
- Use `.test.` not `.spec.` — one convention, no ambiguity.
- Test file names mirror the source file names exactly.

---

## Running Tests

### Package.json Scripts

```json
{
  "scripts": {
    "test": "bun test --pass-with-no-tests ./src/core/bun ./src/features && vitest run",
    "test:core": "bun test --pass-with-no-tests ./src/core/bun ./src/features",
    "test:ui": "vitest run",
    "test:watch": "bun test --watch --pass-with-no-tests ./src/core/bun ./src/features",
    "test:ui:watch": "vitest"
  }
}
```

- `bun test --pass-with-no-tests ./src/core/bun ./src/features` — runs `*.test.ts` under `src/core/bun/` and anywhere under `src/features/`. The `./` prefixes tell Bun to treat these as paths (not name filters). `--pass-with-no-tests` exits successfully when no files match yet. Vitest is configured with `passWithNoTests: true` so `vitest run` also passes with zero UI tests.
- `vitest run` — runs all `*.test.tsx` files under `src/shell/view/` and `src/features/**/view/` (scoped by the `include` array in `vitest.config.ts`)
- `bun test --watch` and `vitest` (no `run`) for development watch mode

### Running a Single Test File

```bash
bun test src/core/bun/database-manager.test.ts
bunx vitest run src/shell/view/App.test.tsx
```

### No noisy errors in tests run logs

Some tests might produce an (un)expected error, test passes, but the error is logged, producing noise.

No such case can be present. Logs are to be clean.

---

## Writing Tests

### Structure

Use `describe` / `test` blocks. Use `test` (not `it`) for consistency.

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("DatabaseManager", () => {
  describe("getCoreDatabase", () => {
    test("enables WAL mode", () => {
      // ...
    });

    test("runs pending migrations on first open", () => {
      // ...
    });
  });
});
```

### Naming Conventions for Tests

- **`describe` blocks:** name of the class, module, or component being tested.
- **Nested `describe` blocks:** name of the method or behavior group.
- **`test` blocks:** describe the expected behavior in plain English, starting with a verb. No "should" prefix.

```typescript
// Good
test("creates data directories if they do not exist", () => {});
test("returns cached instance on repeated calls", () => {});
test("throws when database is closed", () => {});

// Bad
test("should create data directories", () => {});  // "should" is noise
test("test WAL mode", () => {});                    // "test" is redundant
test("works", () => {});                            // meaningless
```

### Assertions

Use `expect` from the test runner (`bun:test` or Vitest — same API).

Prefer specific matchers over generic ones:

```typescript
// Good
expect(result).toEqual({ applied: ["001"], skipped: [] });
expect(rows).toHaveLength(3);
expect(fn).toThrow(/invalid feature ID/);

// Avoid
expect(result !== null).toBe(true);  // use toEqual or toBeTruthy
expect(rows.length === 3).toBe(true); // use toHaveLength
```

### Setup and Teardown

Use `beforeEach` / `afterEach` for per-test setup and cleanup. Use `beforeAll` / `afterAll` sparingly — only when setup is expensive and safe to share.

```typescript
let manager: DatabaseManager;
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "test-"));
  manager = new DatabaseManager(tmpDir);
});

afterEach(async () => {
  manager.closeAll();
  await rm(tmpDir, { recursive: true, force: true });
});
```

---

## Patterns by Layer

### Core Services (bun:test)

**Database tests:** use a temporary directory per test. Never share database files between tests.

```typescript
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
```

**Event bus / action queue tests:** test in-process. No need for real databases unless the service persists to SQLite — then use the temp directory pattern.

**Async tests:** `bun:test` supports async test functions natively. No special setup needed.

```typescript
test("persists action to database", async () => {
  await queue.enqueue(action);
  const rows = db.query("SELECT * FROM execution_actions").all();
  expect(rows).toHaveLength(1);
});
```

### Feature Logic (bun:test)

**Use real SQLite databases, not mocks.** Features interact with SQLite through `bun:sqlite`. Mocking the database hides real bugs (SQL syntax errors, constraint violations, migration issues).

```typescript
let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");
  // Run feature migrations against in-memory DB
  runMigrations(db, "todo", todoMigrations);
});
```

Use `:memory:` databases for feature logic tests (faster than temp files, sufficient because feature tests don't need persistence across restarts). Use temp directory + real files only when testing the Database Manager itself or behaviors that depend on file-level persistence.

**Test action handlers with realistic inputs.** Include edge cases: empty strings, missing optional fields, duplicate IDs, constraint violations.

**Test idempotency explicitly.** Call the same action twice with the same parameters and verify the result is consistent and no duplicates are created.

### UI Components (Vitest + React Testing Library)

```typescript
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodoWidget } from "./TodoWidget";

describe("TodoWidget", () => {
  test("renders empty state when no items exist", () => {
    render(<TodoWidget items={[]} />);
    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });
});
```

**Test behavior, not implementation.** Query by role, label, or text — not by CSS class or internal component structure.

**Test user interactions:**

```typescript
import { fireEvent } from "@testing-library/react";

test("marks item as complete when checkbox is clicked", () => {
  const onComplete = vi.fn();
  render(<TodoItem item={mockItem} onComplete={onComplete} />);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(onComplete).toHaveBeenCalledWith(mockItem.id);
});
```

---

## What to Test

### Always Test

- **Public API surface.** Every exported function, class method, or component prop combination.
- **Happy path.** The expected normal usage.
- **Edge cases.** Empty inputs, boundary values, missing optional fields.
- **Error cases.** Invalid inputs, constraint violations, expected throws.
- **Idempotency.** For actions: calling twice with the same input produces the same result.
- **State transitions.** For stateful services: verify state after sequences of operations.

### Don't Test

- **Private internals.** Test through the public API. If a private method is complex enough to need its own tests, extract it into a tested utility.
- **Type definitions.** The TypeScript compiler verifies these.
- **Third-party library behavior.** Don't test that SQLite works or that React renders. Test your code's integration with them.
- **Exact log output.** Logs are for debugging, not contracts. Test that the right things happen, not that specific strings are logged.

---

## API Design Guidelines

These apply to all exported functions, classes, and interfaces — not just test code.

### Naming

- **Classes:** PascalCase, noun. `DatabaseManager`, `EventBus`, `ActionQueue`.
- **Methods:** camelCase, verb-first. `getCoreDatabase()`, `closeAll()`, `runMigrations()`.
- **Functions:** camelCase, verb-first. `bootstrapMigrationsTable()`, `getAppliedMigrations()`.
- **Interfaces/Types:** PascalCase, noun or adjective-noun. `FeatureDefinition`, `Migration`, `ScopedLogger`.
- **Constants:** camelCase for most. UPPER_SNAKE_CASE only for true global constants (environment flags, magic numbers). `coreMigrations`, not `CORE_MIGRATIONS`.
- **Test descriptions:** lowercase, verb-first, present tense. `"creates data directories"`, `"returns cached instance"`.
- **Boolean variables/properties:** start with `is`, `has`, `can`, or `should`. `isEnabled`, `hasRunBefore`.
- **Event names:** kebab-case, namespaced. `"rss:new-entry"`, `"todo:item-completed"`.
- **Action/query names:** kebab-case. `"mark-read"`, `"get-entries"`.

### Function Signatures

- **Return concrete types, accept broad types.** A function that accepts `string` is easier to call than one that accepts `BrandedString`.
- **Required parameters first, optional parameters last.**
- **Prefer objects for 3+ parameters.** `createTask({ featureId, name, schedule })` over `createTask(featureId, name, schedule)`.
- **Return result objects, not tuples.** `{ applied: string[], skipped: string[] }` over `[string[], string[]]`.

### Error Handling in Code

- **Throw descriptive errors.** `throw new Error(\`Feature "${featureId}" not found\`)` — not `throw new Error("not found")`.
- **Use typed errors when useful.** A `FeatureNotFoundError` class is better than a generic `Error` when callers need to distinguish error types.
- **Never swallow errors silently.** Log and re-throw, or log and return a failure result.

---

## Coverage Expectations

There is no enforced coverage percentage. The goal is **meaningful coverage, not a number**.

| Layer | Expectation |
|---|---|
| Core services | High. These are the foundation — bugs here cascade everywhere. Test every public method, including error paths. |
| Feature logic (actions, queries) | High. Every action and query handler should have at least happy-path + one error case. Idempotency tests for all actions. |
| Feature migrations | Medium. Test that migrations create expected tables/columns. Test that data survives migration sequences. |
| UI components | Medium. Test rendering, user interactions, and error boundaries. Don't test styling. |
| UI layout/grid | Low. Visual layout is verified manually in phase 1. |

---

## Vitest Configuration

Vitest needs a config file at the project root. This is set up in task 0002.

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: [
      "src/shell/view/**/*.test.{ts,tsx}",
      "src/features/**/view/**/*.test.{ts,tsx}",
      "src/core/ui/**/*.test.{ts,tsx}",
    ],
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "src/core"),
      "@shell": path.resolve(__dirname, "src/shell"),
      "@features": path.resolve(__dirname, "src/features"),
    },
  },
});
```

### Bun Test Configuration

Bun discovers `*.test.ts` files automatically. To restrict it to non-UI code, the `test:core` script specifies paths explicitly or uses `bunfig.toml`:

```toml
# bunfig.toml
[test]
preload = []
```

No special configuration needed — Bun's test runner works out of the box with `bun:test` imports.
