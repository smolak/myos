import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ActionQueue } from "@core/bun/action-queue";
import { CredentialStore } from "@core/bun/credential-store";
import { DatabaseManager } from "@core/bun/database-manager";
import { EventBus } from "@core/bun/event-bus";
import { FeatureRegistry } from "@core/bun/feature-registry";
import { Scheduler } from "@core/bun/scheduler";
import { ScriptEngine } from "@core/bun/script-engine";
import { SettingsManager } from "@core/bun/settings-manager";
import { rssReaderFeature } from "./index";

describe("rssReaderFeature definition", () => {
  test("has id 'rss-reader'", () => {
    expect(rssReaderFeature.id).toBe("rss-reader");
  });

  test("has a non-empty name", () => {
    expect(rssReaderFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(rssReaderFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has migrations for feeds and entries tables", () => {
    expect(rssReaderFeature.migrations).toHaveLength(2);
    expect(rssReaderFeature.migrations[0]?.up).toContain("CREATE TABLE rss_feeds");
    expect(rssReaderFeature.migrations[1]?.up).toContain("CREATE TABLE rss_entries");
  });

  test("manifest declares all actions", () => {
    const keys = Object.keys(rssReaderFeature.manifest.actions);
    expect(keys).toContain("add-feed");
    expect(keys).toContain("delete-feed");
    expect(keys).toContain("fetch-feeds");
    expect(keys).toContain("mark-read");
    expect(keys).toContain("mark-unread");
  });

  test("manifest declares all queries", () => {
    const keys = Object.keys(rssReaderFeature.manifest.queries);
    expect(keys).toContain("get-feeds");
    expect(keys).toContain("get-entries");
    expect(keys).toContain("get-unread-count");
  });

  test("manifest declares all events", () => {
    const keys = Object.keys(rssReaderFeature.manifest.events);
    expect(keys).toContain("rss:feed-added");
    expect(keys).toContain("rss:feed-deleted");
    expect(keys).toContain("rss:new-entry");
    expect(keys).toContain("rss:entry-read");
  });

  test("manifest declares feed-list widget with medium and wide sizes", () => {
    const widget = rssReaderFeature.manifest.widgets.find((w) => w.id === "feed-list");
    expect(widget).toBeDefined();
    expect(widget?.sizes).toContain("medium");
    expect(widget?.sizes).toContain("wide");
  });

  test("manifest declares network permission", () => {
    const perm = rssReaderFeature.manifest.permissions.find((p) => p.type === "network");
    expect(perm).toBeDefined();
  });

  test("manifest declares scheduled fetch task", () => {
    const task = rssReaderFeature.manifest.scheduledTasks.find((t) => t.id === "rss-reader:fetch-feeds");
    expect(task).toBeDefined();
    expect(task?.defaultSchedule.type).toBe("interval");
  });
});

describe("rssReaderFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-feature-"));
    dbManager = new DatabaseManager(tmpDir);
    const coreDb = dbManager.getCoreDatabase();
    const settingsManager = new SettingsManager(coreDb);
    const credentialStore = new CredentialStore(coreDb);
    const eventBus = new EventBus(coreDb);
    const actionQueue = new ActionQueue(coreDb, 0);
    const scheduler = new Scheduler(coreDb, 60_000, 0);
    registry = new FeatureRegistry(dbManager, settingsManager, credentialStore, eventBus, actionQueue, scheduler);
  });

  afterEach(async () => {
    dbManager.closeAll();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("creates rss_feeds and rss_entries tables on first startup", async () => {
    await registry.startup([rssReaderFeature]);
    const featureDb = dbManager.getFeatureDatabase("rss-reader");
    const feeds = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='rss_feeds'")
      .get();
    const entries = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='rss_entries'")
      .get();
    expect(feeds?.name).toBe("rss_feeds");
    expect(entries?.name).toBe("rss_entries");
  });

  test("registers as enabled in the features table", async () => {
    await registry.startup([rssReaderFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb
      .query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
      .get("rss-reader");
    expect(row?.enabled).toBe(1);
  });

  test("install runs only once across two startups", async () => {
    let installCount = 0;
    const tracked = {
      ...rssReaderFeature,
      install: async (...args: Parameters<typeof rssReaderFeature.install>) => {
        installCount++;
        return rssReaderFeature.install(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(installCount).toBe(1);
  });

  test("activate runs on every startup", async () => {
    let activateCount = 0;
    const tracked = {
      ...rssReaderFeature,
      activate: async (...args: Parameters<typeof rssReaderFeature.activate>) => {
        activateCount++;
        return rssReaderFeature.activate(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(activateCount).toBe(2);
  });

  test("rss:new-entry event is logged to event_log", async () => {
    await registry.startup([rssReaderFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const eventBus = new EventBus(coreDb);
    eventBus.emit("rss:new-entry", "rss-reader", {
      entryId: "e1",
      feedId: "f1",
      title: "Test Entry",
      link: "https://example.com/1",
    });
    const row = coreDb
      .query<{ event_name: string; feature_id: string }, []>("SELECT event_name, feature_id FROM event_log")
      .get();
    expect(row?.event_name).toBe("rss:new-entry");
    expect(row?.feature_id).toBe("rss-reader");
  });
});

describe("cross-feature: rss:new-entry → todo:create", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-cross-"));
    dbManager = new DatabaseManager(tmpDir);
  });

  afterEach(async () => {
    dbManager.closeAll();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("script creates a todo when a new RSS entry arrives", async () => {
    const coreDb = dbManager.getCoreDatabase();
    const eventBus = new EventBus(coreDb);
    const actionQueue = new ActionQueue(coreDb, 0);

    const created: unknown[] = [];
    actionQueue.registerHandler("todo", "create", async (params) => {
      created.push(params);
      return { id: "new-todo" };
    });

    const now = new Date().toISOString();
    coreDb
      .query(`
				CREATE TABLE IF NOT EXISTS scripts (
					id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL,
					enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
				)
			`)
      .run();
    coreDb
      .query(`
				CREATE TABLE IF NOT EXISTS script_executions (
					id TEXT PRIMARY KEY, script_id TEXT NOT NULL, triggered_by TEXT NOT NULL,
					trigger_payload TEXT, status TEXT NOT NULL DEFAULT 'pending',
					created_at TEXT NOT NULL, completed_at TEXT
				)
			`)
      .run();
    coreDb
      .query(`
				CREATE TABLE IF NOT EXISTS script_store (
					script_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT,
					updated_at TEXT NOT NULL, PRIMARY KEY (script_id, key)
				)
			`)
      .run();

    coreDb.query("INSERT INTO scripts (id, name, code, enabled, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run(
      "rss-to-todo",
      "RSS to Todo",
      `ctx.on("rss:new-entry", async function(entry) {
					await ctx.actions.todo.create({ title: "Read: " + entry.title });
				});`,
      now,
      now,
    );

    const engine = new ScriptEngine(coreDb, eventBus, actionQueue);
    engine.start();

    eventBus.emit("rss:new-entry", "rss-reader", {
      entryId: "e1",
      feedId: "f1",
      title: "Interesting Article",
      link: "https://example.com/article",
    });

    await Bun.sleep(20);

    expect(created).toHaveLength(1);
    expect((created[0] as { title: string }).title).toBe("Read: Interesting Article");
  });
});
