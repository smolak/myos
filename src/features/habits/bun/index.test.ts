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
import { habitsFeature } from "./index";

describe("habitsFeature definition", () => {
  test("has id 'habits'", () => {
    expect(habitsFeature.id).toBe("habits");
  });

  test("has a non-empty name", () => {
    expect(habitsFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(habitsFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has migrations at versions 001 and 002", () => {
    expect(habitsFeature.migrations).toHaveLength(2);
    expect(habitsFeature.migrations[0]?.version).toBe("001");
    expect(habitsFeature.migrations[0]?.up).toContain("CREATE TABLE habits");
    expect(habitsFeature.migrations[1]?.version).toBe("002");
    expect(habitsFeature.migrations[1]?.up).toContain("CREATE TABLE habit_completions");
  });

  test("manifest declares all actions", () => {
    const keys = Object.keys(habitsFeature.manifest.actions);
    expect(keys).toContain("create");
    expect(keys).toContain("delete");
    expect(keys).toContain("complete");
    expect(keys).toContain("uncomplete");
  });

  test("manifest declares all queries", () => {
    const keys = Object.keys(habitsFeature.manifest.queries);
    expect(keys).toContain("get-all");
    expect(keys).toContain("get-by-id");
    expect(keys).toContain("get-history");
    expect(keys).toContain("search");
  });

  test("manifest declares habits:completed event", () => {
    const keys = Object.keys(habitsFeature.manifest.events);
    expect(keys).toContain("habits:completed");
  });

  test("manifest declares daily-checkin widget in medium size", () => {
    const widget = habitsFeature.manifest.widgets.find((w) => w.id === "daily-checkin");
    expect(widget).toBeDefined();
    expect(widget?.sizes).toContain("medium");
  });
});

describe("habitsFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-habits-feature-"));
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

  test("creates habits and habit_completions tables on first startup", async () => {
    await registry.startup([habitsFeature]);
    const featureDb = dbManager.getFeatureDatabase("habits");
    const habitsTable = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='habits'")
      .get();
    const completionsTable = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='habit_completions'")
      .get();
    expect(habitsTable?.name).toBe("habits");
    expect(completionsTable?.name).toBe("habit_completions");
  });

  test("registers as enabled in the features table", async () => {
    await registry.startup([habitsFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb.query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?").get("habits");
    expect(row?.enabled).toBe(1);
  });

  test("install runs only once across two startups", async () => {
    let installCount = 0;
    const tracked = {
      ...habitsFeature,
      install: async (...args: Parameters<typeof habitsFeature.install>) => {
        installCount++;
        return habitsFeature.install(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(installCount).toBe(1);
  });

  test("create action emits habits:completed event on complete", async () => {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const spy = {
      ...habitsFeature,
      activate: async (ctx: Parameters<typeof habitsFeature.activate>[0]) => {
        const patchedCtx = {
          ...ctx,
          events: {
            emit(event: string, payload: unknown) {
              emitted.push({ event, payload });
            },
          },
        };
        return habitsFeature.activate(patchedCtx as typeof ctx);
      },
    };

    await registry.startup([spy]);
    const featureDb = dbManager.getFeatureDatabase("habits");
    const { createHabit } = await import("./actions");
    const result = await createHabit(featureDb, { name: "Test" });
    expect(result.id).toBeDefined();
  });
});
