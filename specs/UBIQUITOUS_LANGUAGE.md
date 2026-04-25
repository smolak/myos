# Ubiquitous Language

> Derived from [`ARCHITECTURE.md`](ARCHITECTURE.md), [`CONVENTIONS.md`](CONVENTIONS.md), and [`../plan/productivity-dashboard.md`](../plan/productivity-dashboard.md).
> When a term used in those documents conflicts with a definition here, this file is the tie-breaker.


## Feature system

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Feature** | A self-contained unit of functionality (e.g. Todo, Pomodoro, RSS Reader) that implements `FeatureDefinition` | Plugin, module, extension |
| **FeatureDefinition** | The contract interface a Feature must implement, including lifecycle hooks and its manifest | Feature class, feature module |
| **FeatureManifest** | The static declaration of everything a Feature exposes: events, actions, queries, widgets, commands, permissions, and scheduled tasks | Feature config, feature metadata |
| **FeatureRegistry** | The core service that discovers Features on startup, runs their lifecycle hooks, and tracks enabled/disabled state | Plugin registry, feature loader |
| **FeatureContext** | The runtime object injected into a Feature during `activate`; provides access to its DB, EventBus, action/query handlers, scheduler, settings, and credentials | Feature API, feature services |
| **FeatureLifecycleContext** | The limited context injected during `install`/`uninstall`; provides only `db` and `log` | — |
| **Feature lifecycle** | The ordered sequence of hooks: `install` (once) → `activate` (each startup) → `deactivate` → `uninstall` (once) | Feature phases, feature stages |
| **Feature ID** | A lowercase kebab-case string that uniquely identifies a Feature (e.g. `todo`, `rss-reader`) | Feature name, feature slug |

## Data pipeline

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Event** | A named, fire-and-forget notification that something happened, emitted by a Feature or Script (e.g. `todo:item-completed`) | Message, signal, notification |
| **EventBus** | The in-process pub/sub service that delivers Events to all registered subscribers | Message broker, event emitter |
| **EventLog** | The persistent SQLite table that records every emitted Event for auditing and debugging; separate from live delivery | Event history, audit log |
| **EventSubscription** | A registered handler bound to a specific Event name on the EventBus | Event listener, event hook |
| **Action** | A named, persisted mutation command directed at a specific Feature; processed reliably by the Action Queue | Command, mutation, write |
| **ActionQueue** | The persistent queue service that writes Actions to SQLite before executing them, with retry and idempotency guarantees | Job queue, task queue, work queue |
| **ExecutionAction** | A single action record inside a ScriptExecution, tracked with status, retry count, and result | Action record, queued action |
| **ScriptExecution** | A tracked run of a Script triggered by an Event, containing one or more `ExecutionAction`s | Script run, automation run |
| **Query** | A read-only data request directed at a specific Feature; never mutates state | Read, fetch, get |
| **Script** | A user-defined automation loaded from the DB that subscribes to Events and enqueues Actions | Automation, rule, workflow |
| **ScriptEngine** | The service that loads Scripts from the DB on startup and routes Events to subscribed Script handlers | Automation engine, rule engine |
| **ScriptContext** | The runtime object injected into a Script; provides `on`, `actions`, `queries`, `store`, and `match` | Script API, script sandbox |
| **ScriptStore** | The per-Script key-value persistence backed by the `script_store` table | Script state, script memory |
| **correlationId** | An idempotency key on an ExecutionAction that prevents the same action from executing more than once | Dedup key, idempotency token |

## Dashboard

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **Dashboard** | The main grid surface where Widgets are arranged and displayed | Home screen, workspace |
| **DashboardPage** | A named, switchable collection of Widgets with its own layout | Tab, page, view |
| **Widget** | A Feature's UI component placed on the Dashboard grid at a specific position and size | Card, tile, panel |
| **WidgetDeclaration** | The static metadata in a FeatureManifest describing a Widget's id, name, and supported sizes | Widget definition, widget config |
| **WidgetSize** | One of `small` (1×1), `medium` (2×2), `wide` (2×1), `full-width` (4×1) | Widget dimensions, grid size |
| **LayoutItem** | A Widget's placement record within a DashboardPage: widget id, grid position (x/y), and size | Grid item, layout entry |

