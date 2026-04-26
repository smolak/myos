import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { addNote } from "./actions";
import { dailyJournalMigrations } from "./migrations";
import { searchJournalNotes } from "./search";

describe("searchJournalNotes", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-journal-search-"));
    db = new Database(join(tmpDir, "journal.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "daily-journal", dailyJournalMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns empty array when no notes exist", async () => {
    const result = await searchJournalNotes(db, { query: "standup" });
    expect(result).toEqual([]);
  });

  test("returns empty array when query is empty", async () => {
    await addNote(db, { date: "2026-04-25", content: "Had a standup" });
    const result = await searchJournalNotes(db, { query: "" });
    expect(result).toEqual([]);
  });

  test("matches note by content", async () => {
    await addNote(db, { date: "2026-04-25", content: "Had a standup meeting" });
    const result = await searchJournalNotes(db, { query: "standup" });
    expect(result).toHaveLength(1);
  });

  test("is case-insensitive", async () => {
    await addNote(db, { date: "2026-04-25", content: "Standup notes" });
    const result = await searchJournalNotes(db, { query: "standup" });
    expect(result).toHaveLength(1);
  });

  test("does not match notes without the query term", async () => {
    await addNote(db, { date: "2026-04-25", content: "Worked on RSS reader" });
    const result = await searchJournalNotes(db, { query: "standup" });
    expect(result).toEqual([]);
  });

  test("result has correct shape", async () => {
    const { id } = await addNote(db, { date: "2026-04-25", content: "Had a standup meeting" });
    const result = await searchJournalNotes(db, { query: "standup" });
    expect(result[0]).toMatchObject({
      itemId: id,
      type: "journal-note",
    });
  });

  test("title is the content snippet (up to 60 chars)", async () => {
    const content = "Had a standup meeting, reviewed PRs, merged a few branches";
    await addNote(db, { date: "2026-04-25", content });
    const result = await searchJournalNotes(db, { query: "standup" });
    expect(result[0]?.title.length).toBeLessThanOrEqual(63); // 60 + "..."
  });

  test("subtitle is the note date", async () => {
    await addNote(db, { date: "2026-04-25", content: "standup was good" });
    const result = await searchJournalNotes(db, { query: "standup" });
    expect(result[0]?.subtitle).toBe("2026-04-25");
  });

  test("limits results to 10", async () => {
    for (let i = 0; i < 15; i++) {
      const date = `2026-01-${String(i + 1).padStart(2, "0")}`;
      await addNote(db, { date, content: `standup notes for day ${i}` });
    }
    const result = await searchJournalNotes(db, { query: "standup" });
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
