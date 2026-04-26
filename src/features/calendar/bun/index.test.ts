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
import { calendarFeature } from "./index";

describe("calendarFeature definition", () => {
  test("has id 'calendar'", () => {
    expect(calendarFeature.id).toBe("calendar");
  });

  test("has a non-empty name", () => {
    expect(calendarFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(calendarFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has migrations for sources and events tables", () => {
    expect(calendarFeature.migrations).toHaveLength(2);
    expect(calendarFeature.migrations[0]?.up).toContain("CREATE TABLE calendar_sources");
    expect(calendarFeature.migrations[1]?.up).toContain("CREATE TABLE calendar_events");
  });

  test("manifest declares all actions", () => {
    const keys = Object.keys(calendarFeature.manifest.actions);
    expect(keys).toContain("add-source");
    expect(keys).toContain("delete-source");
    expect(keys).toContain("sync-all");
  });

  test("manifest declares all queries", () => {
    const keys = Object.keys(calendarFeature.manifest.queries);
    expect(keys).toContain("get-sources");
    expect(keys).toContain("get-events");
    expect(keys).toContain("get-upcoming");
    expect(keys).toContain("search");
  });

  test("manifest declares all events", () => {
    const keys = Object.keys(calendarFeature.manifest.events);
    expect(keys).toContain("calendar:source-added");
    expect(keys).toContain("calendar:source-deleted");
    expect(keys).toContain("calendar:synced");
    expect(keys).toContain("calendar:event-starting");
  });

  test("manifest declares upcoming-events widget", () => {
    const widget = calendarFeature.manifest.widgets.find((w) => w.id === "upcoming-events");
    expect(widget).toBeDefined();
    expect(widget?.sizes).toContain("medium");
    expect(widget?.sizes).toContain("wide");
  });

  test("manifest declares network permission", () => {
    const perm = calendarFeature.manifest.permissions.find((p) => p.type === "network");
    expect(perm).toBeDefined();
  });

  test("manifest declares scheduled sync task", () => {
    const task = calendarFeature.manifest.scheduledTasks.find((t) => t.id === "calendar:sync-all");
    expect(task).toBeDefined();
    expect(task?.defaultSchedule.type).toBe("interval");
  });
});

describe("calendarFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-calendar-feature-"));
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

  test("creates calendar_sources and calendar_events tables on first startup", async () => {
    await registry.startup([calendarFeature]);
    const featureDb = dbManager.getFeatureDatabase("calendar");
    const sources = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_sources'")
      .get();
    const events = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_events'")
      .get();
    expect(sources?.name).toBe("calendar_sources");
    expect(events?.name).toBe("calendar_events");
  });

  test("registers as enabled in the features table", async () => {
    await registry.startup([calendarFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb
      .query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
      .get("calendar");
    expect(row?.enabled).toBe(1);
  });

  test("install runs only once across two startups", async () => {
    let installCount = 0;
    const tracked = {
      ...calendarFeature,
      install: async (...args: Parameters<typeof calendarFeature.install>) => {
        installCount++;
        return calendarFeature.install(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(installCount).toBe(1);
  });

  test("activate runs on every startup", async () => {
    let activateCount = 0;
    const tracked = {
      ...calendarFeature,
      activate: async (...args: Parameters<typeof calendarFeature.activate>) => {
        activateCount++;
        return calendarFeature.activate(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(activateCount).toBe(2);
  });

  test("calendar:source-added event is logged to event_log", async () => {
    await registry.startup([calendarFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const eventBus = new EventBus(coreDb);
    eventBus.emit("calendar:source-added", "calendar", { sourceId: "s1", url: "https://example.com/cal.ics" });
    const row = coreDb
      .query<{ event_name: string; feature_id: string }, []>("SELECT event_name, feature_id FROM event_log")
      .get();
    expect(row?.event_name).toBe("calendar:source-added");
    expect(row?.feature_id).toBe("calendar");
  });
});
