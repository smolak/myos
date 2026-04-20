# Plan: Local-First Productivity Dashboard

> Source PRD: `specs/ARCHITECTURE.md`

## Architectural Decisions

Durable decisions that apply across all phases:

- **Runtime**: Electrobun (TypeScript + Bun + native webview)
- **App model**: Tray app, always running. Single dashboard window shown/hidden via tray icon or global shortcut. `runtime.exitOnLastWindowClosed: false`.
- **UI stack**: React + Tailwind CSS + Vite. shadcn/ui as `@core/ui`. `react-grid-layout` for dashboard grid.
- **Data layer**: Separate SQLite DB per feature. Core DB for orchestration. WAL mode on all databases.
- **ID strategy**: `nanoid` (21 chars) for generated IDs. `INTEGER AUTOINCREMENT` only for `event_log`.
- **Feature contract**: Every feature implements `FeatureDefinition` interface with `install`, `activate`, `deactivate`, `uninstall` lifecycle. Exposes events, actions, queries via manifest.
- **Cross-feature communication**: Event Bus for pub/sub. Action Queue for reliable writes. No direct cross-feature action invocation — events trigger scripts, scripts enqueue actions.
- **Path aliases**: `@core/*` → `src/core/*`, `@shell/*` → `src/shell/*`, `@features/*` → `src/features/*`
- **Naming**: Event names kebab-case namespaced (`rss:new-entry`). Feature IDs lowercase kebab-case (`todo`, `rss-reader`).

---

## Phase 1: Tray App + Window Show/Hide

**User stories**: App runs as a tray application. Dashboard window can be shown/hidden via tray icon click.

### What to build

Convert the current `BrowserWindow` setup into a tray-based app. The Bun main process stays alive when the window is closed. Clicking the tray icon toggles window visibility. Window close hides the window instead of quitting the app.

### Acceptance criteria

- [x] Tray icon appears in system tray on app start
- [x] Clicking tray icon shows the window if hidden, hides if visible
- [x] Closing the window hides it (does not quit the app)
- [x] App continues running in background with no visible windows
- [x] Quitting via tray menu (or Cmd+Q) actually terminates the app

---

## Phase 2: Database Manager + Core Schema

**User stories**: Core database exists with all orchestration tables. Per-feature database creation is supported.

### What to build

Implement `DatabaseManager` service that creates and manages SQLite databases. On startup, create `core.db` with all core tables (features, scheduled_tasks, script_executions, execution_actions, scripts, script_subscriptions, script_store, event_log, settings, credentials, migrations). Enable WAL mode. Provide API for creating per-feature databases.

### Acceptance criteria

- [x] `core.db` is created in app data directory on first launch
- [x] All core schema tables exist per `ARCHITECTURE.md` § Core Database Schema
- [x] WAL mode is enabled on all databases
- [x] `DatabaseManager.createFeatureDb(featureId)` creates isolated per-feature DB
- [x] Migration tracking table records applied migrations
- [x] Tests cover DB creation, WAL mode verification, migration tracking

---

## Phase 3: Settings Manager

**User stories**: Settings can be stored and retrieved at global and per-feature scope.

### What to build

Implement `SettingsManager` service backed by the `settings` table in core DB. Support `get(scope, key, defaultValue)` and `set(scope, key, value)` operations. Scope is either `"global"` or a feature ID.

### Acceptance criteria

- [x] `settings.get("global", "theme", "system")` returns default if not set
- [x] `settings.set("global", "theme", "dark")` persists value
- [x] Subsequent `get` returns persisted value
- [x] Per-feature settings are isolated by scope
- [x] Tests cover get/set, default values, scope isolation

---

## Phase 4: Feature Registry

**User stories**: Features can be registered, installed, and activated. Lifecycle hooks are called in correct order.

### What to build

Implement `FeatureRegistry` service. On startup, scan for features, run `install` (if first time), then `activate`. Track enabled/disabled state in `features` table. Provide `FeatureContext` to each feature during activation. Handle activation failures gracefully (auto-disable, continue with other features).

### Acceptance criteria

- [x] Features are discovered and registered on startup
- [x] `install` runs once on first registration, persisted in DB
- [x] `activate` runs on every startup for enabled features
- [x] `FeatureContext` is provided with `db`, `events`, `actions`, `queries`, `settings`, `log`
- [x] Feature that throws during `activate` is auto-disabled, app continues
- [x] Tests cover lifecycle order, error handling, context provision

---

## Phase 5: Dashboard Grid Shell

**User stories**: Dashboard renders an empty grid. Placeholder state indicates no widgets configured.

### What to build

