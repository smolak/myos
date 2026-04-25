import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { addNote, deleteNote, updateNote } from "./actions";
import { dailyJournalMigrations } from "./migrations";

describe("Daily Journal actions", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-journal-actions-"));
    db = new Database(join(tmpDir, "daily-journal.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "daily-journal", dailyJournalMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("addNote", () => {
    test("returns a generated id", async () => {
      const result = await addNote(db, { date: "2026-04-25", content: "Today was productive." });
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
    });

    test("persists date and content in DB", async () => {
      const { id } = await addNote(db, { date: "2026-04-25", content: "Great day" });
      const row = db
        .query<{ date: string; content: string }, [string]>("SELECT date, content FROM journal_notes WHERE id = ?")
        .get(id);
      expect(row?.date).toBe("2026-04-25");
      expect(row?.content).toBe("Great day");
    });

    test("sets created_at and updated_at to the same ISO timestamp", async () => {
      const before = new Date().toISOString();
      const { id } = await addNote(db, { date: "2026-04-25", content: "Test" });
      const after = new Date().toISOString();
      const row = db
        .query<{ created_at: string; updated_at: string }, [string]>(
          "SELECT created_at, updated_at FROM journal_notes WHERE id = ?",
        )
        .get(id);
      expect(row!.created_at >= before).toBe(true);
      expect(row!.created_at <= after).toBe(true);
      expect(row?.updated_at).toBe(row?.created_at);
    });

    test("two adds on different dates produce different ids", async () => {
      const a = await addNote(db, { date: "2026-04-24", content: "Day 1" });
      const b = await addNote(db, { date: "2026-04-25", content: "Day 2" });
      expect(a.id).not.toBe(b.id);
    });

    test("enforces UNIQUE constraint on date", async () => {
      await addNote(db, { date: "2026-04-25", content: "First" });
      expect(() => addNote(db, { date: "2026-04-25", content: "Second" })).toThrow();
    });
  });

  describe("updateNote", () => {
    test("updates content", async () => {
      const { id } = await addNote(db, { date: "2026-04-25", content: "Old" });
      const result = await updateNote(db, { id, content: "New content" });
      expect(result.success).toBe(true);
      const row = db.query<{ content: string }, [string]>("SELECT content FROM journal_notes WHERE id = ?").get(id);
      expect(row?.content).toBe("New content");
    });

    test("bumps updated_at", async () => {
      const { id } = await addNote(db, { date: "2026-04-25", content: "Old" });
      const before = db
        .query<{ updated_at: string }, [string]>("SELECT updated_at FROM journal_notes WHERE id = ?")
        .get(id)!.updated_at;
      await new Promise((r) => setTimeout(r, 5));
      await updateNote(db, { id, content: "New" });
      const after = db
        .query<{ updated_at: string }, [string]>("SELECT updated_at FROM journal_notes WHERE id = ?")
        .get(id)!.updated_at;
      expect(after > before).toBe(true);
    });

    test("returns success=false for non-existent id", async () => {
      const result = await updateNote(db, { id: "ghost", content: "x" });
      expect(result.success).toBe(false);
    });

    test("is idempotent — applying same update twice has same result", async () => {
      const { id } = await addNote(db, { date: "2026-04-25", content: "Initial" });
      await updateNote(db, { id, content: "Final" });
      await updateNote(db, { id, content: "Final" });
      const row = db.query<{ content: string }, [string]>("SELECT content FROM journal_notes WHERE id = ?").get(id);
      expect(row?.content).toBe("Final");
    });
  });

  describe("deleteNote", () => {
    test("removes the note from DB", async () => {
      const { id } = await addNote(db, { date: "2026-04-25", content: "To delete" });
      const result = await deleteNote(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ id: string }, [string]>("SELECT id FROM journal_notes WHERE id = ?").get(id);
      expect(row).toBeNull();
    });

    test("is idempotent — deleting a non-existent id succeeds", async () => {
      const result = await deleteNote(db, { id: "ghost" });
      expect(result.success).toBe(true);
    });
  });
});
