# MyOS

Local-first productivity dashboard built with Electrobun (TypeScript + Bun + native webview). Modular plugin architecture — every feature follows the same `FeatureDefinition` contract. Fully local, privacy-first, user-owned data.

**Electrobun is NOT Electron.** Do not use Electron APIs or patterns. Bun-side imports come from `electrobun/bun`, view-side from `electrobun/view`; bundled assets load via `views://` URLs and views must be declared in `electrobun.config.ts`. Deeper guidance lives in the `electrobun` and `electrobun-best-practices` skills; full API reference: https://blackboard.sh/electrobun/llms.txt

## Reading list

- `specs/ARCHITECTURE.md` — single source of truth for design decisions, contracts, schemas, and project structure
- `specs/CONVENTIONS.md` — coding principles and conventions; read before implementing any code
- `specs/TESTING.md` — read before writing any tests (two test runners, specific conventions)
- `specs/TASKS.md` — task registry and reading strategy; follow the "Reading Strategy (for AI agents)" section
- `plan/productivity-dashboard.md` — phase-by-phase build plan
- `specs/ARCHITECTURE-RATIONALE.md` — decision rationale (why choices were made)
- `specs/UBIQUITOUS_LANGUAGE.md` — canonical domain vocabulary

## Key constraints

- Every feature uses the `FeatureDefinition` contract. No first-class privileges for built-in features.
- Separate SQLite DB per feature via `DatabaseManager`. Core DB for orchestration. WAL mode on all databases. No `localStorage` for feature state.
- Cross-feature communication goes through the Event Bus and Action Queue — never direct imports.
- IDs: `nanoid` (21 chars) for generated IDs. `INTEGER AUTOINCREMENT` only for `event_log`.
- Tasks implement the architecture — they don't invent new architecture. If a task requires a design decision not covered in `specs/ARCHITECTURE.md`, update the architecture doc first.

## Project structure

Vertical Slice + Microkernel. Each feature is a self-contained folder under `src/features/`. Core services live in `src/core/`. The dashboard shell lives in `src/shell/`. See `specs/ARCHITECTURE.md` § Project Structure for the full layout.

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

## Testing quick reference

Read `specs/TESTING.md` for full conventions before writing or modifying tests.

- **Co-locate** test files next to source: `foo.ts` → `foo.test.ts`. No `__tests__/` directories. Use `.test.`, not `.spec.`.
- **Use `test()`** not `it()`. Test names: lowercase, verb-first, present tense, no "should" prefix — e.g. `"creates data directories if they do not exist"`.
- **Bun-side tests** (`src/core/`, `src/features/**/bun/`): use `bun:test`, real SQLite (`:memory:` for features, temp dirs for DB manager). Never mock SQLite.
- **UI tests** (`src/shell/view/`, `src/features/**/view/`): Vitest + React Testing Library. Test behavior, not implementation; query by role/label, not CSS classes or test IDs.
- **Always test idempotency** for action handlers.
- Prefer specific matchers (`toEqual`, `toHaveLength`, `toThrow`) over generic boolean checks.

## Naming

- **Event names:** kebab-case, namespaced with feature ID. `"rss:new-entry"`, `"todo:item-completed"`.
- **Action/query names:** kebab-case. `"mark-read"`, `"get-entries"`.
- **Feature IDs:** lowercase kebab-case slugs. `"rss-reader"`, `"todo"`, `"pomodoro"`.
- **Classes:** PascalCase noun (`DatabaseManager`). **Functions/methods:** camelCase verb-first (`runMigrations()`). **Booleans:** `is`/`has`/`can`/`should` prefix.
- Prefer parameter objects for 3+ arguments. Return result objects, not tuples.

## Imports and path aliases

- Path aliases: `@core/*` → `src/core/*`, `@shell/*` → `src/shell/*`, `@features/*` → `src/features/*`. Configured in both `tsconfig.json` and `vite.config.ts`.
- **Exception — Bun-side entrypoint:** `src/shell/bun/index.ts` must use relative paths (`../../core/…`). The electrobun bundler does not resolve tsconfig path aliases.

## Development workflow

```bash
bun run dev            # Start the Electrobun app (Bun process + webview)
bun run hmr            # Vite HMR dev server (for fast UI iteration)
bun run test:watch     # Bun tests in watch mode
bun run test:ui:watch  # Vitest in watch mode
```

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues (`smolak/myos`), operated via the `gh` CLI. External PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — the five canonical role names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) used verbatim. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: `CONTEXT-MAP.md` at the root maps the Core context and per-feature contexts under `src/features/`. See `docs/agents/domain.md`.
