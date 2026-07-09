# Feature Development Rules

Every feature follows the `FeatureDefinition` contract defined in `specs/ARCHITECTURE.md` § Feature Contract.

## Structure

Each feature is a vertical slice:

```
src/features/<name>/
├── bun/
│   ├── index.ts          # FeatureDefinition export
│   ├── actions.ts
│   ├── queries.ts
│   └── tasks.ts
├── view/
│   ├── <Name>Widget.tsx
│   ├── <Name>FullView.tsx
│   └── <Name>Settings.tsx
├── shared/
│   ├── types.ts
│   └── rpc-types.ts
└── migrations/
    └── 001-initial.sql
```

## Key Rules

- Every feature gets its own SQLite database. No cross-feature SQL queries.
- Three public surfaces: **Events** (fire-and-forget), **Actions** (write, must be idempotent), **Queries** (read-only).
- Lifecycle: `install` → `activate` → `deactivate` → `uninstall`.
- Actions triggered by scripts get core-level idempotency via `correlationId`. UI-triggered actions use DB constraints.
- Cross-feature communication goes through the Event Bus and Action Queue — never direct imports.
- Every feature that implements logic must include tests. See `specs/TESTING.md`.
