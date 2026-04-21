# Code Conventions

> Every AI agent and contributor must read this before implementing any task that involves code.

This document defines the coding principles and conventions for this project. It is not a general programming primer — it is a specific, enforceable set of rules grounded in this codebase's architecture and goals.

---

## Table of Contents

- [General Principles](#general-principles)
- [SOLID in This Codebase](#solid-in-this-codebase)
- [Bounded Contexts and Feature Isolation](#bounded-contexts-and-feature-isolation)
- [TypeScript](#typescript)
- [Functions and Classes](#functions-and-classes)
- [Error Handling](#error-handling)
- [Immutability](#immutability)
- [Modularity and Dependencies](#modularity-and-dependencies)
- [React and UI](#react-and-ui)
- [What Not To Do](#what-not-to-do)

---

## General Principles

- **Do one thing.** Every function, class, and module has a single, clearly named responsibility.
- **Explicit over implicit.** Code should read like a specification of what it does — no hidden behavior, no spooky action at a distance.
- **Fail loudly.** Errors should surface immediately with a clear message. Silent failures are bugs.
- **Composition over inheritance.** Build complex behavior by combining small, focused parts — not by building deep class hierarchies.
- **Testable by design.** If something is hard to test, the design is wrong. Dependencies should be injectable; pure functions preferred over stateful objects where the logic permits.
- **Boring is good.** Prefer the obvious solution. Reach for advanced patterns only when a simpler one genuinely cannot do the job.

---

## SOLID in This Codebase

### S — Single Responsibility

Each module owns one concern. `DatabaseManager` manages connections and migrations, not settings logic. `MigrationRunner` runs migrations, not schema design. `EventBus` delivers events, not queues actions.

When you find yourself writing "...and also...", that's a signal to split.

### O — Open / Closed

The core is closed for modification, open for extension — via the `FeatureDefinition` interface. Adding a new feature means creating a new module, not touching core. Core services never import from feature modules.

### L — Liskov Substitution

Any object that satisfies an interface must satisfy its full contract. If you accept a `FeatureContext`, you must be prepared to use all of it correctly. Do not create partial implementations that silently skip behavior.

### I — Interface Segregation

Interfaces should be lean. `FeatureContext` gives features exactly what they need — no more. If a service only needs a `db` and `log`, define a narrower interface rather than threading the full `FeatureContext` through.

```typescript
// Good — only what the query handler needs
interface QueryDependencies {
  db: Database;
}

// Avoid — forces a dependency on the full context
function handleQuery(ctx: FeatureContext) { ... }
```

### D — Dependency Inversion

High-level modules (features) depend on abstractions (the `FeatureContext` interface), not on concrete core implementations. Core services are never imported directly by features — they are injected through context.

---

## Bounded Contexts and Feature Isolation

This project follows a **bounded context** model. Each feature owns its data, its domain logic, and its public surface (events, actions, queries). Nothing leaks out except through those defined surfaces.

### Rules

- **Features do not import from each other.** No `import { ... } from "@features/todo/..."` inside another feature.
- **Features do not share databases.** Each feature reads and writes only its own DB file. The core DB is owned by core services.
- **Cross-feature writes go through the action queue.** A feature may not call another feature's action handler directly. Emit an event → script reacts → action queue executes.
- **Cross-feature reads go through `ctx.query()`.** Features may query another feature's public query surface, but not its DB.
- **Domain vocabulary stays inside the bounded context.** The `todo` feature's internal types (`TodoItem`, `TodoStatus`) are not shared with other features. Events carry plain data shapes, not domain objects.

---

## TypeScript

### Type checking must always pass

Run `bun tsc` before committing. The type checker must report zero errors. A failing type check is treated as a broken build — do not merge code that does not pass.

### Strict mode is non-negotiable

The project uses `strict: true`. Never disable or work around strictness.

### Use `unknown` instead of `any`

```typescript
// Good
function parsePayload(raw: unknown): EventPayload {
  if (!isEventPayload(raw)) throw new Error("Invalid payload");
  return raw;
}

// Bad
function parsePayload(raw: any): EventPayload { ... }
```

### Prefer type inference for local variables

Let TypeScript infer what it can. Add explicit types at module boundaries (function signatures, exported types).

```typescript
// Good — inferred locally
const migrations = [migration001, migration002];

// Good — explicit at boundaries
export function runMigrations(db: Database, featureId: string, migrations: Migration[]): MigrationResult { ... }
```

### Use discriminated unions for state variants

```typescript
// Good
type TaskStatus =
  | { status: "pending" }
  | { status: "running"; startedAt: string }
  | { status: "completed"; result: unknown; completedAt: string }
  | { status: "failed"; error: string; retriedCount: number };

// Avoid
type TaskStatus = {
  status: string;
  startedAt?: string;
  result?: unknown;
  error?: string;
};
```

### Use `readonly` on data interfaces

Data objects passed around the system should be immutable by convention:

```typescript
interface Migration {
  readonly version: string;
  readonly name: string;
  readonly up: string;
}
```

### No type assertions (`as X`) without a narrowing guard

Type assertions bypass the type system. Use them only as a last resort, and only inside a guard that validates the shape first.

---

## Functions and Classes

### Use classes for stateful services, functions for logic

`DatabaseManager`, `EventBus`, `ActionQueue` are stateful — they hold connections, subscriptions, or queues. These are classes.

Migration logic, ID generation, validation, formatting — these are pure functions. They live as exported functions in modules, not inside a class for the sake of grouping.

### Keep functions small

A function should do one thing that can be described in its name. If you need the word "and" in its name, split it.

### Prefer named parameters for 3+ arguments

```typescript
// Good
function createTask({ featureId, name, scheduleType, scheduleValue }: CreateTaskParams) { ... }

// Avoid
function createTask(featureId: string, name: string, scheduleType: string, scheduleValue: string) { ... }
```

### Return result objects, not tuples

```typescript
// Good
return { applied: ["001", "002"], skipped: [] };

// Avoid
return [["001", "002"], []];
```

### No classes just for namespacing

If a class has no constructor logic and only static methods, it should be a module with exported functions.

---

## Error Handling

Follow the strategy defined in `ARCHITECTURE.md § Error Handling`. The rules for code:

- **Throw descriptive errors with context.**
  ```typescript
  // Good
  throw new Error(`Feature "${featureId}" failed to activate: ${err.message}`);
  
  // Bad
  throw new Error("activation failed");
  ```

- **Use typed errors when callers need to distinguish failure modes.**
  ```typescript
  class FeatureNotFoundError extends Error {
    constructor(featureId: string) {
      super(`Feature "${featureId}" is not registered`);
      this.name = "FeatureNotFoundError";
    }
  }
  ```

- **Never swallow errors silently.** Log and re-throw, or log and return a typed failure result. An empty `catch` block is always a bug.

- **Validate at system boundaries.** Trust internal code. Validate at entry points: user input, external API responses, IPC messages from the webview. Do not add defensive guards for conditions that cannot occur within the app's own logic.

---

## Immutability

- Prefer `const` over `let`. Mutating a binding is a code smell.
- Do not mutate objects passed in as arguments.
- Use `readonly` on interface properties.
- When building a modified version of an object, return a new object using spread: `{ ...existing, updatedAt: now }`.

---

## Modularity and Dependencies

### Dependency direction

```
@core/types          ← imported by everything
@core/bun/services   ← imported by features (via injection, never directly)
@features/*          ← never imported by other features or by core
@shell/*             ← never imported by features or core
```

### Path aliases are contracts

Use `@core/*`, `@shell/*`, `@features/*` — never relative paths that cross layer boundaries.

### No barrel file chaining

Keep `index.ts` re-exports shallow (one level). Deep barrel chains hide dependencies and slow type checking.

### No circular dependencies

If module A imports B and B imports A, something is in the wrong layer. Move shared code to `@core/types` or extract a utility module.

---

## React and UI

### Components are pure functions

No class components. Every component is a function that maps props to JSX.

### Single responsibility per component

A widget component renders its data. A container component fetches or coordinates data. They do not do both.

### State at the lowest level that works

Do not lift state higher than necessary. If only one component reads a value, that component owns it. Use context or a store only when siblings or distant descendants genuinely need the same value.

### No prop drilling beyond two levels

If a prop is passed through two intermediate components that don't use it, introduce a context or restructure.

### Every widget is wrapped in an Error Boundary

Widget failures must not crash the dashboard. Each widget slot renders inside a React Error Boundary with a fallback card. This is enforced in `WidgetSlot`.

### Query DOM by role or label, not by implementation

In tests and in application logic, interact with elements the way a user would — by their role, label, or visible text. Never target internal CSS classes or test IDs unless no semantic selector exists.

---

## What Not To Do

| Anti-pattern | Why it's banned |
|---|---|
| Direct cross-feature DB access | Bypasses isolation, creates hidden coupling, makes uninstall unsafe |
| Direct cross-feature action calls | Bypasses the action queue's durability and idempotency guarantees |
| `any` type | Silently breaks type safety across the call chain |
| Silent `catch` blocks | Hides failures; violates the "fail loudly" principle |
| God classes | Violate SRP; become impossible to test in isolation |
| Deep inheritance hierarchies | Prefer composition; inheritance for behavior reuse creates fragile coupling |
| Mocking SQLite in tests | Hides real bugs (SQL errors, constraint violations). Use in-memory DBs. See `TESTING.md` |
| State in module scope | Creates hidden shared state between tests and makes modules non-restartable |
| Importing across feature boundaries | Creates coupling that the plugin model is specifically designed to prevent |
| Comments that describe what the code does | Code is the documentation. Comments explain **why** when it's non-obvious |
