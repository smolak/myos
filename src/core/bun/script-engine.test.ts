import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ActionQueue } from "./action-queue";
import { EventBus } from "./event-bus";
import { ScriptEngine } from "./script-engine";

function setupDb(): Database {
  const db = new Database(":memory:");
  db.run(`
    CREATE TABLE event_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      feature_id TEXT NOT NULL,
      payload    TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE scripts (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      code        TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE script_executions (
      id              TEXT PRIMARY KEY,
      script_id       TEXT NOT NULL,
      triggered_by    TEXT NOT NULL,
      trigger_payload TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      created_at      TEXT NOT NULL,
      completed_at    TEXT
    );

    CREATE TABLE execution_actions (
      id             TEXT PRIMARY KEY,
      execution_id   TEXT NOT NULL,
      sequence       INTEGER NOT NULL,
      feature_id     TEXT NOT NULL,
      action_name    TEXT NOT NULL,
      params         TEXT NOT NULL,
      depends_on     INTEGER,
      output_key     TEXT,
      status         TEXT NOT NULL DEFAULT 'pending',
      result         TEXT,
      error          TEXT,
      retry_count    INTEGER NOT NULL DEFAULT 0,
      correlation_id TEXT,
      max_retries    INTEGER NOT NULL DEFAULT 3,
      created_at     TEXT NOT NULL,
      completed_at   TEXT
    );

    CREATE TABLE script_store (
      script_id  TEXT NOT NULL,
      key        TEXT NOT NULL,
      value      TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (script_id, key)
    );
  `);
  return db;
}

function insertScript(db: Database, id: string, name: string, code: string, enabled = 1): void {
  const now = new Date().toISOString();
  db.query("INSERT INTO scripts (id, name, code, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    name,
    code,
    enabled,
    now,
    now,
  );
}

function getStoreValue(db: Database, scriptId: string, key: string): unknown {
  const row = db
    .query<{ value: string | null }, [string, string]>("SELECT value FROM script_store WHERE script_id = ? AND key = ?")
    .get(scriptId, key);
  return row?.value !== null && row?.value !== undefined ? JSON.parse(row.value) : undefined;
}

function getExecution(db: Database, scriptId: string): { status: string; triggered_by: string } | null {
  return db
    .query<{ status: string; triggered_by: string }, [string]>(
      "SELECT status, triggered_by FROM script_executions WHERE script_id = ?",
    )
    .get(scriptId);
}

