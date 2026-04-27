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

- [x] `FeatureDefinition` interface fully implemented
- [x] Actions: `create`, `update`, `complete`, `delete` — all idempotent
- [x] Queries: `find` (with filters), `get-by-id`
- [x] Events emitted on state changes
- [x] Widget renders on dashboard grid (2×2 size)
- [x] Clicking widget opens full view
- [x] Full view supports add/edit/complete/delete todos
- [x] Settings panel for todo-specific preferences
- [x] Migrations create `todos` table in feature DB
- [x] Tests cover all actions, queries, event emission

---

## Phase 7: Event Bus

**User stories**: Real-time pub/sub between features. Events are delivered immediately to subscribers.

### What to build

Implement `EventBus` service. Features emit events via `ctx.events.emit()`. Other features and scripts subscribe via `ctx.subscribe()`. Events are fire-and-forget (no persistence — that's the event_log's job). Log all events to `event_log` table for debugging/journal.

### Acceptance criteria

- [x] `eventBus.emit("todo:item-completed", payload)` delivers to subscribers
- [x] Multiple subscribers receive the same event
- [x] Subscriber errors don't affect other subscribers or emitter
- [x] Events are logged to `event_log` table
- [x] Todo feature events are delivered when actions complete
- [x] Tests cover emit/subscribe, error isolation, logging

---

## Phase 8: Action Queue

**User stories**: Persistent, reliable action execution with retry and idempotency guarantees.

### What to build

Implement `ActionQueue` service backed by `script_executions` and `execution_actions` tables. Actions are written to DB before execution. Processor executes pending actions, retries on failure with exponential backoff. `correlationId` ensures idempotency — duplicate execution returns cached result. Support `dependsOn` for sequential execution and `output_key` for result referencing.

### Acceptance criteria

- [x] Actions persisted to DB before execution
- [x] Pending actions survive app crash and resume on restart
- [x] Failed actions retry with backoff (configurable max retries)
- [x] `correlationId` deduplication prevents double execution
- [x] `dependsOn` chains actions sequentially
- [x] `output_key` allows referencing previous action's result
- [x] Tests cover persistence, retry, idempotency, chaining

---

## Phase 9: Script Engine

**User stories**: User scripts can subscribe to events, invoke queries and actions, and persist state.

### What to build

Implement `ScriptEngine` service. Load scripts from `scripts` table. Provide `ScriptContext` with `on()`, `queries`, `actions`, `log()`, `store`. When event fires, invoke subscribed scripts. Script actions go through Action Queue for reliability. Per-script key-value store in `script_store` table.

### Acceptance criteria

- [x] Scripts loaded from DB on startup
- [x] `ctx.on("event", handler)` subscribes to events
- [x] `ctx.queries.todo.find(params)` invokes feature query
- [x] `ctx.actions.todo.create(params)` enqueues action
- [x] `ctx.store.get/set` persists per-script state
- [x] End-to-end: event → script → action queue → feature action
- [x] Tests cover script loading, event handling, action enqueuing

---

## Phase 10: Scheduler

**User stories**: Cron and interval tasks run reliably, persist across restarts.

### What to build

Implement `Scheduler` service backed by `scheduled_tasks` table. Support cron expressions and interval (milliseconds). Calculate `next_run_at`, execute when due. Persist last run status. Retry failed tasks with exponential backoff. Auto-disable after consecutive failures (configurable).

### Acceptance criteria

- [x] Cron tasks run at scheduled times
- [x] Interval tasks run repeatedly at configured interval
- [x] `next_run_at` persists — tasks resume after restart
- [x] Failed tasks retry with backoff
- [x] Auto-disable after 5 consecutive failures
- [x] Features register scheduled tasks via `ctx.scheduler.register()`
- [x] Tests cover cron parsing, interval execution, retry, auto-disable

---

## Phase 11: Pomodoro Feature

**User stories**: Timer-based productivity feature. Validates two features coexisting. First cross-feature automation.

### What to build

Implement Pomodoro feature with timer widget (1×1 or 2×1). Start/pause/reset controls. Configurable work/break durations. Emit `pomodoro:session-ended` event when timer completes. Create example script: when `pomodoro:session-ended` fires, create a todo "Review session".

### Acceptance criteria

- [x] Pomodoro widget renders timer with start/pause/reset
- [x] Timer counts down, plays notification on completion
- [x] `pomodoro:session-ended` event emitted with session data
- [x] Settings for work duration, break duration
- [x] Cross-feature script: `pomodoro:session-ended` → `todo:create`
- [x] Both Todo and Pomodoro features coexist without conflict
- [x] Tests cover timer logic, event emission

