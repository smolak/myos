# Architecture Decision Rationale

> Companion to `ARCHITECTURE.md`. This document captures **why** each major decision was made, including alternatives that were considered and rejected. Consult this when revisiting past decisions or onboarding new contributors.

---

## Why Electrobun?

Electrobun produces ~14MB apps with ~14KB updates and <50ms startup. It uses Bun as the runtime (fast, TypeScript-native) and the OS's native webview (no bundled Chromium). This aligns with the lightweight, local-first philosophy. The Bun runtime also gives direct access to SQLite via `bun:sqlite`, native filesystem APIs, and fast HTTP serving — all needed for this project.

## Why Hybrid Plugin Architecture (Option C)?

Three options were considered:

- **Option A — True runtime plugins from day one.** Each plugin downloaded and loaded at runtime. Rejected because Electrobun compiles views at build time — there's no built-in concept of dynamically loading plugin UI. Building the entire runtime plugin loader, SDK, manifest format, and sandboxing before having a single working feature would delay shipping by months.
- **Option B — Monorepo with feature flags.** All features ship with the app, toggled on/off. Rejected because it permanently closes the door on a third-party marketplace and forces app size to grow with every feature.
- **Option C — Hybrid (chosen).** Design every feature as if it's a plugin (standard contract, isolated DB, event-based communication), but ship them built-in for phase 1. This lets you ship something useful quickly. Migrating to true runtime loading later becomes a mechanical exercise because the internal architecture already treats features as plugins.

## Why Separate SQLite Databases Per Feature?

A single shared database was considered. Rejected for these reasons:

- **Blast-radius isolation.** A corrupted RSS database doesn't destroy TODO data. With one DB, corruption affects everything.
- **Clean uninstall.** Removing a feature = deleting one file. No orphaned tables or migration cleanup.
- **Backup granularity.** Users can backup/restore a single feature without touching others.
- **Security for marketplace.** A third-party plugin cannot accidentally or maliciously read another plugin's tables.
- **Concurrent writes.** SQLite allows one writer at a time per file. Separate DBs means features don't block each other's writes.

**The tradeoff:** cross-feature SQL queries are impossible. A script that needs data from both TODO and RSS must make two separate calls through the query API and join in application code. This was accepted as the right constraint — it enforces the bounded-context isolation that the plugin architecture requires.

**The cross-transaction problem:** if a script creates a TODO and marks an RSS entry as processed, these are two separate transactions in two databases. If the second fails, the first already committed. This is solved by the Action Queue (persistent, with retries) and mandatory idempotency (the core checks `correlationId` before calling a handler, so replaying is safe).

## Why the Action Queue Exists

The action queue solves the fundamental problem of reliable cross-feature operations without shared transactions. When a script triggers actions across multiple features:

1. All actions are written to the core DB as a batch (single transaction, one DB) before any execution.
2. The action processor works through them sequentially, retrying failures.
3. If the app crashes, incomplete executions resume on restart.
4. `correlationId` prevents duplicate execution on retry.

Without this, a crash between "create TODO" and "mark RSS as processed" would silently lose the second operation with no recovery path.

## Why Core-Level Idempotency (Not Feature-Level)?

Two approaches were considered:

- **Feature authors implement idempotency themselves.** Rejected because some would forget or do it incorrectly, leading to duplicate data that's hard to debug.
- **Core enforces idempotency at the action queue level (chosen).** Before calling a feature's action handler, the core checks if the `correlationId` has already completed. If yes, it returns the cached result. Feature authors don't think about it. Features only need to handle idempotency for direct UI calls (not script-triggered), where simple DB constraints (`INSERT OR IGNORE`, unique indexes) suffice.

## Why nanoid Over UUID?

- Shorter (21 chars vs 36). Friendlier in logs, debug output, and any UI that shows IDs.
- URL-safe alphabet by default.
- Same collision resistance as UUIDv4 at 21 characters.
- Fast generation in Bun/JS, tiny dependency.
- **Why not ULID or UUIDv7 (time-sortable)?** For tables like `script_executions` and `execution_actions`, ordering is handled by explicit `created_at` columns and `sequence` numbers. Time-encoded IDs add complexity without benefit. The event log uses `INTEGER AUTOINCREMENT` because it's the one table where insertion order is the primary access pattern.

## Why React (Not Svelte, Solid, or Preact)?

Performance differences between frameworks are irrelevant in a desktop app with a native webview — there's no network bundle transfer and no thousands-of-items rendering. The deciding factor is the **marketplace vision**: when third-party developers build plugins, React is what most of them will know. Developer familiarity and ecosystem size win over marginal technical advantages.

## Why Shared DOM With Error Boundaries (Not Iframes)?

Four options were evaluated:

