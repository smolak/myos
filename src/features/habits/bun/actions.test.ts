import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { completeHabit, createHabit, deleteHabit, uncompleteHabit } from "./actions";
import { habitsMigrations } from "./migrations";

describe("Habits actions", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-habits-actions-"));
    db = new Database(join(tmpDir, "habits.db"));
    db.run("PRAGMA journal_mode=WAL");
    db.run("PRAGMA foreign_keys=ON");
    bootstrapMigrationsTable(db);
    runMigrations(db, "habits", habitsMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("createHabit", () => {
    test("returns a generated id", async () => {
      const result = await createHabit(db, { name: "Exercise" });
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
    });

    test("persists name in DB", async () => {
      const { id } = await createHabit(db, { name: "Read" });
      const row = db.query<{ name: string }, [string]>("SELECT name FROM habits WHERE id = ?").get(id);
      expect(row?.name).toBe("Read");
    });

    test("saves optional description", async () => {
      const { id } = await createHabit(db, { name: "Meditate", description: "10 minutes" });
      const row = db
        .query<{ description: string | null }, [string]>("SELECT description FROM habits WHERE id = ?")
        .get(id);
      expect(row?.description).toBe("10 minutes");
    });

    test("description defaults to null", async () => {
      const { id } = await createHabit(db, { name: "Walk" });
      const row = db
        .query<{ description: string | null }, [string]>("SELECT description FROM habits WHERE id = ?")
        .get(id);
      expect(row?.description).toBeNull();
    });

    test("defaults frequency to daily", async () => {
      const { id } = await createHabit(db, { name: "Stretch" });
      const row = db.query<{ frequency: string }, [string]>("SELECT frequency FROM habits WHERE id = ?").get(id);
      expect(row?.frequency).toBe("daily");
    });

    test("persists custom frequency", async () => {
      const { id } = await createHabit(db, { name: "Gym", frequency: "weekly" });
      const row = db.query<{ frequency: string }, [string]>("SELECT frequency FROM habits WHERE id = ?").get(id);
      expect(row?.frequency).toBe("weekly");
    });

    test("two creates produce different ids", async () => {
      const a = await createHabit(db, { name: "A" });
      const b = await createHabit(db, { name: "B" });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("deleteHabit", () => {
    test("removes the habit from DB", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      const result = await deleteHabit(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ id: string }, [string]>("SELECT id FROM habits WHERE id = ?").get(id);
      expect(row).toBeNull();
    });

    test("is idempotent — deleting a non-existent id succeeds", async () => {
      const result = await deleteHabit(db, { id: "ghost" });
      expect(result.success).toBe(true);
    });

    test("cascades to completions", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      await completeHabit(db, { id, date: "2025-01-01" });
      await deleteHabit(db, { id });
      const row = db
        .query<{ count: number }, [string]>("SELECT COUNT(*) as count FROM habit_completions WHERE habit_id = ?")
        .get(id);
      expect(row?.count).toBe(0);
    });
  });

  describe("completeHabit", () => {
    test("creates a completion record", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      const result = await completeHabit(db, { id, date: "2025-01-01" });
      expect(result.success).toBe(true);
      const row = db.query<{ date: string }, [string]>("SELECT date FROM habit_completions WHERE habit_id = ?").get(id);
      expect(row?.date).toBe("2025-01-01");
    });

    test("is idempotent — completing the same date twice succeeds", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      await completeHabit(db, { id, date: "2025-01-01" });
      const result = await completeHabit(db, { id, date: "2025-01-01" });
      expect(result.success).toBe(true);
      const count = db
        .query<{ count: number }, [string]>("SELECT COUNT(*) as count FROM habit_completions WHERE habit_id = ?")
        .get(id);
      expect(count?.count).toBe(1);
    });

    test("returns success=false for non-existent habit", async () => {
      const result = await completeHabit(db, { id: "ghost", date: "2025-01-01" });
      expect(result.success).toBe(false);
    });
  });

  describe("uncompleteHabit", () => {
    test("removes the completion record", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      await completeHabit(db, { id, date: "2025-01-01" });
      const result = await uncompleteHabit(db, { id, date: "2025-01-01" });
      expect(result.success).toBe(true);
      const row = db.query<{ date: string }, [string]>("SELECT date FROM habit_completions WHERE habit_id = ?").get(id);
      expect(row).toBeNull();
    });

    test("is idempotent — uncompleting a non-completed date succeeds", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      const result = await uncompleteHabit(db, { id, date: "2025-01-01" });
      expect(result.success).toBe(true);
    });
  });
});