Replace the current demo `App.tsx` with the dashboard shell. Implement `DashboardGrid` using `react-grid-layout`. Show "No widgets configured" placeholder when layout is empty. Support multiple named dashboard pages (data structure only — page switching UI in later phase). Persist layout to settings.

### Acceptance criteria

- [x] Dashboard grid renders with `react-grid-layout`
- [x] Empty state shows "No widgets configured" placeholder
- [x] Layout is persisted to settings (survives restart)
- [x] `DashboardPage` and `LayoutItem` types match ARCHITECTURE.md
- [x] Grid supports predefined widget sizes (1×1, 2×1, 2×2, 4×1)

---

## Phase 6: Todo Feature (Full)

**User stories**: Full todo list feature proving the `FeatureDefinition` contract. CRUD operations, widget, full view, settings.

### What to build

Implement the Todo feature as the reference implementation of `FeatureDefinition`. Full CRUD actions (`create`, `update`, `complete`, `delete`). Queries (`find`, `get-by-id`). Events (`todo:item-created`, `todo:item-completed`, `todo:item-deleted`). Widget showing recent/active todos. Full view for complete todo management. Settings panel for feature preferences. Migrations for todo schema.

### Acceptance criteria

- [ ] `FeatureDefinition` interface fully implemented
- [ ] Actions: `create`, `update`, `complete`, `delete` — all idempotent
- [ ] Queries: `find` (with filters), `get-by-id`
- [ ] Events emitted on state changes
- [ ] Widget renders on dashboard grid (2×2 size)
- [ ] Clicking widget opens full view
- [ ] Full view supports add/edit/complete/delete todos
- [ ] Settings panel for todo-specific preferences
- [ ] Migrations create `todos` table in feature DB
- [ ] Tests cover all actions, queries, event emission

---

## Phase 7: Event Bus

**User stories**: Real-time pub/sub between features. Events are delivered immediately to subscribers.

### What to build

Implement `EventBus` service. Features emit events via `ctx.events.emit()`. Other features and scripts subscribe via `ctx.subscribe()`. Events are fire-and-forget (no persistence — that's the event_log's job). Log all events to `event_log` table for debugging/journal.

### Acceptance criteria

- [ ] `eventBus.emit("todo:item-completed", payload)` delivers to subscribers
- [ ] Multiple subscribers receive the same event
- [ ] Subscriber errors don't affect other subscribers or emitter
- [ ] Events are logged to `event_log` table
- [ ] Todo feature events are delivered when actions complete
- [ ] Tests cover emit/subscribe, error isolation, logging

---

## Phase 8: Action Queue

**User stories**: Persistent, reliable action execution with retry and idempotency guarantees.

### What to build

Implement `ActionQueue` service backed by `script_executions` and `execution_actions` tables. Actions are written to DB before execution. Processor executes pending actions, retries on failure with exponential backoff. `correlationId` ensures idempotency — duplicate execution returns cached result. Support `dependsOn` for sequential execution and `output_key` for result referencing.

### Acceptance criteria

- [ ] Actions persisted to DB before execution
- [ ] Pending actions survive app crash and resume on restart
- [ ] Failed actions retry with backoff (configurable max retries)
- [ ] `correlationId` deduplication prevents double execution
- [ ] `dependsOn` chains actions sequentially
- [ ] `output_key` allows referencing previous action's result
- [ ] Tests cover persistence, retry, idempotency, chaining

---

## Phase 9: Script Engine

**User stories**: User scripts can subscribe to events, invoke queries and actions, and persist state.

### What to build

Implement `ScriptEngine` service. Load scripts from `scripts` table. Provide `ScriptContext` with `on()`, `queries`, `actions`, `log()`, `store`. When event fires, invoke subscribed scripts. Script actions go through Action Queue for reliability. Per-script key-value store in `script_store` table.

### Acceptance criteria

- [ ] Scripts loaded from DB on startup
- [ ] `ctx.on("event", handler)` subscribes to events
- [ ] `ctx.queries.todo.find(params)` invokes feature query
- [ ] `ctx.actions.todo.create(params)` enqueues action
- [ ] `ctx.store.get/set` persists per-script state
- [ ] End-to-end: event → script → action queue → feature action
- [ ] Tests cover script loading, event handling, action enqueuing

---

## Phase 10: Scheduler

**User stories**: Cron and interval tasks run reliably, persist across restarts.

### What to build

Implement `Scheduler` service backed by `scheduled_tasks` table. Support cron expressions and interval (milliseconds). Calculate `next_run_at`, execute when due. Persist last run status. Retry failed tasks with exponential backoff. Auto-disable after consecutive failures (configurable).

### Acceptance criteria

