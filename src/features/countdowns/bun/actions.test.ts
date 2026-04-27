import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { archiveCountdown, createCountdown, deleteCountdown } from "./actions";
import { countdownsMigrations } from "./migrations";

describe("Countdowns actions", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-countdowns-actions-"));
    db = new Database(join(tmpDir, "countdowns.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "countdowns", countdownsMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("createCountdown", () => {
    test("returns a generated id", async () => {
      const result = await createCountdown(db, { name: "Birthday", targetDate: "2027-01-01" });
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
    });

    test("persists name and target date", async () => {
      const { id } = await createCountdown(db, { name: "Launch", targetDate: "2027-06-15" });
      const row = db
        .query<{ name: string; target_date: string }, [string]>("SELECT name, target_date FROM countdowns WHERE id = ?")
        .get(id);
      expect(row?.name).toBe("Launch");
      expect(row?.target_date).toBe("2027-06-15");
    });

    test("archived_at defaults to null", async () => {
      const { id } = await createCountdown(db, { name: "X", targetDate: "2027-01-01" });
      const row = db
        .query<{ archived_at: string | null }, [string]>("SELECT archived_at FROM countdowns WHERE id = ?")
        .get(id);
      expect(row?.archived_at).toBeNull();
    });

    test("two creates produce different ids", async () => {
      const a = await createCountdown(db, { name: "A", targetDate: "2027-01-01" });
      const b = await createCountdown(db, { name: "B", targetDate: "2027-02-01" });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("deleteCountdown", () => {
    test("removes the countdown from DB", async () => {
      const { id } = await createCountdown(db, { name: "X", targetDate: "2027-01-01" });
      const result = await deleteCountdown(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ id: string }, [string]>("SELECT id FROM countdowns WHERE id = ?").get(id);
      expect(row).toBeNull();
    });

    test("is idempotent — deleting a non-existent id succeeds", async () => {
      const result = await deleteCountdown(db, { id: "ghost" });
      expect(result.success).toBe(true);
    });
  });

  describe("archiveCountdown", () => {
    test("sets archived_at to a non-null timestamp", async () => {
      const { id } = await createCountdown(db, { name: "X", targetDate: "2027-01-01" });
      const result = await archiveCountdown(db, { id });
      expect(result.success).toBe(true);
      const row = db
        .query<{ archived_at: string | null }, [string]>("SELECT archived_at FROM countdowns WHERE id = ?")
        .get(id);
      expect(row?.archived_at).not.toBeNull();
    });

    test("returns success=false for non-existent id", async () => {
      const result = await archiveCountdown(db, { id: "ghost" });
      expect(result.success).toBe(false);
    });
  });
});