- **Shared DOM, no isolation.** A buggy widget crashes the entire dashboard. Too risky.
- **Iframes per widget.** Complete isolation, but heavy (each is a separate browsing context), poor UX (no shared styling, focus issues), and complex communication (`postMessage` for everything). Overkill for phase 1 where all code is first-party.
- **Web Components (Shadow DOM).** CSS isolation but no JS isolation. Awkward with React. Worst of both worlds.
- **Shared DOM with Error Boundaries (chosen).** Each widget wrapped in a React Error Boundary. A crashing widget shows a fallback card; others continue. No CSS isolation, but Tailwind utility classes and a shared `@core/ui` component library ensure visual consistency. When the marketplace arrives, untrusted third-party plugins can use iframes while reviewed/trusted plugins use shared DOM.

## Why `react-grid-layout` (Not Custom)?

Purpose-built for dashboard grids. Supports drag-and-drop, resize, responsive breakpoints, size constraints, and serializable layout state. Used by Grafana and Jupyter. Directly maps to the predefined widget size system (small/medium/wide/full-width). Building this from scratch with `dnd-kit` or raw CSS Grid would take weeks for an inferior result.

## Why a Tray App (Always Running)?

Features like RSS, weather, and calendar need background data sync regardless of whether the dashboard is visible. This requires the Bun main process to stay alive. The tray app pattern (Electrobun: `runtime.exitOnLastWindowClosed: false` + `Tray` API) solves this — the process runs background tasks, the window is shown/hidden on demand. When hidden, the webview can be suspended to save memory while the Bun process stays lean.

## Why Persistent Scheduler With Priority Queue?

Three options were considered:

- **Simple `setInterval` per task.** No persistence — if the app restarts, it doesn't know when tasks last ran, so it runs everything immediately. No catch-up logic, no retry, no visibility into task history.
- **Persistent cron-like scheduler (data model).** Tasks stored in SQLite with schedule, last run time, next run time. Survives restarts, supports catch-up on missed tasks, provides visibility ("last synced 5 min ago").
- **Priority queue (execution engine).** A single sorted queue of "next task to run" — one timer instead of N independent intervals. More efficient.

The chosen approach combines the persistent data model with the priority queue execution engine. Both cron expressions ("every weekday at 9am") and intervals ("every 15 minutes") are supported to give maximum flexibility to feature authors.

## Why Scripts Are Internal-Only (No Network/Filesystem)?

Scripts are glue between features — they react to events and call feature actions. Allowing network or filesystem access would:

