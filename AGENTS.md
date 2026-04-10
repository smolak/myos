# Agent Instructions

Local-first productivity dashboard built with Electrobun (TypeScript + Bun + native webview). Modular plugin architecture — every feature follows the same `FeatureDefinition` contract. Fully local, privacy-first, user-owned data.

## Before You Start

1. Read `specs/ARCHITECTURE.md` — the single source of truth for design decisions, contracts, schemas, and project structure.
2. Read `specs/TASKS.md` — the task registry and reading strategy. Follow the "Reading Strategy (for AI agents)" section.
3. Read `specs/TESTING.md` before writing any tests — two test runners, specific conventions.
4. For decision rationale (why choices were made): `specs/ARCHITECTURE-RATIONALE.md`.

## Key Constraints

- Every feature uses the `FeatureDefinition` contract. No first-class privileges for built-in features.
- Separate SQLite DB per feature. Core DB for orchestration. WAL mode on all databases.
- Cross-feature communication goes through the Event Bus and Action Queue — never direct imports.
- IDs: `nanoid` (21 chars) for generated IDs. `INTEGER AUTOINCREMENT` only for `event_log`.
- Tasks implement the architecture — they don't invent new architecture. If a task requires a design decision not covered in `specs/ARCHITECTURE.md`, update the architecture doc first.
- Every task that implements logic must include tests following `specs/TESTING.md` conventions.

## Project Structure

Vertical Slice + Microkernel. Each feature is a self-contained folder under `src/features/`. Core services live in `src/core/`. The dashboard shell lives in `src/shell/`. See `specs/ARCHITECTURE.md` § Project Structure for the full layout.