describe("ScriptEngine", () => {
  let db: Database;
  let eventBus: EventBus;
  let actionQueue: ActionQueue;
  let engine: ScriptEngine;

  beforeEach(() => {
    db = setupDb();
    eventBus = new EventBus(db);
    actionQueue = new ActionQueue(db, 0);
    engine = new ScriptEngine(db, eventBus, actionQueue);
  });

  afterEach(() => {
    db.close();
  });

  describe("start", () => {
    test("skips disabled scripts", async () => {
      insertScript(
        db,
        "s1",
        "disabled-script",
        `ctx.on("test:event", async () => { await ctx.store.set("ran", true); });`,
        0,
      );

      engine.start();
      eventBus.emit("test:event", "system", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "ran")).toBeUndefined();
    });

    test("logs and skips scripts that fail to evaluate", () => {
      const spy = spyOn(console, "error").mockImplementation(() => {});
      insertScript(db, "s1", "bad-script", "this is not valid javascript }{");

      expect(() => engine.start()).not.toThrow();
      spy.mockRestore();
    });

    test("logs and skips scripts that throw during initialization", () => {
      const spy = spyOn(console, "error").mockImplementation(() => {});
      insertScript(db, "s1", "throwing-script", "throw new Error('init error');");

      expect(() => engine.start()).not.toThrow();
      spy.mockRestore();
    });
  });

  describe("ctx.on", () => {
    test("handler is called when subscribed event fires", async () => {
      insertScript(
        db,
        "s1",
        "listener",
        `ctx.on("todo:created", async (payload) => { await ctx.store.set("got", payload); });`,
      );

      engine.start();
      eventBus.emit("todo:created", "todo", { id: "abc" });
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "got")).toEqual({ id: "abc" });
    });

    test("handler is not called for a different event", async () => {
      insertScript(db, "s1", "listener", `ctx.on("todo:created", async () => { await ctx.store.set("ran", true); });`);

      engine.start();
      eventBus.emit("todo:deleted", "todo", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "ran")).toBeUndefined();
    });

    test("multiple ctx.on calls in one script all register", async () => {
      insertScript(
        db,
        "s1",
        "multi-listener",
        `
          ctx.on("event:a", async () => { await ctx.store.set("a", true); });
          ctx.on("event:b", async () => { await ctx.store.set("b", true); });
        `,
      );

      engine.start();
      eventBus.emit("event:a", "sys", {});
      eventBus.emit("event:b", "sys", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "a")).toBe(true);
      expect(getStoreValue(db, "s1", "b")).toBe(true);
    });

    test("handler error does not affect other scripts", async () => {
      const spy = spyOn(console, "error").mockImplementation(() => {});
      insertScript(
        db,
        "s1",
        "failing-script",
        `ctx.on("test:event", async () => { throw new Error("handler failure"); });`,
      );
      insertScript(db, "s2", "good-script", `ctx.on("test:event", async () => { await ctx.store.set("ran", true); });`);

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      spy.mockRestore();
      expect(getStoreValue(db, "s2", "ran")).toBe(true);
    });
  });

  describe("ctx.store", () => {
    test("stores and retrieves a value across the same handler invocation", async () => {
      insertScript(
        db,
        "s1",
        "store-test",
        `
          ctx.on("test:event", async () => {
            await ctx.store.set("count", 42);
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "count")).toBe(42);
    });

    test("overwrites an existing value", async () => {
      insertScript(
        db,
        "s1",
        "overwrite-test",
        `
          ctx.on("test:event", async () => {
            await ctx.store.set("val", "second");
          });
        `,
      );

      db.query("INSERT INTO script_store (script_id, key, value, updated_at) VALUES (?, ?, ?, ?)").run(
        "s1",
        "val",
        JSON.stringify("first"),
        new Date().toISOString(),
      );

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "val")).toBe("second");
    });

    test("get returns undefined for a missing key", async () => {
      insertScript(
        db,
        "s1",
        "get-test",
        `
          ctx.on("test:event", async () => {
            const val = ctx.store.get("missing");
            await ctx.store.set("result", val === undefined ? "undefined" : "found");
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "result")).toBe("undefined");
    });
  });

  describe("ctx.queries", () => {
    test("invokes the registered query handler and returns result", async () => {
      actionQueue.registerQueryHandler("todo", "find", async () => [{ id: "1", title: "Buy milk" }]);

      insertScript(
        db,
        "s1",
        "query-test",
        `
          ctx.on("test:event", async () => {
            const todos = await ctx.queries.todo.find({ completed: false });
            await ctx.store.set("todos", todos);
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "todos")).toEqual([{ id: "1", title: "Buy milk" }]);
    });

    test("throws when querying an unregistered handler", async () => {
      insertScript(
        db,
        "s1",
        "bad-query",
        `
          ctx.on("test:event", async () => {
            try {
              await ctx.queries.todo.find({});
            } catch (_e) {
              await ctx.store.set("threw", true);
            }
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "threw")).toBe(true);
    });
  });

  describe("ctx.actions", () => {
    test("enqueues and executes the action, returning the result", async () => {
      actionQueue.registerHandler("todo", "create", async (params) => ({
        id: "new-id",
        ...(params as object),
      }));

      insertScript(
        db,
        "s1",
        "action-test",
        `
          ctx.on("test:event", async () => {
            const result = await ctx.actions.todo.create({ title: "Auto todo" });
            await ctx.store.set("result", result);
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "result")).toEqual({ id: "new-id", title: "Auto todo" });
    });

    test("persists execution_action to DB before executing", async () => {
      let actionStarted = false;
      actionQueue.registerHandler("todo", "create", async () => {
        actionStarted = true;
        const row = db
          .query<{ status: string }, []>(
            "SELECT status FROM execution_actions WHERE feature_id = 'todo' AND action_name = 'create'",
          )
          .get();
        expect(row?.status).toBe("running");
        return { id: "x" };
      });

      insertScript(
        db,
        "s1",
        "persistence-test",
        `ctx.on("test:event", async () => { await ctx.actions.todo.create({}); });`,
      );

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      expect(actionStarted).toBe(true);
    });

    test("marks execution as failed when action handler throws and max retries exhausted", async () => {
      const spy = spyOn(console, "error").mockImplementation(() => {});
      actionQueue.registerHandler("todo", "fail", async () => {
        throw new Error("action always fails");
      });

      insertScript(
        db,
        "s1",
        "fail-action-test",
        `
          ctx.on("test:event", async () => {
            try {
              await ctx.actions.todo.fail({});
            } catch (_e) {
              await ctx.store.set("caught", true);
            }
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(50);
      spy.mockRestore();

      expect(getStoreValue(db, "s1", "caught")).toBe(true);

      const actionRow = db
        .query<{ status: string }, []>(
          "SELECT status FROM execution_actions WHERE feature_id = 'todo' AND action_name = 'fail'",
        )
        .get();
      expect(actionRow?.status).toBe("failed");
    });
  });

  describe("ctx.log", () => {
    test("logs without throwing", async () => {
      insertScript(
        db,
        "s1",
        "log-test",
        `
          ctx.on("test:event", async () => {
            ctx.log("hello from script");
            await ctx.store.set("done", true);
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "done")).toBe(true);
    });
  });

  describe("ctx.match", () => {
    test("returns true for an exact match", () => {
      insertScript(db, "s1", "match-test", "");
      engine.start();

      const result = db
        .query<{ value: string | null }, [string, string]>(
          "SELECT value FROM script_store WHERE script_id = ? AND key = ?",
        )
        .get("s1", "anything");
      expect(result).toBeNull();
    });

    test("matches exact string via handler", async () => {
      insertScript(
        db,
        "s1",
        "match-exact",
        `
          ctx.on("test:event", async (payload) => {
            const matched = ctx.match(payload.value, ["hello"]);
            await ctx.store.set("matched", matched);
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", { value: "hello" });
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "matched")).toBe(true);
    });

    test("matches with wildcard pattern", async () => {
      insertScript(
        db,
        "s1",
        "match-glob",
        `
          ctx.on("test:event", async (payload) => {
            const matched = ctx.match(payload.value, ["todo:*"]);
            await ctx.store.set("matched", matched);
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", { value: "todo:item-created" });
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "matched")).toBe(true);
    });

    test("returns false when no patterns match", async () => {
      insertScript(
        db,
        "s1",
        "match-none",
        `
          ctx.on("test:event", async (payload) => {
            const matched = ctx.match(payload.value, ["rss:*", "calendar:*"]);
            await ctx.store.set("matched", matched);
          });
        `,
      );

      engine.start();
      eventBus.emit("test:event", "sys", { value: "todo:created" });
      await Bun.sleep(10);

      expect(getStoreValue(db, "s1", "matched")).toBe(false);
    });
  });

  describe("script_executions tracking", () => {
    test("creates an execution record when handler runs", async () => {
      insertScript(
        db,
        "s1",
        "tracking-test",
        `ctx.on("test:event", async () => { await ctx.store.set("done", true); });`,
      );

      engine.start();
      eventBus.emit("test:event", "sys", { x: 1 });
      await Bun.sleep(10);

      const exec = getExecution(db, "s1");
      expect(exec?.status).toBe("completed");
      expect(exec?.triggered_by).toBe("test:event");
    });

    test("marks execution as failed when handler throws", async () => {
      const spy = spyOn(console, "error").mockImplementation(() => {});
      insertScript(db, "s1", "fail-test", `ctx.on("test:event", async () => { throw new Error("boom"); });`);

      engine.start();
      eventBus.emit("test:event", "sys", {});
      await Bun.sleep(10);

      spy.mockRestore();
      const exec = getExecution(db, "s1");
      expect(exec?.status).toBe("failed");
    });
  });

  describe("end-to-end: event → script → action queue → feature action", () => {
    test("event fires, script runs, action executes via action queue", async () => {
      const created: unknown[] = [];
      actionQueue.registerHandler("todo", "create", async (params) => {
        created.push(params);
        return { id: "new-todo" };
      });

      insertScript(
        db,
        "s1",
        "e2e-script",
        `
          ctx.on("pomodoro:session-ended", async (session) => {
            await ctx.actions.todo.create({ title: "Review session", sessionId: session.id });
          });
        `,
      );

      engine.start();
      eventBus.emit("pomodoro:session-ended", "pomodoro", { id: "session-42" });
      await Bun.sleep(10);

      expect(created).toHaveLength(1);
      expect(created[0]).toEqual({ title: "Review session", sessionId: "session-42" });

      const exec = getExecution(db, "s1");
      expect(exec?.status).toBe("completed");

      const action = db
        .query<{ status: string; feature_id: string; action_name: string }, []>(
          "SELECT status, feature_id, action_name FROM execution_actions",
        )
        .get();
      expect(action?.status).toBe("completed");
      expect(action?.feature_id).toBe("todo");
      expect(action?.action_name).toBe("create");
    });
  });
});