- [ ] Cron tasks run at scheduled times
- [ ] Interval tasks run repeatedly at configured interval
- [ ] `next_run_at` persists — tasks resume after restart
- [ ] Failed tasks retry with backoff
- [ ] Auto-disable after 5 consecutive failures
- [ ] Features register scheduled tasks via `ctx.scheduler.register()`
- [ ] Tests cover cron parsing, interval execution, retry, auto-disable

---

## Phase 11: Pomodoro Feature

**User stories**: Timer-based productivity feature. Validates two features coexisting. First cross-feature automation.

### What to build

Implement Pomodoro feature with timer widget (1×1 or 2×1). Start/pause/reset controls. Configurable work/break durations. Emit `pomodoro:session-ended` event when timer completes. Create example script: when `pomodoro:session-ended` fires, create a todo "Review session".

### Acceptance criteria

- [ ] Pomodoro widget renders timer with start/pause/reset
- [ ] Timer counts down, plays notification on completion
- [ ] `pomodoro:session-ended` event emitted with session data
- [ ] Settings for work duration, break duration
- [ ] Cross-feature script: `pomodoro:session-ended` → `todo:create`
- [ ] Both Todo and Pomodoro features coexist without conflict
- [ ] Tests cover timer logic, event emission

---

## Phase 12: RSS Reader Feature

**User stories**: Scheduled feed fetching with automation. Proves scheduler + network + events pipeline.

### What to build

Implement RSS Reader feature with scheduled feed polling. Parse RSS/Atom feeds. Store entries in feature DB. Emit `rss:new-entry` for each new entry. Widget shows recent entries (2×2). Full view for feed management. Settings for feed URLs. Create flagship automation script: `rss:new-entry` → `todo:create "Read: {title}"`.

### Acceptance criteria

- [ ] Feed URLs configured in settings
- [ ] Scheduler polls feeds at configured interval
- [ ] New entries stored, `rss:new-entry` event emitted
- [ ] Widget shows recent entries with title/date
- [ ] Full view lists all entries, supports mark-read
- [ ] Automation script creates todos from new entries
- [ ] Tests cover feed parsing, entry storage, event emission

---

## Phase 13: Simple Widgets (Clock + Weather)

**User stories**: Widget-only features demonstrating simple use cases and external API integration.

### What to build

**Clock widget**: Simple 1×1 widget showing current time. Updates every second. Configurable format (12h/24h).

**Weather widget**: 1×1 or 2×1 widget showing current weather. Integrates with OpenWeatherMap API. User provides API key in settings. Configurable location.

Implement `CredentialStore` service for encrypted API key storage (backs the `credentials` table).

### Acceptance criteria

- [ ] Clock widget shows current time, updates live
- [ ] Clock settings for 12h/24h format
- [ ] Weather widget shows temperature and conditions
- [ ] Weather settings for API key and location
- [ ] `CredentialStore` encrypts sensitive values at rest
- [ ] Weather gracefully handles missing/invalid API key
- [ ] Tests cover credential storage, weather API integration (mocked)

---

## Phase 14: Core UX (Command Palette + Notification Center + Theming)

**User stories**: Core UX infrastructure for productivity. Search, notifications, appearance.

### What to build

**Command Palette**: `Cmd+K` opens search modal. Features register commands in manifest. Search across commands, recent items, navigation. Execute actions directly from palette.

**Notification Center**: Native OS notifications via Electrobun API. In-app bell icon with notification history. Per-feature notification preferences. Notification actions (click to navigate).

**Theming**: Light/dark/system toggle. Accent color picker. CSS custom properties for theme values. Persist preference in settings.

### Acceptance criteria

- [ ] `Cmd+K` opens command palette
- [ ] Palette searches registered commands across features
- [ ] Selecting command executes associated action
- [ ] Native notifications fire for important events
- [ ] Bell icon shows notification history
- [ ] Theme toggle switches light/dark/system
- [ ] Accent color is configurable
- [ ] Theme persists across restarts
- [ ] Tests cover command registration, theme switching

---

## Phase 15: Daily Journal

**User stories**: Auto-generated daily page from cross-feature activity. Personal log with free-text notes.

### What to build

Implement Daily Journal feature. Automatically aggregate events from the day (completed todos, pomodoro sessions, RSS articles read). Generate daily page with timeline view. Support free-text notes. Searchable history. Widget shows today's summary.

### Acceptance criteria

- [ ] Daily page auto-generated from cross-feature events
- [ ] Timeline shows completed todos, pomodoro sessions, etc.
- [ ] Free-text notes can be added to any day
- [ ] Past days are browsable and searchable
- [ ] Widget shows today's activity summary
- [ ] Tests cover event aggregation, note persistence

---

## Phase 16: Global Search

**User stories**: Search across all features from one input.

### What to build

