# MyOS — Claude Code Guidelines

## TDD workflow

**Pure logic modules** (classes, services, utilities, bun-side features): strict red → green → refactor. The API is knowable before writing it, so tests come first with no exception.

**New UI components being designed from scratch**: tests must precede the *behavior implementation*, not necessarily the structural scaffolding. Acceptable sequence:
1. Sketch the component structure and stabilise the interface (props, roles, layout)
2. Write failing tests for the behavior (filtering, keyboard navigation, state transitions)
3. Implement the behavior to make them pass

**Skip tests entirely only for**: config files, pure type definitions, purely visual markup with no logic (no filtering, no state, no event handling).

## Quality gate

Every change must pass all three checks before being considered done:

```bash
bun run check    # Biome lint + format (zero errors, zero warnings)
bun run test     # Bun tests (core/bun) + Vitest (view/UI)
bun run tsc      # TypeScript type-check (no emit)
```

Run them in that order. Fix all failures before marking a task complete.

## Architecture

See `plan/productivity-dashboard.md` for the full plan and architectural decisions.

Key rules:
- **Bun-side imports**: `src/shell/bun/index.ts` must use relative paths (`../../core/…`). The electrobun bundler does not resolve tsconfig path aliases (`@core/*`, `@features/*`).
- **Path aliases** (view/vitest only): `@core/*` → `src/core/*`, `@shell/*` → `src/shell/*`, `@features/*` → `src/features/*`
- **Data layer**: SQLite per feature via `DatabaseManager`. No `localStorage` for feature state.
- **IDs**: `nanoid` for generated IDs. `INTEGER AUTOINCREMENT` only for `event_log`.

## Development workflow

```bash
bun run dev          # Start the Electrobun app (Bun process + webview)
bun run hmr          # Vite HMR dev server (for fast UI iteration)
bun run test:watch   # Bun tests in watch mode
bun run test:ui:watch  # Vitest in watch mode
```
