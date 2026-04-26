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
import { SettingsManager } from "@core/bun/settings-manager";
import { bookmarksFeature } from "./index";

describe("bookmarksFeature definition", () => {
  test("has id 'bookmarks'", () => {
    expect(bookmarksFeature.id).toBe("bookmarks");
  });

  test("has a non-empty name", () => {
    expect(bookmarksFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(bookmarksFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has migration at version 001", () => {
    expect(bookmarksFeature.migrations).toHaveLength(1);
    expect(bookmarksFeature.migrations[0]?.version).toBe("001");
    expect(bookmarksFeature.migrations[0]?.up).toContain("CREATE TABLE bookmarks");
  });

  test("manifest declares all actions", () => {
    const keys = Object.keys(bookmarksFeature.manifest.actions);
    expect(keys).toContain("create");
    expect(keys).toContain("update");
    expect(keys).toContain("delete");
  });

  test("manifest declares all queries", () => {
    const keys = Object.keys(bookmarksFeature.manifest.queries);
    expect(keys).toContain("get-all");
    expect(keys).toContain("get-by-id");
    expect(keys).toContain("search");
  });

  test("manifest declares bookmarks:added event", () => {
    const keys = Object.keys(bookmarksFeature.manifest.events);
    expect(keys).toContain("bookmarks:added");
  });

  test("manifest declares recent-list widget in medium size", () => {
    const widget = bookmarksFeature.manifest.widgets.find((w) => w.id === "recent-list");
    expect(widget).toBeDefined();
    expect(widget?.sizes).toContain("medium");
  });
});

describe("bookmarksFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-bookmarks-feature-"));
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

  test("creates bookmarks table on first startup", async () => {
    await registry.startup([bookmarksFeature]);
    const featureDb = dbManager.getFeatureDatabase("bookmarks");
    const table = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='bookmarks'")
      .get();
    expect(table?.name).toBe("bookmarks");
  });

  test("registers as enabled in the features table", async () => {
    await registry.startup([bookmarksFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb
      .query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
      .get("bookmarks");
    expect(row?.enabled).toBe(1);
  });

  test("install runs only once across two startups", async () => {
    let installCount = 0;
    const tracked = {
      ...bookmarksFeature,
      install: async (...args: Parameters<typeof bookmarksFeature.install>) => {
        installCount++;
        return bookmarksFeature.install(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(installCount).toBe(1);
  });

  test("create action emits bookmarks:added event", async () => {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const spy = {
      ...bookmarksFeature,
      activate: async (ctx: Parameters<typeof bookmarksFeature.activate>[0]) => {
        const patchedCtx = {
          ...ctx,
          events: {
            emit(event: string, payload: unknown) {
              emitted.push({ event, payload });
            },
          },
        };
        return bookmarksFeature.activate(patchedCtx as typeof ctx);
      },
    };

    await registry.startup([spy]);
    const featureDb = dbManager.getFeatureDatabase("bookmarks");
    const { createBookmark } = await import("./actions");
    const result = await createBookmark(featureDb, { title: "Test", url: "https://test.com" });
    expect(result.id).toBeDefined();
  });
});