---

## Phase 12: RSS Reader Feature

**User stories**: Scheduled feed fetching with automation. Proves scheduler + network + events pipeline.

### What to build

Implement RSS Reader feature with scheduled feed polling. Parse RSS/Atom feeds. Store entries in feature DB. Emit `rss:new-entry` for each new entry. Widget shows recent entries (2×2). Full view for feed management. Settings for feed URLs. Create flagship automation script: `rss:new-entry` → `todo:create "Read: {title}"`.

### Acceptance criteria

- [x] Feed URLs configured in settings
- [x] Scheduler polls feeds at configured interval
- [x] New entries stored, `rss:new-entry` event emitted
- [x] Widget shows recent entries with title/date
- [x] Full view lists all entries, supports mark-read
- [x] Automation script creates todos from new entries
- [x] Tests cover feed parsing, entry storage, event emission

---

## Phase 12.1: RSS Reader — CORS Fix via Electrobun RPC

**User stories**: RSS feeds can actually be fetched. Adding a feed works without "Load failed" errors.

### Context

WKWebView blocks cross-origin network requests from the webview origin (`localhost:5173` in dev, `views://dashboard` in prod`). RSS feeds don't send `Access-Control-Allow-Origin` headers, so every `fetch(feedUrl)` in the browser fails with "Load failed". The fix is to route all RSS fetches through the Bun main process via Electrobun's typed RPC system.

### What to build

1. **`src/shell/shared/rpc-schema.ts`** (already created) — `AppRPCSchema` extending `ElectrobunRPCSchema` with `bun.requests["fetch-feed"]`: `{ params: { url: string }; response: string }`.

2. **`src/shell/bun/index.ts`** — Wire up `BrowserView.defineRPC<AppRPCSchema>` with a `"fetch-feed"` handler that calls Bun's native `fetch`, checks `res.ok`, and returns `res.text()`. Pass the resulting `rpc` object into `BrowserWindow` constructor.

3. **`src/shell/view/electrobun.ts`** (new file) — Browser-side: `Electroview.defineRPC<AppRPCSchema>` + `new Electroview({ rpc })`. Export the typed `rpc` object and an `overrideFetchXml(fn)` setter that `main.tsx` can call.

4. **`src/shell/view/main.tsx`** — Import `electrobun.ts`, call `overrideFetchXml(url => rpc.request["fetch-feed"]({ url }))` before rendering.

5. **`src/features/rss-reader/view/useRssReader.ts`** — Replace inline `fetch` with a module-level `_fetchXml` variable (default: browser `fetch` + `.text()`). Export `overrideFetchXml(fn: (url: string) => Promise<string>)` so the shell can inject the IPC-based fetcher without creating a `@features` → `@shell` dependency.

### Acceptance criteria

- [x] Adding an RSS feed URL succeeds (no "Load failed")
- [x] Feed entries appear after adding a feed
- [x] Refresh all works for existing feeds
- [x] No `@features` → `@shell` import dependency introduced

---

## Phase 13: Simple Widgets (Clock + Weather)

**User stories**: Widget-only features demonstrating simple use cases and external API integration.

### What to build

**Clock widget**: Simple 1×1 widget showing current time. Updates every second. Configurable format (12h/24h).

**Weather widget**: 1×1 or 2×1 widget showing current weather. Integrates with OpenWeatherMap API. User provides API key in settings. Configurable location.

Implement `CredentialStore` service for encrypted API key storage (backs the `credentials` table).

### Acceptance criteria

- [x] Clock widget shows current time, updates live
- [x] Clock settings for 12h/24h format
- [x] Weather widget shows temperature and conditions
- [x] Weather settings for API key and location
- [x] `CredentialStore` encrypts sensitive values at rest
- [x] Weather gracefully handles missing/invalid API key
- [x] Tests cover credential storage, weather API integration (mocked)

---

## Phase 13.1: Data Layer — Migrate Feature State from localStorage to SQLite

**User stories**: Feature data is isolated between dev and production builds. Data survives across sessions and is stored in the correct location per environment.

### Context / What went wrong

The architectural decision (see top of this file) states: _"Separate SQLite DB per feature. Core DB for orchestration. WAL mode on all databases."_ That decision was correct and intentional. However, every feature that was implemented since Phase 6 silently violated it by storing its UI state in `localStorage` instead.

**Affected files and their storage keys:**

| Feature | File | localStorage key |
|---|---|---|
| Todo | `src/features/todo/view/useTodos.ts` | `todo:todos` |
| RSS Reader | `src/features/rss-reader/view/useRssReader.ts` | `rss-reader:state` |
| Pomodoro | `src/features/pomodoro/view/usePomodoro.ts` | `pomodoro:state` |
| Weather | `src/features/weather/view/useWeather.ts` | `weather:state` |
| Clock | `src/features/clock/view/useClock.ts` | `clock:state` |
| Dashboard layout | `src/shell/view/App.tsx` | `dashboard:layout` |

The bun-side code (`src/features/*/bun/`) has correct SQLite migrations, actions, and queries — that work was done right. The problem is that the view layer (`src/features/*/view/`) never connected to it. Each hook re-implemented persistence independently using `localStorage` as a shortcut.

### Why this is wrong

**1. localStorage is shared across all Electrobun builds of the same app.**
Electrobun registers a WebKit `WKWebsiteDataStore` keyed to the bundle identifier (`dev.myos.app`). Every build — dev, canary, stable — shares the same data store UUID and therefore the same `localStorage`. There is no isolation. Adding an RSS source in dev immediately appears in the stable build and vice versa.

**2. localStorage is not accessible from the Bun process.**
The entire backend infrastructure (Event Bus, Action Queue, Script Engine, Scheduler) operates on data from SQLite. When a todo is created via `useTodos.ts` → localStorage, the `todo:item-created` event is never emitted, the Action Queue never records it, the Script Engine never reacts to it, and the Daily Journal (Phase 15) has nothing to aggregate. The features are not integrated — they are islands.

**3. localStorage has no migration path.**
SQLite migrations are versioned and tracked in the `migrations` table. localStorage has no schema, no versioning, and no tooling. Any data shape change silently drops existing user data.

**4. The acceptance criteria for Phase 6 were checked incorrectly.**
Phase 6 includes `[x] Migrations create todos table in feature DB`. The migration exists, but feature data is never written to that table. The check should not have been marked done.

### Root cause

The view hooks were written in isolation from the bun backend. Connecting the view to bun requires IPC (the same RPC pattern introduced in Phase 12.1 for RSS feed fetching). That plumbing was not in place when Phase 6 was implemented, so `localStorage` was used as a temporary substitute that was never replaced.

### Potential solutions

**Option A — Bun IPC bridge (correct, required)**
Extend `AppRPCSchema` with action/query handlers for each feature. View hooks call `rpc.request["todo.create"](params)` etc. instead of writing to localStorage. Bun processes the call, writes to SQLite, returns the result. This is the architecture the plan always described. It also enables the Event Bus, Action Queue, and Script Engine to receive real data.

**Option B — Keep localStorage, accept shared state**
Do nothing. All builds share the same data. This is incompatible with the core architectural goal of local-first, isolated feature databases, and it makes the entire backend infrastructure (Event Bus, Action Queue, Script Engine, Scheduler) meaningless in practice, since no real data flows through it.

Option B is not viable. Option A is the only correct path.

### What to build

1. **Define IPC schemas** for each feature — extend `AppRPCSchema` in `src/shell/shared/rpc-schema.ts` with request/response types covering the actions and queries already defined in `src/features/*/bun/`.

2. **Wire bun handlers** in `src/shell/bun/index.ts` — `BrowserView.defineRPC` handlers that delegate to the existing `FeatureRegistry` action/query dispatch.

3. **Rewrite view hooks** for each feature — replace `localStorage.getItem/setItem` with typed `rpc.request[...]` calls. Initial load calls the query; mutations call the action.

4. **Remove the `NODE_ENV === "production"` branch** in `src/core/bun/database-manager.ts` `resolveDefaultDataDir()` or fix it. Electrobun does not set `NODE_ENV=production` for packaged builds. Instead, detect the environment via `Utils.paths.userData` directly (it already includes the channel segment: `dev.myos.app/stable/` vs `dev.myos.app/dev/`), making SQLite data correctly isolated per channel.

5. **Clear the stale localStorage keys** on first load after migration (one-time migration).

### Acceptance criteria

- [x] Todo state is read from and written to `todos` table in feature DB, not localStorage
- [x] RSS Reader sources and entries are read from and written to RSS DB, not localStorage
- [x] Pomodoro state is persisted in feature DB
- [x] Weather and Clock settings are persisted in feature DB (or core settings table)
- [x] Dashboard layout is persisted in core DB `settings` table
- [x] Running dev build and stable build shows different (isolated) data
- [x] SQLite files for each feature are created under the correct channel path (`dev.myos.app/dev/` vs `dev.myos.app/stable/`)
- [x] Backend events are emitted when UI mutates state (e.g., `todo:item-created` fires on add)
- [x] All existing feature tests still pass

### Plan correction

The Architectural Decisions section at the top of this document was correct. The implementation of Phases 6, 11, 12, and 13 deviated from it. Phase 13.1 restores the implementation to match the stated design. No changes to the Architectural Decisions are needed.

---

## Phase 14: Core UX (Command Palette + Notification Center + Theming)

**User stories**: Core UX infrastructure for productivity. Search, notifications, appearance.

### What to build

**Command Palette**: `Cmd+K` opens search modal. Features register commands in manifest. Search across commands, recent items, navigation. Execute actions directly from palette.

**Notification Center**: Native OS notifications via Electrobun API. In-app bell icon with notification history. Per-feature notification preferences. Notification actions (click to navigate).

**Theming**: Light/dark/system toggle. Accent color picker. CSS custom properties for theme values. Persist preference in settings.

### Acceptance criteria

- [x] `Cmd+K` opens command palette
- [x] Palette searches registered commands across features
- [x] Selecting command executes associated action
- [x] Native notifications fire for important events
- [x] Bell icon shows notification history
- [x] Theme toggle switches light/dark/system
- [x] Accent color is configurable
- [x] Theme persists across restarts
- [x] Tests cover command registration, theme switching

---

## Phase 15: Daily Journal

**User stories**: Auto-generated daily page from cross-feature activity. Personal log with free-text notes.

### What to build

Implement Daily Journal feature. Automatically aggregate events from the day (completed todos, pomodoro sessions, RSS articles read). Generate daily page with timeline view. Support free-text notes. Searchable history. Widget shows today's summary.

### Acceptance criteria

- [x] Daily page auto-generated from cross-feature events
- [x] Timeline shows completed todos, pomodoro sessions, etc.
- [x] Free-text notes can be added to any day
- [x] Past days are browsable and searchable
- [x] Widget shows today's activity summary
- [x] Tests cover event aggregation, note persistence

---

## Phase 16: Global Search

**User stories**: Search across all features from one input.

### What to build

Implement Global Search in command palette or dedicated UI. Each feature registers a `search` query handler. Core fans out search query to all features in parallel, merges and ranks results. Results link to feature full views.

### Acceptance criteria

- [x] Single search input searches all features
- [x] Features implement `search` query in their contract
- [x] Results aggregated and ranked by relevance
- [x] Clicking result navigates to feature/item
- [x] Tests cover parallel query fanout, result merging

---

## Phase 17: Focus Mode

**User stories**: Distraction-free single-feature view.

### What to build

Implement Focus Mode toggle. Single keypress or command shows one feature full-screen with no dashboard chrome. Another press returns to dashboard. Remember last focused feature.

### Acceptance criteria

- [x] Keyboard shortcut enters focus mode
- [x] Selected feature renders full-screen, no grid/tabs
- [x] Same shortcut exits back to dashboard
- [x] Last focused feature is remembered
- [x] Command palette can enter focus mode for any feature

---

## Phase 18: Calendar Feature

**User stories**: Calendar sync with external calendars via ICS URLs.

### What to build

Implement Calendar feature. User provides ICS URLs (Google Calendar, etc.) in settings. Scheduled sync fetches events. Widget shows upcoming meetings (2×1). Full view shows week/month calendar. Events emit `calendar:event-starting` for notification triggers.

### Acceptance criteria

- [x] ICS URLs configured in settings
- [x] Scheduler syncs calendar data
- [x] Widget shows next N upcoming events
- [x] Full view renders week/month grid
- [x] `calendar:event-starting` emitted before events
- [x] Tests cover ICS parsing, event storage

---

## Phase 19: Habits Feature

**User stories**: Daily habit tracking with streaks.

### What to build

Implement Habits feature. Define habits with daily/weekly frequency. Track completion. Calculate and display streaks. Widget shows today's habits (2×1). Full view for habit management and history. Emit `habits:completed` events.

### Acceptance criteria

- [x] Habits can be created with name and frequency
- [x] Check off habits for current day
- [x] Streak calculation (consecutive days)
- [x] Widget shows today's habits with completion state
- [x] Full view shows habit list and streak history
- [x] Tests cover streak calculation, completion tracking

---

## Phase 20: Bookmarks Feature

**User stories**: Save and organize bookmarks.

### What to build

Implement Bookmarks feature. Save URLs with title, description, tags. Organize in folders or flat list. Quick-add from command palette or script. Widget shows recent bookmarks. Full view for browsing/search. Import OPML or browser bookmarks (stretch).

### Acceptance criteria

- [x] Bookmarks saved with title, URL, tags
- [x] Folder organization supported
- [x] Widget shows recent bookmarks
- [x] Full view with search and tag filtering
- [x] Command palette quick-add
- [x] Tests cover CRUD, tag filtering

---

## Phase 21: Countdowns Feature

**User stories**: Countdown timers to important dates.

### What to build

Implement Countdowns feature. Create countdowns with name and target date. Widget shows multiple countdowns (2×1). Full view for management. Emit `countdown:reached` when target date arrives.

### Acceptance criteria

- [x] Countdowns created with name and date
- [x] Widget shows days/hours remaining
- [x] Multiple countdowns displayed
- [x] `countdown:reached` event emitted
- [x] Completed countdowns can be archived
- [x] Tests cover countdown calculation, event emission

---

## Phase 22: Clipboard History (Nice-to-Have)

**User stories**: Track system clipboard, searchable history, scriptable automation.

### What to build

Implement Clipboard History feature. Watch system clipboard for changes. Store copies with timestamp. Searchable history. Widget shows recent clips. Scriptable: `clipboard:copied` event for automation (e.g., "when I copy a URL matching X, create bookmark").

### Acceptance criteria

- [x] System clipboard monitored for changes
- [x] Clipboard entries stored with timestamp
- [x] Widget shows recent clips
- [x] Full view with search
- [x] `clipboard:copied` event emitted
- [x] Tests cover entry storage, event emission

---

## Phase 24: App Options

**User stories**: App-wide configuration panel for appearance, data storage, and system info.

### What to build

**Entry point**: Gear icon in app shell (top-right corner). Wires to Command Palette in Phase 14.

**Full-screen overlay** with left sidebar navigation and right content area. Three sections:

**Appearance**: Background style for the app window. Solid color picker + a small set of built-in dark/gradient presets. (Photo upload deferred to a follow-up phase.)

**Data**: Shows current DB files directory (read-only path). "Change…" button opens native macOS folder picker (`osascript`). "Open in Finder" button. On change, displays a restart-required notice: *"Changes take effect on next launch. Copy your existing data files to the new location."*

**About**: App name, version (read from `package.json`), current data directory path, "Open in Finder" button, and a note: *"Back up this folder to preserve your data."*

**Window size**: Auto-remember last window bounds on close; restore on open. No UI needed — handled silently via settings.

### Technical notes

- New RPC endpoints: `app:get-options`, `app:update-options`, `app:get-data-dir`, `app:open-in-finder`, `app:pick-data-dir`
- Settings stored via `settingsManager` under scope `"app"`
- Native folder picker via `Bun.spawn` + `osascript` (macOS)
- Window bounds persisted via `settingsManager` on Electrobun window close event

### Acceptance criteria

- [ ] Gear icon visible in app shell; clicking opens the options overlay
- [ ] Appearance section: color picker and gradient presets update the app background; persists across restarts
- [ ] Data section: current DB path displayed; "Change…" opens native folder picker; selecting a new path shows restart notice
- [ ] Data section: "Open in Finder" opens the data directory in Finder
- [ ] About section: shows app name, version, data directory path, "Open in Finder", and backup note
- [ ] Window size and position are remembered across restarts
- [ ] Tests cover options read/write, data dir RPC, window bounds persistence

---

## Phase 23: Snippets (Nice-to-Have)

**User stories**: Reusable text templates with variables.

### What to build

Implement Snippets feature. Define templates with placeholder variables. Expand snippets via command palette or keyboard trigger. Variables can reference date, time, clipboard, or prompt user. Widget shows favorite snippets for quick access.

### Acceptance criteria

- [x] Snippets created with name and template text
- [x] Placeholder syntax (e.g., `{{date}}`, `{{clipboard}}`)
- [x] Expansion via command palette
- [x] Variable substitution at expansion time
- [x] Widget shows favorited snippets
- [x] Tests cover template parsing, variable substitution