Implement Global Search in command palette or dedicated UI. Each feature registers a `search` query handler. Core fans out search query to all features in parallel, merges and ranks results. Results link to feature full views.

### Acceptance criteria

- [ ] Single search input searches all features
- [ ] Features implement `search` query in their contract
- [ ] Results aggregated and ranked by relevance
- [ ] Clicking result navigates to feature/item
- [ ] Tests cover parallel query fanout, result merging

---

## Phase 17: Focus Mode

**User stories**: Distraction-free single-feature view.

### What to build

Implement Focus Mode toggle. Single keypress or command shows one feature full-screen with no dashboard chrome. Another press returns to dashboard. Remember last focused feature.

### Acceptance criteria

- [ ] Keyboard shortcut enters focus mode
- [ ] Selected feature renders full-screen, no grid/tabs
- [ ] Same shortcut exits back to dashboard
- [ ] Last focused feature is remembered
- [ ] Command palette can enter focus mode for any feature

---

## Phase 18: Calendar Feature

**User stories**: Calendar sync with external calendars via ICS URLs.

### What to build

Implement Calendar feature. User provides ICS URLs (Google Calendar, etc.) in settings. Scheduled sync fetches events. Widget shows upcoming meetings (2×1). Full view shows week/month calendar. Events emit `calendar:event-starting` for notification triggers.

### Acceptance criteria

- [ ] ICS URLs configured in settings
- [ ] Scheduler syncs calendar data
- [ ] Widget shows next N upcoming events
- [ ] Full view renders week/month grid
- [ ] `calendar:event-starting` emitted before events
- [ ] Tests cover ICS parsing, event storage

---

## Phase 19: Habits Feature

**User stories**: Daily habit tracking with streaks.

### What to build

Implement Habits feature. Define habits with daily/weekly frequency. Track completion. Calculate and display streaks. Widget shows today's habits (2×1). Full view for habit management and history. Emit `habits:completed` events.

### Acceptance criteria

- [ ] Habits can be created with name and frequency
- [ ] Check off habits for current day
- [ ] Streak calculation (consecutive days)
- [ ] Widget shows today's habits with completion state
- [ ] Full view shows habit list and streak history
- [ ] Tests cover streak calculation, completion tracking

---

## Phase 20: Bookmarks Feature

**User stories**: Save and organize bookmarks.

### What to build

Implement Bookmarks feature. Save URLs with title, description, tags. Organize in folders or flat list. Quick-add from command palette or script. Widget shows recent bookmarks. Full view for browsing/search. Import OPML or browser bookmarks (stretch).

### Acceptance criteria

- [ ] Bookmarks saved with title, URL, tags
- [ ] Folder organization supported
- [ ] Widget shows recent bookmarks
- [ ] Full view with search and tag filtering
- [ ] Command palette quick-add
- [ ] Tests cover CRUD, tag filtering

---

## Phase 21: Countdowns Feature

**User stories**: Countdown timers to important dates.

### What to build

Implement Countdowns feature. Create countdowns with name and target date. Widget shows multiple countdowns (2×1). Full view for management. Emit `countdown:reached` when target date arrives.

### Acceptance criteria

- [ ] Countdowns created with name and date
- [ ] Widget shows days/hours remaining
- [ ] Multiple countdowns displayed
- [ ] `countdown:reached` event emitted
- [ ] Completed countdowns can be archived
- [ ] Tests cover countdown calculation, event emission

---

## Phase 22: Clipboard History (Nice-to-Have)

**User stories**: Track system clipboard, searchable history, scriptable automation.

### What to build

Implement Clipboard History feature. Watch system clipboard for changes. Store copies with timestamp. Searchable history. Widget shows recent clips. Scriptable: `clipboard:copied` event for automation (e.g., "when I copy a URL matching X, create bookmark").

### Acceptance criteria

- [ ] System clipboard monitored for changes
- [ ] Clipboard entries stored with timestamp
- [ ] Widget shows recent clips
- [ ] Full view with search
- [ ] `clipboard:copied` event emitted
- [ ] Tests cover entry storage, event emission

---

## Phase 23: Snippets (Nice-to-Have)

**User stories**: Reusable text templates with variables.

### What to build

Implement Snippets feature. Define templates with placeholder variables. Expand snippets via command palette or keyboard trigger. Variables can reference date, time, clipboard, or prompt user. Widget shows favorite snippets for quick access.

### Acceptance criteria

- [ ] Snippets created with name and template text
- [ ] Placeholder syntax (e.g., `{{date}}`, `{{clipboard}}`)
- [ ] Expansion via command palette
- [ ] Variable substitution at expansion time
- [ ] Widget shows favorited snippets
- [ ] Tests cover template parsing, variable substitution
