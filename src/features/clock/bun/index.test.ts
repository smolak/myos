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
import { clockFeature } from "./index";

describe("clockFeature definition", () => {
  test("has id 'clock'", () => {
    expect(clockFeature.id).toBe("clock");
  });

  test("has a non-empty name", () => {
    expect(clockFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(clockFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has no migrations", () => {
    expect(clockFeature.migrations).toHaveLength(0);
  });

  test("manifest declares display widget with small size", () => {
    const widget = clockFeature.manifest.widgets.find((w) => w.id === "display");
    expect(widget).toBeDefined();
    expect(widget?.sizes).toContain("small");
  });

  test("manifest declares no actions", () => {
    expect(Object.keys(clockFeature.manifest.actions)).toHaveLength(0);
  });

  test("manifest declares no queries", () => {
    expect(Object.keys(clockFeature.manifest.queries)).toHaveLength(0);
  });
});

describe("clockFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-clock-"));
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

  test("registers as enabled in the features table", async () => {
    await registry.startup([clockFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb.query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?").get("clock");
    expect(row?.enabled).toBe(1);
  });

  test("install runs only once across two startups", async () => {
    let installCount = 0;
    const tracked = {
      ...clockFeature,
      install: async (...args: Parameters<typeof clockFeature.install>) => {
        installCount++;
        return clockFeature.install(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(installCount).toBe(1);
  });

  test("activate runs on every startup", async () => {
    let activateCount = 0;
    const tracked = {
      ...clockFeature,
      activate: async (...args: Parameters<typeof clockFeature.activate>) => {
        activateCount++;
        return clockFeature.activate(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(activateCount).toBe(2);
  });
});
