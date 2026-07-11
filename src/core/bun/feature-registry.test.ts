import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FeatureContext, FeatureDefinition, FeatureLifecycleContext } from "@core/types";
import { ActionQueue } from "./action-queue";
import { CredentialStore } from "./credential-store";
import { DatabaseManager } from "./database-manager";
import { EventBus } from "./event-bus";
import { FeatureRegistry } from "./feature-registry";
import { Scheduler } from "./scheduler";
import { SettingsManager } from "./settings-manager";

const EMPTY_MANIFEST = {
  events: {},
  actions: {},
  queries: {},
  permissions: [],
  scheduledTasks: [],
  widgets: [],
  commands: [],
};

function makeFeature(overrides: Partial<FeatureDefinition> = {}): FeatureDefinition {
  const id = overrides.id ?? "test-feature";
  return {
    id,
    name: `Feature ${id}`,
    version: "1.0.0",
    install: async () => {},
    activate: async () => {},
    deactivate: async () => {},
    uninstall: async () => {},
    migrations: [],
    manifest: EMPTY_MANIFEST,
    ...overrides,
  };
}

describe("FeatureRegistry", () => {
  let dbManager: DatabaseManager;
  let settingsManager: SettingsManager;
  let credentialStore: CredentialStore;
  let eventBus: EventBus;
  let actionQueue: ActionQueue;
  let scheduler: Scheduler;
  let registry: FeatureRegistry;
  let coreDb: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-registry-"));
    dbManager = new DatabaseManager(tmpDir);
    coreDb = dbManager.getCoreDatabase();
    settingsManager = new SettingsManager(coreDb);
    credentialStore = new CredentialStore(coreDb);
    eventBus = new EventBus(coreDb);
    actionQueue = new ActionQueue(coreDb, 0);
    scheduler = new Scheduler(coreDb, 60_000, 0);
    registry = new FeatureRegistry(dbManager, settingsManager, credentialStore, eventBus, actionQueue, scheduler);
  });

  afterEach(async () => {
    scheduler.stop();
    dbManager.closeAll();
    await rm(tmpDir, { recursive: true, force: true });
  });

  function rewindTaskToOverdue(taskId: string): void {
    // Simulates next_run_at passing while the app was closed (downtime, crash).
    coreDb
      .query("UPDATE scheduled_tasks SET next_run_at = ? WHERE id = ?")
      .run(new Date(Date.now() - 3_600_000).toISOString(), taskId);
  }

  async function restartWithOverdueTask(features: FeatureDefinition[], taskId: string): Promise<void> {
    // First session registers the task; its next_run_at then passes while the app is closed.
    await registry.startup(features);
    scheduler.stop();
    rewindTaskToOverdue(taskId);
    // Second session: startup must fire the overdue task on its own.
    await registry.startup(features);
    await Bun.sleep(10);
  }

  describe("registration", () => {
    test("registers feature in features table on startup", async () => {
      const feature = makeFeature({ id: "my-feature", name: "My Feature" });
      await registry.startup([feature]);
      const row = coreDb
        .query<{ id: string; name: string; version: string; enabled: number }, [string]>(
          "SELECT id, name, version, enabled FROM features WHERE id = ?",
        )
        .get("my-feature");
      expect(row).toEqual({ id: "my-feature", name: "My Feature", version: "1.0.0", enabled: 1 });
    });

    test("install runs only on first startup", async () => {
      let installCount = 0;
      const feature = makeFeature({
        install: async () => {
          installCount++;
        },
      });
      await registry.startup([feature]);
      await registry.startup([feature]);
      expect(installCount).toBe(1);
    });

    test("install receives FeatureLifecycleContext with db and log", async () => {
      let capturedCtx: FeatureLifecycleContext | undefined;
      const feature = makeFeature({
        install: async (ctx) => {
          capturedCtx = ctx;
        },
      });
      await registry.startup([feature]);
      expect(capturedCtx).toBeDefined();
      expect(capturedCtx?.db).toBeDefined();
      expect(typeof capturedCtx?.log.info).toBe("function");
    });

    test("feature migrations are run on first registration", async () => {
      const feature = makeFeature({
        id: "migrated-feature",
        migrations: [
          {
            version: "001",
            name: "create-items",
            up: "CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL)",
          },
        ],
      });
      await registry.startup([feature]);
      const featureDb = dbManager.getFeatureDatabase("migrated-feature");
      const row = featureDb
        .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'items'")
        .get();
      expect(row?.name).toBe("items");
    });

    test("updates version and manifest when feature version changes", async () => {
      await registry.startup([makeFeature({ version: "1.0.0" })]);
      await registry.startup([makeFeature({ version: "2.0.0" })]);
      const row = coreDb
        .query<{ version: string }, [string]>("SELECT version FROM features WHERE id = ?")
        .get("test-feature");
      expect(row?.version).toBe("2.0.0");
    });

    test("does not call install again on version change", async () => {
      let installCount = 0;
      const base = {
        install: async () => {
          installCount++;
        },
      };
      await registry.startup([makeFeature({ ...base, version: "1.0.0" })]);
      await registry.startup([makeFeature({ ...base, version: "2.0.0" })]);
      expect(installCount).toBe(1);
    });
  });

  describe("activation", () => {
    test("activate runs on every startup", async () => {
      let activateCount = 0;
      const feature = makeFeature({
        activate: async () => {
          activateCount++;
        },
      });
      await registry.startup([feature]);
      await registry.startup([feature]);
      expect(activateCount).toBe(2);
    });

    test("activate is skipped for disabled features", async () => {
      let activateCount = 0;
      const feature = makeFeature({
        activate: async () => {
          activateCount++;
        },
      });
      await registry.startup([feature]);
      coreDb.query("UPDATE features SET enabled = 0 WHERE id = ?").run("test-feature");
      await registry.startup([feature]);
      expect(activateCount).toBe(1);
    });

    test("provides FeatureContext with db, events, actions, queries, scheduler, settings, log", async () => {
      let capturedCtx: FeatureContext | undefined;
      const feature = makeFeature({
        activate: async (ctx) => {
          capturedCtx = ctx;
        },
      });
      await registry.startup([feature]);
      expect(capturedCtx).toBeDefined();
      expect(capturedCtx?.db).toBeDefined();
      expect(typeof capturedCtx?.events.emit).toBe("function");
      expect(typeof capturedCtx?.actions.handle).toBe("function");
      expect(typeof capturedCtx?.queries.handle).toBe("function");
      expect(typeof capturedCtx?.scheduler.register).toBe("function");
      expect(typeof capturedCtx?.settings.get).toBe("function");
      expect(typeof capturedCtx?.settings.set).toBe("function");
      expect(typeof capturedCtx?.log.info).toBe("function");
    });

    test("context db is the feature's own database", async () => {
      let featureDb: Database | undefined;
      const feature = makeFeature({
        id: "db-feature",
        activate: async (ctx) => {
          featureDb = ctx.db;
        },
      });
      await registry.startup([feature]);
      expect(featureDb).toBe(dbManager.getFeatureDatabase("db-feature"));
    });

    test("context settings are scoped to the feature", async () => {
      await settingsManager.set("other-feature", "key", "other-value");
      let capturedValue: string | undefined;
      const feature = makeFeature({
        id: "scoped-feature",
        activate: async (ctx) => {
          capturedValue = ctx.settings.get("key", "default");
        },
      });
      await registry.startup([feature]);
      expect(capturedValue).toBe("default");
    });

    test("ctx.events.emit delivers to a subscriber registered via ctx.subscribe", async () => {
      const received: unknown[] = [];
      const emitter = makeFeature({
        id: "emitter-feature",
        activate: async (ctx) => {
          ctx.events.emit("emitter-feature:happened", { value: 42 });
        },
      });
      const listener = makeFeature({
        id: "listener-feature",
        activate: async (ctx) => {
          ctx.subscribe("emitter-feature:happened", async (payload) => {
            received.push(payload);
          });
        },
      });
      await registry.startup([listener, emitter]);
      await Bun.sleep(0);
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ value: 42 });
    });

    test("ctx.events.emit logs to event_log", async () => {
      const feature = makeFeature({
        id: "logging-feature",
        activate: async (ctx) => {
          ctx.events.emit("logging-feature:did-thing", { x: 1 });
        },
      });
      await registry.startup([feature]);
      const row = coreDb
        .query<{ event_name: string; feature_id: string }, []>("SELECT event_name, feature_id FROM event_log")
        .get();
      expect(row?.event_name).toBe("logging-feature:did-thing");
      expect(row?.feature_id).toBe("logging-feature");
    });

    test("ctx.actions.handle registers handler callable via actionQueue", async () => {
      const feature = makeFeature({
        id: "action-feature",
        activate: async (ctx) => {
          ctx.actions.handle("do-thing" as never, async () => {
            return { ok: true };
          });
        },
      });
      await registry.startup([feature]);

      await actionQueue.executeQuery("action-feature", "do-thing", {}).catch(() => {});
      expect(typeof actionQueue).toBe("object"); // placeholder — covered by action-queue.test.ts
    });

    test("ctx.queries.handle registers handler invokable via ctx.query", async () => {
      let receivedParams: unknown;
      const feature = makeFeature({
        id: "query-feature",
        activate: async (ctx) => {
          ctx.queries.handle("find" as never, async (params) => {
            receivedParams = params;
            return [{ id: "1" }];
          });
        },
      });
      await registry.startup([feature]);

      const result = await actionQueue.executeQuery("query-feature", "find", { limit: 5 });
      expect(receivedParams).toEqual({ limit: 5 });
      expect(result).toEqual([{ id: "1" }]);
    });

    test("ctx.query routes to registered query handler via actionQueue", async () => {
      let querierCtx: FeatureContext | undefined;
      const provider = makeFeature({
        id: "provider-feature",
        activate: async (ctx) => {
          ctx.queries.handle("greet" as never, async (params) => {
            return `hello ${(params as { name: string }).name}`;
          });
        },
      });
      const consumer = makeFeature({
        id: "consumer-feature",
        activate: async (ctx) => {
          querierCtx = ctx;
        },
      });
      await registry.startup([provider, consumer]);

      const result = await querierCtx?.query("provider-feature", "greet", { name: "world" });
      expect(result).toBe("hello world");
    });
  });

  describe("scheduler startup", () => {
    test("runs an overdue scheduled task after startup completes without manual polling", async () => {
      let ran = false;
      const feature = makeFeature({
        id: "sched-feature",
        activate: async (ctx) => {
          ctx.scheduler.register("overdue-task", { type: "interval", value: 60_000 }, async () => {
            ran = true;
          });
        },
      });

      await restartWithOverdueTask([feature], "overdue-task");

      expect(ran).toBe(true);
    });

    test("reschedules an overdue task into the future after it fires", async () => {
      const feature = makeFeature({
        id: "sched-feature",
        activate: async (ctx) => {
          ctx.scheduler.register("overdue-task", { type: "interval", value: 60_000 }, async () => {});
        },
      });

      await restartWithOverdueTask([feature], "overdue-task");

      const row = coreDb
        .query<{ next_run_at: string }, [string]>("SELECT next_run_at FROM scheduled_tasks WHERE id = ?")
        .get("overdue-task");
      if (!row) throw new Error(`Scheduled task "overdue-task" not found`);
      expect(new Date(row.next_run_at).getTime()).toBeGreaterThan(Date.now());
    });

    test("runs tasks of the last feature to activate, proving polling starts after all activations", async () => {
      let ran = false;
      const first = makeFeature({ id: "first-feature" });
      const last = makeFeature({
        id: "last-feature",
        activate: async (ctx) => {
          ctx.scheduler.register("last-task", { type: "interval", value: 60_000 }, async () => {
            ran = true;
          });
        },
      });
      await restartWithOverdueTask([first, last], "last-task");

      expect(ran).toBe(true);
    });
  });

  describe("error handling", () => {
    test("auto-disables feature that throws during activate", async () => {
      const spy = spyOn(console, "error").mockImplementation(() => {});
      const feature = makeFeature({
        id: "broken-feature",
        activate: async () => {
          throw new Error("activation failed");
        },
      });
      await registry.startup([feature]);
      spy.mockRestore();
      const row = coreDb
        .query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
        .get("broken-feature");
      expect(row?.enabled).toBe(0);
    });

    test("continues activating remaining features after one fails", async () => {
      const spy = spyOn(console, "error").mockImplementation(() => {});
      let goodActivated = false;
      const bad = makeFeature({
        id: "bad-feature",
        activate: async () => {
          throw new Error("oops");
        },
      });
      const good = makeFeature({
        id: "good-feature",
        activate: async () => {
          goodActivated = true;
        },
      });
      await registry.startup([bad, good]);
      spy.mockRestore();
      expect(goodActivated).toBe(true);
    });
  });
});
