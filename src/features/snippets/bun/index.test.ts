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
import { snippetsFeature } from "./index";

describe("snippetsFeature definition", () => {
  test("has id 'snippets'", () => {
    expect(snippetsFeature.id).toBe("snippets");
  });

  test("has a non-empty name", () => {
    expect(snippetsFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(snippetsFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has migration at version 001", () => {
    expect(snippetsFeature.migrations).toHaveLength(1);
    expect(snippetsFeature.migrations[0]?.version).toBe("001");
    expect(snippetsFeature.migrations[0]?.up).toContain("CREATE TABLE snippets");
  });

  test("manifest declares all actions", () => {
    const keys = Object.keys(snippetsFeature.manifest.actions);
    expect(keys).toContain("create");
    expect(keys).toContain("update");
    expect(keys).toContain("delete");
  });

  test("manifest declares all queries", () => {
    const keys = Object.keys(snippetsFeature.manifest.queries);
    expect(keys).toContain("get-all");
    expect(keys).toContain("get-by-id");
    expect(keys).toContain("expand");
    expect(keys).toContain("search");
  });

  test("manifest declares snippets widget", () => {
    const widget = snippetsFeature.manifest.widgets.find((w) => w.id === "favorites");
    expect(widget).toBeDefined();
    expect(widget?.sizes).toContain("medium");
  });
});

describe("snippetsFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-snippets-feature-"));
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

  test("creates snippets table on first startup", async () => {
    await registry.startup([snippetsFeature]);
    const featureDb = dbManager.getFeatureDatabase("snippets");
    const table = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='snippets'")
      .get();
    expect(table?.name).toBe("snippets");
  });

  test("registers as enabled in the features table", async () => {
    await registry.startup([snippetsFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb
      .query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
      .get("snippets");
    expect(row?.enabled).toBe(1);
  });

  test("install runs only once across two startups", async () => {
    let installCount = 0;
    const tracked = {
      ...snippetsFeature,
      install: async (...args: Parameters<typeof snippetsFeature.install>) => {
        installCount++;
        return snippetsFeature.install(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(installCount).toBe(1);
  });

  test("create action persists a snippet", async () => {
    await registry.startup([snippetsFeature]);
    const featureDb = dbManager.getFeatureDatabase("snippets");
    const { createSnippet } = await import("./actions");
    const result = await createSnippet(featureDb, { name: "Hello", template: "Hello, {{clipboard}}!" });
    expect(result.id).toBeDefined();
  });
});
