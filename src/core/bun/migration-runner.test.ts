import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Migration } from "@core/types";
import { bootstrapMigrationsTable, getAppliedMigrations, runMigrations } from "./migration-runner";

describe("bootstrapMigrationsTable", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  test("creates table if not exists", () => {
    bootstrapMigrationsTable(db);
    const row = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'").get() as {
      name: string;
    } | null;
    expect(row?.name).toBe("migrations");
  });

  test("is idempotent on repeated calls", () => {
    bootstrapMigrationsTable(db);
    bootstrapMigrationsTable(db);
    const count = db
      .query("SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = 'migrations'")
      .get() as { c: number };
    expect(count.c).toBe(1);
  });
});

describe("runMigrations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  test("applies pending migrations", () => {
    const migrations: Migration[] = [
      {
        version: "001",
        name: "one",
        up: "CREATE TABLE t1 (id INTEGER PRIMARY KEY);",
      },
    ];
    const result = runMigrations(db, "feat", migrations);
    expect(result).toEqual({ applied: ["001"], skipped: [] });
    const row = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 't1'").get() as {
      name: string;
    } | null;
    expect(row?.name).toBe("t1");
  });

  test("skips already-applied migrations", () => {
    const migrations: Migration[] = [
      {
        version: "001",
        name: "one",
        up: "CREATE TABLE t1 (id INTEGER PRIMARY KEY);",
      },
    ];
    expect(runMigrations(db, "feat", migrations)).toEqual({ applied: ["001"], skipped: [] });
    expect(runMigrations(db, "feat", migrations)).toEqual({ applied: [], skipped: ["001"] });
  });

  test("rolls back on SQL error", () => {
    const migrations: Migration[] = [
      {
        version: "bad",
        name: "broken",
        up: "THIS IS NOT VALID SQL;",
      },
    ];
    expect(() => runMigrations(db, "feat", migrations)).toThrow();
    const appliedRow = db
      .query("SELECT 1 AS ok FROM migrations WHERE feature_id = ? AND version = ?")
      .get("feat", "bad");
    expect(appliedRow).toBeNull();
  });
});

describe("getAppliedMigrations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  test("returns version list", () => {
    const migrations: Migration[] = [
      {
        version: "001",
        name: "one",
        up: "CREATE TABLE t1 (id INTEGER PRIMARY KEY);",
      },
    ];
    runMigrations(db, "feat", migrations);
    expect(getAppliedMigrations(db, "feat")).toEqual(["001"]);
  });

  test("returns empty list for new database", () => {
    expect(getAppliedMigrations(db, "feat")).toEqual([]);
  });
});
