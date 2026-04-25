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
import { dailyJournalFeature } from "./index";

describe("dailyJournalFeature definition", () => {
  test("has id 'daily-journal'", () => {
    expect(dailyJournalFeature.id).toBe("daily-journal");
  });

  test("has a non-empty name", () => {
    expect(dailyJournalFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(dailyJournalFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has the journal_notes migration at version 001", () => {
    expect(dailyJournalFeature.migrations).toHaveLength(1);
    expect(dailyJournalFeature.migrations[0]?.version).toBe("001");
    expect(dailyJournalFeature.migrations[0]?.up).toContain("CREATE TABLE journal_notes");
  });

  test("manifest declares all actions", () => {
    const keys = Object.keys(dailyJournalFeature.manifest.actions);
    expect(keys).toContain("add-note");
    expect(keys).toContain("update-note");
    expect(keys).toContain("delete-note");
  });

  test("manifest declares all queries", () => {
    const keys = Object.keys(dailyJournalFeature.manifest.queries);
    expect(keys).toContain("get-notes");
    expect(keys).toContain("get-note-by-date");
  });

  test("manifest declares all events", () => {
    const keys = Object.keys(dailyJournalFeature.manifest.events);
    expect(keys).toContain("journal:note-created");
    expect(keys).toContain("journal:note-updated");
    expect(keys).toContain("journal:note-deleted");
  });

  test("manifest declares summary widget in wide size", () => {
    const widget = dailyJournalFeature.manifest.widgets.find((w) => w.id === "summary");
    expect(widget).toBeDefined();
    expect(widget?.sizes).toContain("wide");
  });
});

describe("dailyJournalFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;
  let sharedActionQueue: ActionQueue;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-journal-feature-"));
    dbManager = new DatabaseManager(tmpDir);
    const coreDb = dbManager.getCoreDatabase();
    const settingsManager = new SettingsManager(coreDb);
    const credentialStore = new CredentialStore(coreDb);
    const eventBus = new EventBus(coreDb);
    sharedActionQueue = new ActionQueue(coreDb, 0);
    const scheduler = new Scheduler(coreDb, 60_000, 0);
    registry = new FeatureRegistry(dbManager, settingsManager, credentialStore, eventBus, sharedActionQueue, scheduler);
  });

  afterEach(async () => {
    dbManager.closeAll();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("creates journal_notes table on first startup", async () => {
    await registry.startup([dailyJournalFeature]);
    const featureDb = dbManager.getFeatureDatabase("daily-journal");
    const row = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='journal_notes'")
      .get();
    expect(row?.name).toBe("journal_notes");
  });

  test("registers as enabled in the features table", async () => {
    await registry.startup([dailyJournalFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb
      .query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
      .get("daily-journal");
    expect(row?.enabled).toBe(1);
  });

  test("install runs only once across two startups", async () => {
    let installCount = 0;
    const tracked = {
      ...dailyJournalFeature,
      install: async (...args: Parameters<typeof dailyJournalFeature.install>) => {
        installCount++;
        return dailyJournalFeature.install(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(installCount).toBe(1);
  });

  test("activate runs on every startup", async () => {
    let activateCount = 0;
    const tracked = {
      ...dailyJournalFeature,
      activate: async (...args: Parameters<typeof dailyJournalFeature.activate>) => {
        activateCount++;
        return dailyJournalFeature.activate(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(activateCount).toBe(2);
  });

  test("emits journal:note-created when add-note action completes", async () => {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const spy = {
      ...dailyJournalFeature,
      activate: async (ctx: Parameters<typeof dailyJournalFeature.activate>[0]) => {
        const patchedCtx = {
          ...ctx,
          events: {
            emit(event: string, payload: unknown) {
              emitted.push({ event, payload });
            },
          },
        };
        return dailyJournalFeature.activate(patchedCtx as typeof ctx);
      },
    };

    await registry.startup([spy]);

    await sharedActionQueue.dispatchAction("daily-journal", "add-note", {
      date: "2026-04-25",
      content: "Test note",
    });

    await Bun.sleep(10);
    const created = emitted.find((e) => e.event === "journal:note-created");
    expect(created).toBeDefined();
    expect((created?.payload as { date: string }).date).toBe("2026-04-25");
  });
});