## Infrastructure

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **DatabaseManager** | The service that creates and manages SQLite databases; creates `core.db` and per-Feature databases | DB manager, storage manager |
| **CoreDB** | The single SQLite database (`core.db`) used for orchestration tables shared across all Features | Core database, shared database |
| **FeatureDB** | An isolated SQLite database created per Feature, used for that Feature's own data | Feature database, plugin database |
| **Migration** | A versioned, named SQL schema change with an `up` script and optional `down` script | Schema change, DB version |
| **MigrationRunner** | The service that applies pending Migrations in version order and tracks them in the `migrations` table | Schema runner, migrator |
| **WAL mode** | Write-ahead log mode enabled on all SQLite databases to support concurrent reads | — |
| **SettingsManager** | The service for reading and writing scoped key-value settings backed by the `settings` table | Config manager, preferences |
| **Settings scope** | Either `"global"` (app-wide) or a Feature ID (Feature-specific); isolates settings per owner | Settings namespace, settings context |
| **CredentialStore** | The service for encrypted storage and retrieval of sensitive values backed by the `credentials` table | Secret store, keychain, vault |
| **Scheduler** | The service that executes ScheduledTasks at their configured cron or interval schedule | Cron runner, task runner, timer |
| **ScheduledTask** | A registered recurring task with a cron expression or millisecond interval, backed by the `scheduled_tasks` table | Cron job, timer task |
| **Channel** | A build variant of the app (`dev` vs `stable`) that determines the data directory path, ensuring FeatureDB isolation | Build variant, environment |

## Shell / IPC

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| **AppRPCSchema** | The typed IPC contract (extending `ElectrobunRPCSchema`) defining all request/response pairs between the Bun process and the webview | IPC schema, RPC contract |
| **Command** | A named, user-invocable action registered in a FeatureManifest and surfaced in the Command Palette | Shortcut, menu item |
| **CommandDeclaration** | The static metadata in a FeatureManifest describing a Command's id, label, and optional params | Command definition, command config |
| **Command Palette** | The `Cmd+K` search overlay that surfaces registered Commands across all Features | Quick launcher, search bar, spotlight |

## Relationships

- A **Feature** implements exactly one **FeatureDefinition** and declares one **FeatureManifest**.
- A **FeatureManifest** contains zero or more **WidgetDeclarations**, **CommandDeclarations**, **EventDeclarations**, **ActionDeclarations**, **QueryDeclarations**, and **ScheduledTaskDeclarations**.
- Each active **Feature** owns exactly one **FeatureDB** and operates within one **FeatureContext**.
- An **Event** is delivered by the **EventBus** to all **EventSubscriptions** and recorded in the **EventLog**.
- A **Script** listens for **Events** via the **EventBus** and enqueues **Actions** via the **ActionQueue** inside a **ScriptExecution**.
- A **ScriptExecution** contains one or more **ExecutionActions**, each with its own status, retry state, and optional `correlationId`.
- A **Dashboard** contains one or more **DashboardPages**, each holding **LayoutItems** that reference **Widgets**.
- **SettingsManager** and **CredentialStore** both write to **CoreDB**; **FeatureDB** is exclusive to its owning **Feature**.

## Example dialogue

> **Dev:** "When a user checks off a task, does that go through the **Action Queue**?"
>
> **Domain expert:** "Yes. The view calls `rpc.request["todo.complete"]`, which the Bun handler routes to the `todo` **Feature**'s `complete` **Action**. The **ActionQueue** persists it first, then executes. The Feature emits `todo:item-completed` on the **EventBus** after the write."
>
> **Dev:** "And if a **Script** is subscribed to that **Event**, it runs immediately?"
>
> **Domain expert:** "The **ScriptEngine** invokes it synchronously in the same process tick. Any **Actions** the Script enqueues get added to the **ActionQueue** as a new **ScriptExecution** — they're reliable even if the app crashes before they finish."
>
> **Dev:** "What if the same event fires twice before the action runs?"
>
> **Domain expert:** "Use a `correlationId`. The **ActionQueue** checks for an existing **ExecutionAction** with that id and returns the cached result instead of re-running."
>
> **Dev:** "Where does the daily journal pull its data from?"
>
> **Domain expert:** "From the **EventLog** — it queries all entries for the day and groups them by Feature. The EventLog is the only place where cross-Feature activity is recorded in one table."

## Flagged ambiguities

- **"action"** appears in three distinct senses: (1) a handler registered via `ctx.actions.handle()` inside a **Feature** — this is a *feature action*; (2) an **ExecutionAction** row in the **ActionQueue** — this is a *queued action record*; (3) informally, anything the user "does." Prefer **Action** (capitalised) for the domain concept, and qualify as *feature action* or *ExecutionAction* when the distinction matters.
- **"event"** is overloaded: (1) a live notification on the **EventBus**; (2) a row in the **EventLog**; (3) an **EventDeclaration** in the manifest. Use **Event** for the live notification, **EventLog entry** for the persisted record, and **EventDeclaration** for the manifest metadata.
- **"widget"** can mean the rendered UI component (a React component on screen) or a **WidgetDeclaration** in the manifest. Use **Widget** for the rendered UI and **WidgetDeclaration** for the manifest entry.
- **"install"** is used both as a Feature lifecycle hook (`feature.install()`) and colloquially for "installing the app." In code and conversation, **install** should refer only to the Feature lifecycle step — use *launch* or *first run* for the app-level concept.
- **"channel"** (build variant) is not yet used consistently — some code uses `NODE_ENV`, some uses the data directory path. The canonical term is **Channel**, and detection should use `Utils.paths.userData`, not `NODE_ENV`.
