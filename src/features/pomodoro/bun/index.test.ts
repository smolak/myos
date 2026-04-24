import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseManager } from "@core/bun/database-manager";
import { SettingsManager } from "@core/bun/settings-manager";
import { CredentialStore } from "@core/bun/credential-store";
import { FeatureRegistry } from "@core/bun/feature-registry";
import { EventBus } from "@core/bun/event-bus";
import { ActionQueue } from "@core/bun/action-queue";
import { Scheduler } from "@core/bun/scheduler";
import { ScriptEngine } from "@core/bun/script-engine";
import { pomodoroFeature } from "./index";

describe("pomodoroFeature definition", () => {
  test("has id 'pomodoro'", () => {
    expect(pomodoroFeature.id).toBe("pomodoro");
  });

  test("has a non-empty name", () => {
    expect(pomodoroFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(pomodoroFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has the sessions migration at version 001", () => {
    expect(pomodoroFeature.migrations).toHaveLength(1);
    expect(pomodoroFeature.migrations[0]!.version).toBe("001");
    expect(pomodoroFeature.migrations[0]!.up).toContain("CREATE TABLE pomodoro_sessions");
  });

  test("manifest declares all actions", () => {
    const keys = Object.keys(pomodoroFeature.manifest.actions);
    expect(keys).toContain("start");
    expect(keys).toContain("pause");
    expect(keys).toContain("resume");
    expect(keys).toContain("complete");
    expect(keys).toContain("cancel");
  });

  test("manifest declares all queries", () => {
    const keys = Object.keys(pomodoroFeature.manifest.queries);
    expect(keys).toContain("get-current");
    expect(keys).toContain("get-history");
  });

  test("manifest declares all events", () => {
    const keys = Object.keys(pomodoroFeature.manifest.events);
    expect(keys).toContain("pomodoro:session-started");
    expect(keys).toContain("pomodoro:session-paused");
    expect(keys).toContain("pomodoro:session-resumed");
    expect(keys).toContain("pomodoro:session-ended");
    expect(keys).toContain("pomodoro:session-cancelled");
  });

  test("manifest declares timer widget with small and medium sizes", () => {
    const widget = pomodoroFeature.manifest.widgets.find((w) => w.id === "timer");
    expect(widget).toBeDefined();
    expect(widget!.sizes).toContain("small");
    expect(widget!.sizes).toContain("medium");
  });
});

describe("pomodoroFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let registry: FeatureRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-pomodoro-feature-"));
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

  test("creates pomodoro_sessions table on first startup", async () => {
    await registry.startup([pomodoroFeature]);
    const featureDb = dbManager.getFeatureDatabase("pomodoro");
    const row = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='pomodoro_sessions'")
      .get();
    expect(row?.name).toBe("pomodoro_sessions");
  });

  test("registers as enabled in the features table", async () => {
    await registry.startup([pomodoroFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb
      .query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
      .get("pomodoro");
    expect(row?.enabled).toBe(1);
  });

  test("install runs only once across two startups", async () => {
    let installCount = 0;
    const tracked = {
      ...pomodoroFeature,
      install: async (...args: Parameters<typeof pomodoroFeature.install>) => {
        installCount++;
        return pomodoroFeature.install(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(installCount).toBe(1);
  });

  test("activate runs on every startup", async () => {
    let activateCount = 0;
    const tracked = {
      ...pomodoroFeature,
      activate: async (...args: Parameters<typeof pomodoroFeature.activate>) => {
        activateCount++;
        return pomodoroFeature.activate(...args);
      },
    };
    await registry.startup([tracked]);
    await registry.startup([tracked]);
    expect(activateCount).toBe(2);
  });

  test("pomodoro:session-ended event logged to event_log", async () => {
    await registry.startup([pomodoroFeature]);

    const coreDb = dbManager.getCoreDatabase();
    const eventBus = new EventBus(coreDb);
    eventBus.emit("pomodoro:session-ended", "pomodoro", {
      id: "s1",
      type: "work",
      durationSeconds: 1500,
    });

    const row = coreDb
      .query<{ event_name: string; feature_id: string }, []>("SELECT event_name, feature_id FROM event_log")
      .get();
    expect(row?.event_name).toBe("pomodoro:session-ended");
    expect(row?.feature_id).toBe("pomodoro");
  });
});

describe("cross-feature: pomodoro:session-ended → todo:create", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-pomodoro-cross-"));
    dbManager = new DatabaseManager(tmpDir);
  });

  afterEach(async () => {
    dbManager.closeAll();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("script creates a todo when pomodoro session ends", async () => {
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
      "pomodoro-to-todo",
      "Pomodoro to Todo",
      `ctx.on("pomodoro:session-ended", async function(session) {
					await ctx.actions.todo.create({ title: "Review session" });
				});`,
      now,
      now,
    );

    const engine = new ScriptEngine(coreDb, eventBus, actionQueue);
    engine.start();

    eventBus.emit("pomodoro:session-ended", "pomodoro", {
      id: "session-1",
      type: "work",
      durationSeconds: 1500,
    });

    await Bun.sleep(20);

    expect(created).toHaveLength(1);
    expect((created[0] as { title: string }).title).toBe("Review session");
  });
});