1. Create a massive security surface for the marketplace (malicious scripts exfiltrating data).
2. Make sandboxing dramatically harder (the `ScriptContext` API is small and fully controlled).
3. Blur the boundary between scripts and features (if a script can fetch URLs, it's just a feature without a UI).

The constraint is: if you need network or filesystem, build a feature. Scripts compose features; they don't replace them.

## Why "Bring Your Own Credentials" for Auth?

Shipping a default OAuth client ID (e.g., for Google Calendar) creates problems:

- **Single point of failure.** If the developer's Google Cloud account is compromised, every user's integration breaks.
- **Bus factor.** If the project is abandoned, Google can revoke the OAuth client. The app breaks for a reason unrelated to code.
- **Cost.** Google's OAuth verification for sensitive scopes (like calendar read) may require a third-party security audit costing $15,000–$75,000.
- **Philosophy conflict.** Shipping your credentials makes you an intermediary — the opposite of the app's independence mission.

Instead, the app uses the simplest auth method per service. Google Calendar can be accessed via ICS URL (read-only, no OAuth needed — user just copies a URL from Google Calendar settings). When OAuth is truly needed, the loopback redirect pattern (temporary `Bun.serve()` on localhost) lets users authenticate with their own GCP credentials.

## Why Todo List as the First Feature?

The first feature must exercise the most core infrastructure with the least external complexity. Todo List scores highest because:

- **Zero network dependency.** No API debugging when you should be debugging the core.
- **Full contract coverage.** Needs multiple actions (create, update, complete, delete), multiple queries (list, find, count), events (item-created, item-completed), both widget and full view, settings, and DB migrations.
- **Immediately useful.** Usable from day one while building other features.
- **Script engine testbed.** Can test events and scripts before a second feature exists.
- **Cross-feature proof.** When RSS is built second, the "RSS entry creates TODO" script immediately proves the entire event → script → action queue → cross-feature pipeline.

## Why Vertical Slice + Microkernel (Not Pure DDD)?

The architecture borrows from DDD (bounded contexts, anti-corruption layers, event-driven communication) but does not adopt DDD tactical patterns (Aggregates, Repositories, Value Objects, Domain Services). These patterns add ceremony that's overkill for moderately complex CRUD features like a TODO list or RSS reader.

- **Microkernel** is the dominant pattern: minimal core provides infrastructure, features are plugins.
- **Vertical Slice** is the organizational pattern: each feature owns everything (backend, frontend, types, migrations) in one folder. A feature can be understood, added, or removed as a single unit.
- This combination directly supports the marketplace vision — a plugin is a self-contained folder with a known structure.

## Why 90-Day Event Log Retention?

The event log is an operational tool for debugging scripts and auditing cross-feature interactions. It is not a long-term data warehouse. Features that need permanent history (habits streaks, pomodoro statistics) store that in their own databases as structured analytics, not as raw events. 90 days (configurable) balances debuggability with storage growth. Auto-pruning keeps the hot table fast.

## Why Backup Is a Core Service (Not a Feature)?

Backups need privileged access to all DB files — core and every feature. A normal feature only has access to its own DB through the `FeatureContext`. Making backups a feature would require special permissions that break the "no first-class privileges" principle. Instead, the backup system is part of the core, alongside the scheduler, event bus, and database manager. It's the one piece that legitimately needs cross-cutting access.

---

## Reference Implementation: RSS Feature

To illustrate how the feature contract works in practice, here is a detailed example of how the RSS Reader feature would be implemented:

```typescript
// src/features/rss/bun/index.ts

const rssFeature: FeatureDefinition<RSSEvents, RSSActions, RSSQueries> = {
  id: "rss-reader",
  name: "RSS Reader",
  version: "1.0.0",

  migrations: [
    {
      version: "001",
      up: `
        CREATE TABLE feeds (
          id TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          title TEXT,
          last_fetched_at TEXT,
          fetch_interval INTEGER NOT NULL DEFAULT 900000
        );
        CREATE TABLE entries (
          id TEXT PRIMARY KEY,
          feed_id TEXT NOT NULL REFERENCES feeds(id),
          title TEXT NOT NULL,
          url TEXT,
          content TEXT,
          published_at TEXT,
          read INTEGER NOT NULL DEFAULT 0,
          processed INTEGER NOT NULL DEFAULT 0,
          fetched_at TEXT NOT NULL
        );
      `,
    },
  ],

  manifest: {
    events: {
      "new-entry": {
        payload: {
          entryId: "string",
          title: "string",
          url: "string",
          feedId: "string",
        },
      },
      "feed-updated": {
        payload: { feedId: "string", newCount: "number" },
      },
    },
    actions: {
      "mark-read": {
        params: { entryId: "string" },
        result: { success: "boolean" },
      },
      "mark-processed": {
        params: { entryId: "string" },
        result: { success: "boolean" },
      },
      "add-feed": {
        params: { url: "string" },
        result: { feedId: "string" },
      },
    },
    queries: {
      "get-entries": {
        params: { feedId: "string?", unreadOnly: "boolean?" },
        result: "Entry[]",
      },
      "get-feeds": { params: {}, result: "Feed[]" },
      find: { params: { linkedUrl: "string?" }, result: "Entry[]" },
    },
    permissions: [{ type: "network", reason: "Fetch RSS feeds from external URLs" }],
    scheduledTasks: [
      {
        id: "fetch-feeds",
        defaultSchedule: { type: "interval", value: 900000 },
      },
    ],
    widgets: [{ id: "feed-list", sizes: ["medium", "wide"] }],
    commands: [
      { id: "rss:add-feed", label: "Add RSS Feed", params: ["url"] },
      { id: "rss:search", label: "Search RSS Entries", params: ["query"] },
    ],
  },

  async install(ctx) {},

  async activate(ctx) {
    ctx.actions.handle("mark-read", async ({ entryId }, meta) => {
      ctx.db.run(
        "UPDATE entries SET read = 1 WHERE id = ? AND read = 0",
        [entryId],
      );
      return { success: true };
    });

    ctx.actions.handle("mark-processed", async ({ entryId }, meta) => {
      ctx.db.run(
        "UPDATE entries SET processed = 1 WHERE id = ? AND processed = 0",
        [entryId],
      );
      return { success: true };
    });

    ctx.queries.handle("get-entries", async ({ feedId, unreadOnly }) => {
      let sql = "SELECT * FROM entries WHERE 1=1";
      const params: any[] = [];
      if (feedId) {
        sql += " AND feed_id = ?";
        params.push(feedId);
      }
      if (unreadOnly) {
        sql += " AND read = 0";
      }
      return ctx.db.query(sql).all(...params);
    });

    ctx.scheduler.register("fetch-feeds", async () => {
      const feeds = ctx.db.query("SELECT * FROM feeds").all();
      for (const feed of feeds) {
        const newEntries = await fetchAndParseFeed(feed.url);
        for (const entry of newEntries) {
          ctx.db.run("INSERT OR IGNORE INTO entries ...", []);
          ctx.events.emit("new-entry", {
            entryId: entry.id,
            title: entry.title,
            url: entry.url,
            feedId: feed.id,
          });
        }
        ctx.events.emit("feed-updated", {
          feedId: feed.id,
          newCount: newEntries.length,
        });
      }
    });
  },

  async deactivate() {},
  async uninstall(ctx) {},
};
```
