import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseManager } from "./database-manager";

describe("DatabaseManager", () => {
  let manager: DatabaseManager;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-db-"));
    manager = new DatabaseManager(tmpDir);
  });

  afterEach(async () => {
    manager.closeAll();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    test("creates dataDir and features subdirectory", async () => {
      await access(join(tmpDir, "features"));
    });
  });

  describe("getCoreDatabase", () => {
    test("enables WAL mode", () => {
      const db = manager.getCoreDatabase();
      const row = db.query("PRAGMA journal_mode").get() as { journal_mode: string };
      expect(row.journal_mode.toLowerCase()).toBe("wal");
    });

    test("enables foreign keys", () => {
      const db = manager.getCoreDatabase();
      const row = db.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
      expect(row.foreign_keys).toBe(1);
    });

    test("bootstraps migrations table", () => {
      const db = manager.getCoreDatabase();
      const row = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'").get() as {
        name: string;
      } | null;
      expect(row?.name).toBe("migrations");
    });

    test("creates all core schema tables", () => {
      const db = manager.getCoreDatabase();
      const names = db
        .query(
          `SELECT name FROM sqlite_master WHERE type = 'table'
					AND name IN (
						'credentials','event_log','execution_actions','features',
						'scheduled_tasks','script_executions','script_store',
						'script_subscriptions','scripts','settings'
					) ORDER BY name`,
        )
        .all() as { name: string }[];
      expect(names.map((n) => n.name)).toEqual([
        "credentials",
        "event_log",
        "execution_actions",
        "features",
        "scheduled_tasks",
        "script_executions",
        "script_store",
        "script_subscriptions",
        "scripts",
        "settings",
      ]);
    });

    test("tracks applied migrations", () => {
      const db = manager.getCoreDatabase();
      const row = db
        .query("SELECT feature_id, version FROM migrations WHERE feature_id = ? AND version = ?")
        .get("core", "001") as { feature_id: string; version: string } | null;
      expect(row).toEqual({ feature_id: "core", version: "001" });
    });

    test("is idempotent on repeated calls", () => {
      manager.getCoreDatabase();
      manager.getCoreDatabase();
      const db = manager.getCoreDatabase();
      const rows = db.query("SELECT version FROM migrations WHERE feature_id = ?").all("core") as {
        version: string;
      }[];
      expect(rows).toEqual([{ version: "001" }, { version: "002" }, { version: "003" }]);
    });
  });

  describe("getFeatureDatabase", () => {
    test("creates feature database file", async () => {
      manager.getFeatureDatabase("todo");
      await access(join(tmpDir, "features", "todo.db"));
    });

    test("enables WAL mode", () => {
      const db = manager.getFeatureDatabase("todo");
      const row = db.query("PRAGMA journal_mode").get() as { journal_mode: string };
      expect(row.journal_mode.toLowerCase()).toBe("wal");
    });

    test("bootstraps migrations table only", () => {
      const db = manager.getFeatureDatabase("todo");
      const tables = db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
        name: string;
      }[];
      expect(tables).toEqual([{ name: "migrations" }]);
    });

    test("returns cached instance on repeated calls", () => {
      const a = manager.getFeatureDatabase("todo");
      const b = manager.getFeatureDatabase("todo");
      expect(a).toBe(b);
    });
  });

  describe("closeAll", () => {
    test("closes all connections", () => {
      const core = manager.getCoreDatabase();
      const feat = manager.getFeatureDatabase("todo");
      manager.closeAll();
      expect(() => core.query("SELECT 1").get()).toThrow();
      expect(() => feat.query("SELECT 1").get()).toThrow();
    });
  });
});
