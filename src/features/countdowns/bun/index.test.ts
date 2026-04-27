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
import { countdownsFeature } from "./index";

describe("countdownsFeature definition", () => {
  test("has id 'countdowns'", () => {
    expect(countdownsFeature.id).toBe("countdowns");
  });

  test("has a non-empty name", () => {
    expect(countdownsFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(countdownsFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has migration at version 001", () => {
    expect(countdownsFeature.migrations).toHaveLength(1);
    expect(countdownsFeature.migrations[0]?.version).toBe("001");
    expect(countdownsFeature.migrations[0]?.up).toContain("CREATE TABLE countdowns");
  });

  test("manifest declares all actions", () => {
    const keys = Object.keys(countdownsFeature.manifest.actions);
    expect(keys).toContain("create");
    expect(keys).toContain("delete");
    expect(keys).toContain("archive");
  });

  test("manifest declares all queries", () => {
    const keys = Object.keys(countdownsFeature.manifest.queries);
    expect(keys).toContain("get-all");
    expect(keys).toContain("get-by-id");
    expect(keys).toContain("search");
  });

  test("manifest declares countdown:reached event", () => {
    const keys = Object.keys(countdownsFeature.manifest.events);
    expect(keys).toContain("countdown:reached");
  });

  test("manifest declares countdowns widget", () => {
    const widget = countdownsFeature.manifest.widgets.find((w) => w.id === "upcoming");
    expect(widget).toBeDefined();
    expect(widget?.sizes).toContain("medium");
  });
});

describe("countdownsFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-countdowns-feature-"));
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

  test("creates countdowns table on first startup", async () => {
    await registry.startup([countdownsFeature]);
    const featureDb = dbManager.getFeatureDatabase("countdowns");
    const table = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='countdowns'")
      .get();
    expect(table?.name).toBe("countdowns");
  });

  test("registers as enabled in the features table", async () => {
    await registry.startup([countdownsFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb
      .query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
      .get("countdowns");
    expect(row?.enabled).toBe(1);
  });

  test("install runs only once across two startups", async () => {
    let installCount = 0;
    const tracked = {
      ...countdownsFeature,
      install: async (...args: Parameters<typeof countdownsFeature.install>) => {
        installCount++;
        return countdownsFeature.install(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(installCount).toBe(1);
  });

  test("create action persists a countdown", async () => {
    await registry.startup([countdownsFeature]);
    const featureDb = dbManager.getFeatureDatabase("countdowns");
    const { createCountdown } = await import("./actions");
    const result = await createCountdown(featureDb, { name: "New Year", targetDate: "2027-01-01" });
    expect(result.id).toBeDefined();
  });
});
