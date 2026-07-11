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
import { createRssReaderFeature, rssReaderFeature } from "./index";

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

  test("has migrations for feeds, entries, and favicons tables", () => {
    expect(rssReaderFeature.migrations).toHaveLength(3);
    expect(rssReaderFeature.migrations[0]?.up).toContain("CREATE TABLE rss_feeds");
    expect(rssReaderFeature.migrations[1]?.up).toContain("CREATE TABLE rss_entries");
    expect(rssReaderFeature.migrations[2]?.up).toContain("CREATE TABLE rss_favicons");
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
    expect(keys).toContain("get-favicons");
  });

  test("manifest declares all events", () => {
    const keys = Object.keys(rssReaderFeature.manifest.events);
    expect(keys).toContain("rss:feed-added");
    expect(keys).toContain("rss:feed-deleted");
    expect(keys).toContain("rss:new-entry");
    expect(keys).toContain("rss:entry-read");
    expect(keys).toContain("rss:ingest-completed");
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

  test("creates rss_feeds, rss_entries, and rss_favicons tables on first startup", async () => {
    await registry.startup([rssReaderFeature]);
    const featureDb = dbManager.getFeatureDatabase("rss-reader");
    const feeds = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='rss_feeds'")
      .get();
    const entries = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='rss_entries'")
      .get();
    const favicons = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='rss_favicons'")
      .get();
    expect(feeds?.name).toBe("rss_feeds");
    expect(entries?.name).toBe("rss_entries");
    expect(favicons?.name).toBe("rss_favicons");
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

const FEED_XML = `<rss version="2.0"><channel>
  <title>Test Feed</title>
  <item>
    <title>Post One</title>
    <link>https://site-a.com/articles/1</link>
    <guid>guid-1</guid>
  </item>
  <item>
    <title>Post Two</title>
    <link>https://site-b.com/posts/2</link>
    <guid>guid-2</guid>
  </item>
</channel></rss>`;

describe("fetch-feeds through the public action surface", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;
  let actionQueue: ActionQueue;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-ingest-"));
    dbManager = new DatabaseManager(tmpDir);
    const coreDb = dbManager.getCoreDatabase();
    const settingsManager = new SettingsManager(coreDb);
    const credentialStore = new CredentialStore(coreDb);
    const eventBus = new EventBus(coreDb);
    actionQueue = new ActionQueue(coreDb, 0);
    const scheduler = new Scheduler(coreDb, 60_000, 0);
    registry = new FeatureRegistry(dbManager, settingsManager, credentialStore, eventBus, actionQueue, scheduler);
  });

  afterEach(async () => {
    dbManager.closeAll();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns fetched and newEntries counts", async () => {
    const feature = createRssReaderFeature(async () => new Response(FEED_XML));
    await registry.startup([feature]);
    await actionQueue.dispatchAction("rss-reader", "add-feed", { url: "https://example.com/feed" });

    const result = await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});

    expect(result).toEqual({ fetched: 1, newEntries: 2 });
  });

  test("emits rss:new-entry for each inserted entry", async () => {
    const feature = createRssReaderFeature(async () => new Response(FEED_XML));
    await registry.startup([feature]);
    await actionQueue.dispatchAction("rss-reader", "add-feed", { url: "https://example.com/feed" });

    await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});

    const coreDb = dbManager.getCoreDatabase();
    const rows = coreDb
      .query<{ payload: string }, [string]>("SELECT payload FROM event_log WHERE event_name = ?")
      .all("rss:new-entry");
    expect(rows).toHaveLength(2);
    const payloads = rows.map((r) => JSON.parse(r.payload) as { title: string; link: string });
    expect(payloads[0]).toMatchObject({ title: "Post One", link: "https://site-a.com/articles/1" });
    expect(payloads[1]).toMatchObject({ title: "Post Two", link: "https://site-b.com/posts/2" });
  });

  test("emits rss:ingest-completed exactly once with fetched and new-entry counts", async () => {
    const feature = createRssReaderFeature(async () => new Response(FEED_XML));
    await registry.startup([feature]);
    await actionQueue.dispatchAction("rss-reader", "add-feed", { url: "https://example.com/feed" });

    await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});

    const coreDb = dbManager.getCoreDatabase();
    const rows = coreDb
      .query<{ payload: string }, [string]>("SELECT payload FROM event_log WHERE event_name = ?")
      .all("rss:ingest-completed");
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]?.payload ?? "{}")).toEqual({ fetched: 1, newEntries: 2 });
  });

  test("emits rss:ingest-completed on every ingest, with a zero count when nothing new is stored", async () => {
    const feature = createRssReaderFeature(async () => new Response(FEED_XML));
    await registry.startup([feature]);
    await actionQueue.dispatchAction("rss-reader", "add-feed", { url: "https://example.com/feed" });

    await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});
    await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});

    const coreDb = dbManager.getCoreDatabase();
    const rows = coreDb
      .query<{ payload: string }, [string]>("SELECT payload FROM event_log WHERE event_name = ? ORDER BY id")
      .all("rss:ingest-completed");
    expect(rows).toHaveLength(2);
    expect(JSON.parse(rows[1]?.payload ?? "{}")).toEqual({ fetched: 1, newEntries: 0 });
  });

  test("emits rss:ingest-completed even while favicon acquisition never settles", async () => {
    const feature = createRssReaderFeature((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "https://example.com/feed") return Promise.resolve(new Response(FEED_XML));
      return new Promise<Response>(() => {}); // favicon requests hang forever
    });
    await registry.startup([feature]);
    await actionQueue.dispatchAction("rss-reader", "add-feed", { url: "https://example.com/feed" });

    await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});

    const coreDb = dbManager.getCoreDatabase();
    const rows = coreDb
      .query<{ id: number }, [string]>("SELECT id FROM event_log WHERE event_name = ?")
      .all("rss:ingest-completed");
    expect(rows).toHaveLength(1);
  });

  async function getFaviconsWhenReady(expectedCount: number): Promise<Record<string, string>> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const favicons = (await actionQueue.executeQuery("rss-reader", "get-favicons", {})) as Record<string, string>;
      if (Object.keys(favicons).length >= expectedCount) return favicons;
      await Bun.sleep(5);
    }
    return (await actionQueue.executeQuery("rss-reader", "get-favicons", {})) as Record<string, string>;
  }

  function makeSiteFetch(feedXml: string, calls: string[] = []): (url: URL | RequestInfo) => Promise<Response> {
    return async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calls.push(url);
      if (url === "https://example.com/feed") {
        return new Response(feedXml, { headers: { "content-type": "application/rss+xml" } });
      }
      if (url === "https://site-a.com/") {
        return new Response(`<link rel="icon" href="/icon.png">`, { headers: { "content-type": "text/html" } });
      }
      if (url === "https://site-a.com/icon.png") {
        return new Response(new Uint8Array([1, 1, 1]), { headers: { "content-type": "image/png" } });
      }
      if (url === "https://site-b.com/") {
        return new Response("<html></html>", { headers: { "content-type": "text/html" } });
      }
      if (url === "https://site-b.com/favicon.ico") {
        return new Response(new Uint8Array([2, 2, 2]), { headers: { "content-type": "image/x-icon" } });
      }
      throw new Error(`Host is down: ${url}`);
    };
  }

  test("caches a favicon for each distinct hostname of new entries", async () => {
    const feature = createRssReaderFeature(makeSiteFetch(FEED_XML));
    await registry.startup([feature]);
    await actionQueue.dispatchAction("rss-reader", "add-feed", { url: "https://example.com/feed" });

    await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});

    const favicons = await getFaviconsWhenReady(2);
    expect(Object.keys(favicons).sort()).toEqual(["site-a.com", "site-b.com"]);
    expect(favicons["site-a.com"]).toStartWith("data:image/png;base64,");
    expect(favicons["site-b.com"]).toStartWith("data:image/x-icon;base64,");
  });

  test("feed results are identical when an icon host is dead", async () => {
    const deadIconXml = `<rss version="2.0"><channel>
      <title>Test Feed</title>
      <item><title>Post</title><link>https://dead-site.com/post</link><guid>g1</guid></item>
    </channel></rss>`;
    const feature = createRssReaderFeature(makeSiteFetch(deadIconXml));
    await registry.startup([feature]);
    await actionQueue.dispatchAction("rss-reader", "add-feed", { url: "https://example.com/feed" });

    const result = await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});

    expect(result).toEqual({ fetched: 1, newEntries: 1 });
    // The failed lookup lands as a negative row, invisible to get-favicons
    let row: { icon_data: Uint8Array | null } | null = null;
    for (let attempt = 0; attempt < 100 && row === null; attempt++) {
      row = dbManager
        .getFeatureDatabase("rss-reader")
        .query<{ icon_data: Uint8Array | null }, [string]>("SELECT icon_data FROM rss_favicons WHERE hostname = ?")
        .get("dead-site.com");
      if (row === null) await Bun.sleep(5);
    }
    expect(row).not.toBeNull();
    expect(row?.icon_data).toBeNull();
    const favicons = (await actionQueue.executeQuery("rss-reader", "get-favicons", {})) as Record<string, string>;
    expect(favicons).toEqual({});
  });

  test("repeated fetch-feeds does not re-fetch cached favicons", async () => {
    const calls: string[] = [];
    const feature = createRssReaderFeature(makeSiteFetch(FEED_XML, calls));
    await registry.startup([feature]);
    await actionQueue.dispatchAction("rss-reader", "add-feed", { url: "https://example.com/feed" });

    await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});
    await getFaviconsWhenReady(2);
    const siteCallsAfterFirst = calls.filter((url) => url.startsWith("https://site-")).length;

    await actionQueue.dispatchAction("rss-reader", "fetch-feeds", {});
    await Bun.sleep(25);

    const siteCallsAfterSecond = calls.filter((url) => url.startsWith("https://site-")).length;
    expect(siteCallsAfterSecond).toBe(siteCallsAfterFirst);
    const count = dbManager
      .getFeatureDatabase("rss-reader")
      .query<{ n: number }, []>("SELECT COUNT(*) AS n FROM rss_favicons")
      .get();
    expect(count?.n).toBe(2);
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
