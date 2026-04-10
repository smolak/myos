# Architecture Decision Record — Local-First Productivity Dashboard

> Built with Electrobun (TypeScript + Bun + native webview).
> Designed as a modular, extensible, privacy-first personal productivity platform.

---

## Table of Contents

- [Philosophy](#philosophy)
- [App Model](#app-model)
- [Plugin Architecture](#plugin-architecture)
- [Feature Contract](#feature-contract)
- [UI Layer](#ui-layer)
- [Data Layer](#data-layer)
- [Core Services](#core-services)
- [Event Bus + Action Queue](#event-bus--action-queue)
- [Script Engine](#script-engine)
- [Auth Strategy](#auth-strategy)
- [Error Handling](#error-handling)
- [Testing Strategy](#testing-strategy)
- [Project Structure](#project-structure)
- [Build Order](#build-order)
- [Feature Ideas](#feature-ideas)
- [Future Phases](#future-phases)
- [Decision Rationale](ARCHITECTURE-RATIONALE.md) *(separate file)*

---

## Philosophy

- Fully local, privacy-first, user-owned data.
- No cloud dependency for core functionality.
- External network access only for data collection (weather, RSS, calendar sync, etc.).
- Users are free from big companies holding or reading their data.
- Scripts are internal glue only — no external network or filesystem access from scripts.

---

## App Model

- **Tray app**, always running in the background. Bun main process stays alive for background tasks.
- Single dashboard window, shown/hidden via tray icon click or global shortcut.
- **Dashboard-first** UI: a grid of configurable widgets. Click to expand any widget into a full view.
- Optional pop-out into separate OS windows for power users (future).
- `runtime.exitOnLastWindowClosed: false` — window close hides, doesn't quit.
- Tray icon can show status (unread count, badges, etc.).

---

## Plugin Architecture

**Phase C — Hybrid approach.**

- Every feature uses the exact same `FeatureDefinition` contract. No first-class privileges for built-in features.
- Phase 1: features ship built-in, but the internal architecture treats them as plugins.
- Phase 2+: runtime plugin loading from a registry. Downloaded features have the same folder structure, loaded dynamically.
- Future: marketplace where third-party developers publish features (potentially paid).
- "Graduating" a popular registry feature to built-in is a build config change, not a code change.

---

## Feature Contract

Every feature exposes three public surfaces:

1. **Events** — notifications that something happened (e.g., `rss:new-entry`). Fire-and-forget.
2. **Actions** — write operations other features/scripts can invoke (e.g., `todo:create`). Must be idempotent.
3. **Queries** — read-only data access (e.g., `todo:find`).

### FeatureDefinition Interface

```typescript
interface FeatureDefinition<
  TEvents extends EventMap = EventMap,
  TActions extends ActionMap = ActionMap,
  TQueries extends QueryMap = QueryMap,
> {
  id: string;
  name: string;
  version: string;

  install(ctx: FeatureLifecycleContext): Promise<void>;
  activate(ctx: FeatureContext<TEvents, TActions, TQueries>): Promise<void>;
  deactivate(): Promise<void>;
  uninstall(ctx: FeatureLifecycleContext): Promise<void>;

  migrations: Migration[];

  manifest: {
    events: EventDeclarations<TEvents>;
    actions: ActionDeclarations<TActions>;
    queries: QueryDeclarations<TQueries>;
    permissions: Permission[];
    scheduledTasks: ScheduledTaskDeclaration[];
    widgets: WidgetDeclaration[];
    commands: CommandDeclaration[];
  };
}
```

### Manifest Declarations

Each declaration type (`EventDeclarations`, `ActionDeclarations`, `QueryDeclarations`) carries optional schema metadata — `payload`, `params`, `result` fields that describe the shape of data in human-readable string form (e.g., `{ entryId: "string" }`). These are used for documentation, command palette hints, and future runtime validation. They are **not** the source of runtime type safety — that comes from the generic type parameters `TEvents`, `TActions`, `TQueries` on `FeatureDefinition`.

See the reference RSS implementation in `ARCHITECTURE-RATIONALE.md` for how manifest declarations look in practice.

### Lifecycle

1. `install` — runs once when first installed. Seed defaults.
2. `activate` — runs on every app start. Register action/query handlers, subscribe to events, register scheduled tasks.
3. `deactivate` — cleanup on shutdown or disable.
4. `uninstall` — nuclear cleanup. Core deletes the feature's DB file; this hook cleans up extras.

### FeatureContext (provided by core to each feature)

```typescript
interface FeatureContext<TEvents, TActions, TQueries> {
  db: Database;

  events: {
    emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void;
  };

  actions: {
    handle<K extends keyof TActions>(
      action: K,
      handler: (params: TActions[K]["params"], meta: ActionMeta) => Promise<TActions[K]["result"]>
    ): void;
  };

  queries: {
    handle<K extends keyof TQueries>(
      query: K,
      handler: (params: TQueries[K]["params"]) => Promise<TQueries[K]["result"]>
    ): void;
  };

  subscribe(event: string, handler: (payload: unknown) => Promise<void>): void;
  query(feature: string, queryName: string, params: unknown): Promise<unknown>;

  scheduler: {
    register(taskId: string, handler: () => Promise<void>): void;
  };

  settings: {
    get<T>(key: string, defaultValue: T): T;
    set(key: string, value: unknown): Promise<void>;
  };

  log: ScopedLogger;
}
```

### ActionMeta

```typescript
interface ActionMeta {
  executionId: string;
  correlationId: string;
  retriedCount: number;
}
```

Idempotency is enforced at the action queue level: the core checks if a `correlationId` has already completed successfully before calling the handler. Feature authors don't need to implement idempotency for script-triggered actions.

---

## UI Layer

- **React + Tailwind CSS + Vite** for the webview.
- **shadcn/ui** as the component foundation, copied into the codebase as `@core/ui`.
- **Shared DOM** with React Error Boundaries per widget (no iframes in phase 1).
  - Future: iframe sandboxing for untrusted third-party plugins.
- **`react-grid-layout`** for the dashboard grid.
- **Fixed grid with predefined widget sizes:**
  - Small (1×1): clock, pomodoro timer, weather temp
  - Medium (2×1): weather forecast, quick notes, upcoming meeting
  - Wide (2×2): RSS feed, todo list, calendar week
  - Full-width (4×1): timeline, habits tracker
- **Multiple named dashboard pages** ("Morning", "Work", "Reading", "Weekend").
- Widget instances can have per-instance config (e.g., two weather widgets for different cities).

### Layout Persistence

```typescript
interface DashboardPage {
  id: string;
  name: string;
  layout: LayoutItem[];
  order: number;
}

interface LayoutItem {
  i: string;          // widget instance ID
  x: number;
  y: number;
  w: number;
  h: number;
  featureId: string;
  widgetId: string;
  config?: Record<string, unknown>;
}
```

---

## Data Layer

- **Separate SQLite DB file per feature.** Core DB for orchestration.
- Reasons: easy backups, portability, partitioning, clean uninstall, blast-radius isolation on corruption.
- **WAL mode** (Write-Ahead Logging) on all databases for crash resilience.
- **ID strategy:**
  - `nanoid` (21 chars, URL-safe) for all generated IDs.
  - `INTEGER PRIMARY KEY AUTOINCREMENT` only for `event_log` (ordering matters).
  - Human-readable slugs for feature IDs (e.g., `"rss-reader"`).
- Cross-feature consistency via idempotent actions + persistent action queue with correlation IDs.

### Core Database Schema

```sql
-- Feature Registry
CREATE TABLE features (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    version      TEXT NOT NULL,
    description  TEXT,
    author       TEXT,
    enabled      INTEGER NOT NULL DEFAULT 1,
    manifest     TEXT NOT NULL,              -- full manifest JSON
    installed_at TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

-- Scheduler
CREATE TABLE scheduled_tasks (
    id              TEXT PRIMARY KEY,
    feature_id      TEXT NOT NULL REFERENCES features(id),
    name            TEXT NOT NULL,
    schedule_type   TEXT NOT NULL,           -- "cron" | "interval"
    schedule_value  TEXT NOT NULL,           -- cron expression or milliseconds
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_run_at     TEXT,
    next_run_at     TEXT NOT NULL,
    last_status     TEXT,                    -- "success" | "failed"
    last_error      TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 3,
    created_at      TEXT NOT NULL
);
CREATE INDEX idx_tasks_next_run ON scheduled_tasks(next_run_at) WHERE enabled = 1;

-- Action Queue: Executions
CREATE TABLE script_executions (
    id              TEXT PRIMARY KEY,
    script_id       TEXT NOT NULL REFERENCES scripts(id),
    triggered_by    TEXT NOT NULL,
    trigger_payload TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TEXT NOT NULL,
    completed_at    TEXT
);

-- Action Queue: Individual Actions
CREATE TABLE execution_actions (
    id            TEXT PRIMARY KEY,
    execution_id  TEXT NOT NULL REFERENCES script_executions(id),
    sequence      INTEGER NOT NULL,
    feature_id    TEXT NOT NULL,
    action_name   TEXT NOT NULL,
    params        TEXT NOT NULL,             -- JSON
    depends_on    INTEGER,                   -- sequence number of dependency
    output_key    TEXT,                      -- for result referencing
    status        TEXT NOT NULL DEFAULT 'pending',
    result        TEXT,                      -- JSON
    error         TEXT,
    retry_count   INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    completed_at  TEXT
);
CREATE INDEX idx_exec_actions_pending ON execution_actions(execution_id, sequence) WHERE status = 'pending';

-- Scripts
CREATE TABLE scripts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    code        TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE script_subscriptions (
    script_id  TEXT NOT NULL REFERENCES scripts(id),
    event_name TEXT NOT NULL,
    PRIMARY KEY (script_id, event_name)
);

CREATE TABLE script_store (
    script_id  TEXT NOT NULL REFERENCES scripts(id),
    key        TEXT NOT NULL,
    value      TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (script_id, key)
);

-- Event Log (90-day configurable retention, auto-pruned)
CREATE TABLE event_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    feature_id TEXT NOT NULL,
    payload    TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_events_name_time ON event_log(event_name, created_at);

-- Settings (global + per-feature)
CREATE TABLE settings (
    scope      TEXT NOT NULL,               -- "global" | feature_id
    key        TEXT NOT NULL,
    value      TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (scope, key)
);

-- Encrypted Credentials
CREATE TABLE credentials (
    id              TEXT PRIMARY KEY,
    feature_id      TEXT NOT NULL REFERENCES features(id),
    service_name    TEXT NOT NULL,
    credential_type TEXT NOT NULL,           -- "api_key" | "oauth2" | "token"
    encrypted_value TEXT NOT NULL,
    metadata        TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- Migration Tracking (for core + all feature DBs)
CREATE TABLE migrations (
    feature_id TEXT NOT NULL,               -- "core" for core DB
    version    TEXT NOT NULL,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    PRIMARY KEY (feature_id, version)
);
```

---

## Core Services

| Service | Responsibility | Type |
|---|---|---|
| Feature Registry | Load, activate, deactivate, manage features | Core |
| Scheduler | Persistent cron + interval tasks, priority queue execution | Core |
| Event Bus | Real-time pub/sub between features | Core |
| Action Queue | Persistent, reliable, exactly-once action execution | Core |
| Script Engine | Load/run user scripts, provide ScriptContext | Core |
| Database Manager | Create/migrate per-feature SQLite DBs | Core |
| Settings Manager | Global + per-feature settings in core DB | Core |
| Credential Store | Encrypted API key/token storage | Core |
| Notification Service | Native OS notifications + in-app notification center | Core |
| Backup Service | Automatic daily backups, per-feature restore, export | Core |
| Command Palette | Cmd+K search, actions, navigation across all features | Core |
| Theming | Light/dark/system, accent color, CSS custom properties | Core |

---

## Event Bus + Action Queue

Two distinct systems working together:

### Event Bus
- Real-time pub/sub. Features emit events, subscribers receive them immediately.
- Events are ephemeral notifications — "something happened."
- Used to trigger scripts and notify interested features.

### Action Queue
- Persistent, reliable execution of script-triggered actions.
- Written to core DB before execution (survives crashes).
- Supports `dependsOn` (sequential execution within a batch) and `output_key` (reference previous action's result).
- Retries failed actions with backoff.
- Idempotency enforced via `correlationId` — duplicate execution returns cached result.

### Cross-Feature Communication

Features **cannot invoke another feature's actions directly**. `FeatureContext` provides `query()` for cross-feature reads, but no `dispatch()` for cross-feature writes. This is intentional:

- **Reads are safe.** A query has no side effects — one feature reading another's data can't corrupt state.
- **Writes are dangerous.** Direct cross-feature writes bypass the action queue's persistence, retry, and idempotency guarantees. They would create hidden coupling and make failure recovery impossible.
- **The correct path for cross-feature writes:** emit an event → a script reacts → the script enqueues actions via the Action Queue → the queue executes them reliably.

This keeps the boundary clean: features own their own data, events are the only coupling between them, and the Action Queue is the only write path across boundaries.

### End-to-End Flow

```
Feature emits event
       ↓
  Event Bus → delivers to subscribed scripts
       ↓
  Script runs, calls ctx.actions.* and ctx.queries.*
       ↓
  Actions written to Action Queue in core DB
       ↓
  Action Processor executes each action against feature DBs
       ↓
  Retries on failure, deduplicates on retry, marks completed
```

---

## Script Engine

Scripts are internal glue between features. They cannot access the network, filesystem, or anything outside the app.

### ScriptContext API

```typescript
interface ScriptContext {
  on(event: string, handler: (payload: any) => Promise<void>): void;
  queries: Record<string, Record<string, (params: any) => Promise<any>>>;
  actions: Record<string, Record<string, (params: any) => Promise<any>>>;
  log(message: string): void;
  store: {
    get<T>(key: string): T | undefined;
    set(key: string, value: unknown): Promise<void>;
  };
  match(value: string, patterns: string[]): boolean;
}
```

### Script Example

```typescript
export default function(ctx: ScriptContext) {
  ctx.on("rss:new-entry", async (entry) => {
    const existing = await ctx.queries.todo.find({ linkedUrl: entry.url });
    if (existing.length === 0) {
      await ctx.actions.todo.create({
        title: `Read: ${entry.title}`,
        url: entry.url,
      });
      await ctx.actions.rss.markProcessed({ entryId: entry.id });
    }
  });
}
```

### Two Layers of Conditional Logic

1. **Script-time decisions**: scripts query feature state via `ctx.queries` before deciding what actions to enqueue. Full TypeScript expressiveness.
2. **Execution-time preconditions**: action queue supports `dependsOn` (only run if previous succeeded) and `output_key` references (pass previous result into next action).

### Evolution Path

```
Visual Builder (phase 3) → generates → Script
Rule DSL/YAML (phase 2)  → generates → Script
Hand-written script (phase 1) ← executes ← Script Engine
```

---

## Auth Strategy

- Use the **simplest auth method** that works for each external service.
- OAuth deferred until a feature genuinely requires it.
- "Bring your own credentials" as the default philosophy.

| Auth Level | Examples | Approach |
|---|---|---|
| None | Public RSS feeds | Just fetch |
| API key | OpenWeatherMap | User pastes key in settings |
| Secret URL | Google Calendar ICS, private feeds | User pastes URL in settings |
| Username/password | IMAP, CalDAV, self-hosted | User enters credentials, stored encrypted |
| OAuth 2.0 (future) | Google full access, GitHub, Notion | Loopback redirect, user's own client ID |

When OAuth is needed: loopback redirect flow (temporary `Bun.serve()` on localhost), user provides their own GCP/OAuth client credentials.

---

## Error Handling

### Principles
- Isolate failures. Never let one thing take down another.
- Surface errors to the user with actionable options (Retry, Disable, View Error).
- Persist all work — crashes lose nothing.

### By Failure Mode

| Failure | Strategy |
|---|---|
| Feature crashes during `activate` | Auto-disable, notify user, app continues |
| Widget crashes during render | React Error Boundary, fallback card |
| Scheduled task fails | Exponential backoff (1m, 5m, 30m), max 3 retries per execution. Auto-disable after 5 consecutive scheduled failures |
| Script execution fails | Log error, mark execution failed, skip pending actions. Never affects other scripts |
| Database corruption | WAL mode prevents most corruption. Integrity check on startup. Per-feature DB isolation limits blast radius |
| App crash (Bun process dies) | Persistent scheduler + action queue resume on restart. No work lost |

---

## Testing Strategy

Two test runners, each targeting a different runtime:

| Layer | Tool | What to Test |
|---|---|---|
| Core services | `bun:test` | Scheduler, event bus, action queue, DB manager, feature registry — high coverage |
| Feature logic (Bun side) | `bun:test` + in-memory SQLite | Action handlers, query handlers, migrations, idempotency |
| UI components (webview) | Vitest + React Testing Library | Widget rendering, dashboard grid, settings panels |
| E2E | Deferred to phase 2 | Manual testing protocol for phase 1 |

**Why two runners:** Core services use `bun:sqlite` (only available in Bun). UI components need a DOM environment (jsdom via Vitest). Both use the same `expect` API.

**Conventions:** See `TESTING.md` for file organization, naming, patterns, assertion style, API design guidelines, and coverage expectations. Every task that implements logic must include tests.

---

## Project Structure

Vertical Slice + Microkernel pattern. Each feature is fully self-contained.

```
src/
├── core/
│   ├── bun/
│   │   ├── bootstrap.ts
│   │   ├── feature-registry.ts
│   │   ├── database-manager.ts
│   │   ├── event-bus.ts
│   │   ├── action-queue.ts
│   │   ├── scheduler.ts
│   │   ├── script-engine.ts
│   │   ├── settings-manager.ts
│   │   ├── credential-store.ts
│   │   ├── notification-service.ts
│   │   └── backup-service.ts
│   ├── types/
│   │   ├── feature.ts
│   │   ├── events.ts
│   │   ├── actions.ts
│   │   └── scheduler.ts
│   └── ui/                        # @core/ui shared component library
│       ├── Card.tsx
│       ├── Button.tsx
│       └── ...
│
├── shell/                         # Dashboard chrome (not a feature)
│   ├── bun/
│   │   └── main.ts               # Electrobun entry: window, tray, RPC
│   ├── view/
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── DashboardGrid.tsx
│   │   ├── WidgetSlot.tsx
│   │   ├── PageTabs.tsx
│   │   └── SettingsPanel.tsx
│   └── shared/
│       └── rpc-types.ts
│
├── features/
│   ├── todo/
│   │   ├── bun/
│   │   │   ├── index.ts           # FeatureDefinition export
│   │   │   ├── actions.ts
│   │   │   ├── queries.ts
│   │   │   └── tasks.ts
│   │   ├── view/
│   │   │   ├── TodoWidget.tsx
│   │   │   ├── TodoFullView.tsx
│   │   │   └── TodoSettings.tsx
│   │   ├── shared/
│   │   │   ├── types.ts
│   │   │   └── rpc-types.ts
│   │   └── migrations/
│   │       └── 001-initial.sql
│   ├── rss/
│   ├── pomodoro/
│   ├── weather/
│   └── ...
│
└── scripts/                       # Example/seed automation scripts (development only)
    └── ...                        # User scripts are stored in the core DB `scripts` table at runtime.
                                   # This directory holds development-time examples and seed scripts
                                   # that can be imported into the app. Not deployed to production.
```

---

## Build Order

1. **Core shell** — tray app, empty dashboard grid, feature registry, database manager, settings
2. **Todo List** — proves the full feature contract (actions, queries, events, widget + full view)
3. **Script Engine** — event bus → script → action queue pipeline, tested against TODO events
4. **Pomodoro** — second feature, validates coexistence. First cross-feature script: `pomodoro:session-ended → todo:create`
5. **RSS Reader** — adds scheduler + network. Flagship automation: `rss:new-entry → todo:create`
6. **Clock + Weather** — external API with API key auth, widget-only feature
7. **Command Palette, Notification Center, Theming** — core UX infrastructure
8. **Daily Journal, Global Search, Focus Mode** — high-value features
9. **Calendar, Habits, Bookmarks, Countdowns** — remaining features from original list
10. **Clipboard History, Snippets** — nice-to-have features

---

## Feature Ideas

### Must-have (core)
- **Command Palette** — Cmd+K. Search across features, execute actions, navigate. Features register commands in their manifest.
- **Notification Center** — native OS notifications + in-app bell icon with history. Per-feature notification preferences.
- **Theming** — light/dark/system toggle, accent color picker. CSS custom properties from day one.
- **Data Export** — per-feature JSON/CSV export, full archive export, import support (OPML, Todoist, etc.).

### High-value features
- **Daily Journal** — auto-generated daily page from cross-feature events (completed TODOs, pomodoro sessions, habits, saved articles). Free-text notes. Searchable personal log.
- **Global Search** — search across all features from one input. Each feature registers a `search` query handler. Core fans out in parallel and merges results.
- **Focus Mode** — single-key toggle to show one feature full-screen with no dashboard chrome.

### Nice-to-have features
- **Clipboard History** — watches system clipboard, stores copies, searchable. Scriptable ("when I copy a URL matching X, create a bookmark").
- **Snippet/Template System** — reusable text templates with variables. Expands in Quick Notes or anywhere text is entered.

### From original feature list
- Clock with weather, RSS feed, Quick Notes, Countdowns, Pomodoro, Upcoming meetings, Todo list, Calendar, Habits, Bookmarks, Quick Actions.

---

## Future Phases

- **Runtime plugin loading** — download features at runtime, load from `userData/features/`.
- **Feature marketplace** — registry where developers publish features, potentially paid.
- **Visual automation builder** (no-code) — generates scripts. Phase 3.
- **Rule DSL/YAML** — structured automation format that compiles to scripts. Phase 2.
- **OAuth infrastructure** — loopback redirect server, token refresh, built when first feature needs it.
- **Iframe sandboxing** — for untrusted third-party marketplace plugins.

---

> **Decision rationale and reference implementations** have been moved to [`ARCHITECTURE-RATIONALE.md`](ARCHITECTURE-RATIONALE.md) to keep this file focused on the actionable specification.
