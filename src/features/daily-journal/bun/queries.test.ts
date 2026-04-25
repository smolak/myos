import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { coreMigrations } from "@core/bun/migrations";
import { addNote } from "./actions";
import { dailyJournalMigrations } from "./migrations";
import { getNoteByDate, getNotes, getTimelineEvents } from "./queries";

describe("Daily Journal queries", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-journal-queries-"));
    db = new Database(join(tmpDir, "daily-journal.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "daily-journal", dailyJournalMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getNotes", () => {
    test("returns empty array when no notes exist", async () => {
      const result = await getNotes(db, {});
      expect(result).toEqual([]);
    });

    test("returns notes ordered by date descending", async () => {
      await addNote(db, { date: "2026-04-23", content: "First" });
      await addNote(db, { date: "2026-04-25", content: "Third" });
      await addNote(db, { date: "2026-04-24", content: "Second" });
      const result = await getNotes(db, {});
      expect(result[0]?.date).toBe("2026-04-25");
      expect(result[1]?.date).toBe("2026-04-24");
      expect(result[2]?.date).toBe("2026-04-23");
    });

    test("respects limit", async () => {
      await addNote(db, { date: "2026-04-23", content: "A" });
      await addNote(db, { date: "2026-04-24", content: "B" });
      await addNote(db, { date: "2026-04-25", content: "C" });
      const result = await getNotes(db, { limit: 2 });
      expect(result).toHaveLength(2);
    });

    test("filters by search term in content", async () => {
      await addNote(db, { date: "2026-04-23", content: "I went running today" });
      await addNote(db, { date: "2026-04-24", content: "Quiet day at home" });
      const result = await getNotes(db, { search: "running" });
      expect(result).toHaveLength(1);
      expect(result[0]?.content).toContain("running");
    });

    test("maps fields to camelCase", async () => {
      const { id } = await addNote(db, { date: "2026-04-25", content: "Hello" });
      const result = await getNotes(db, {});
      const note = result.find((n) => n.id === id);
      expect(note).toBeDefined();
      expect(note?.createdAt).toBeDefined();
      expect(note?.updatedAt).toBeDefined();
    });
  });

  describe("getNoteByDate", () => {
    test("returns null when no note for date", async () => {
      const result = await getNoteByDate(db, { date: "2026-04-25" });
      expect(result).toBeNull();
    });

    test("returns note matching date", async () => {
      const { id } = await addNote(db, { date: "2026-04-25", content: "Great day" });
      const result = await getNoteByDate(db, { date: "2026-04-25" });
      expect(result?.id).toBe(id);
      expect(result?.content).toBe("Great day");
    });

    test("does not return note for different date", async () => {
      await addNote(db, { date: "2026-04-24", content: "Yesterday" });
      const result = await getNoteByDate(db, { date: "2026-04-25" });
      expect(result).toBeNull();
    });
  });

  describe("getTimelineEvents", () => {
    let coreDb: Database;

    beforeEach(async () => {
      coreDb = new Database(join(tmpDir, "core.db"));
      coreDb.run("PRAGMA journal_mode=WAL");
      bootstrapMigrationsTable(coreDb);
      runMigrations(coreDb, "core", coreMigrations);
    });

    afterEach(() => {
      coreDb.close();
    });

    test("returns empty array when no relevant events", () => {
      const result = getTimelineEvents(coreDb, "2026-04-25");
      expect(result).toEqual([]);
    });

    test("returns todo:item-completed events for the date", () => {
      coreDb
        .query("INSERT INTO event_log (event_name, feature_id, payload, created_at) VALUES (?, ?, ?, ?)")
        .run(
          "todo:item-completed",
          "todo",
          JSON.stringify({ id: "t1", title: "Buy milk" }),
          "2026-04-25T10:00:00.000Z",
        );

      const result = getTimelineEvents(coreDb, "2026-04-25");
      expect(result).toHaveLength(1);
      expect(result[0]?.eventName).toBe("todo:item-completed");
      expect(result[0]?.featureId).toBe("todo");
    });

    test("returns pomodoro:session-ended events for the date", () => {
      coreDb
        .query("INSERT INTO event_log (event_name, feature_id, payload, created_at) VALUES (?, ?, ?, ?)")
        .run("pomodoro:session-ended", "pomodoro", JSON.stringify({ type: "work" }), "2026-04-25T14:00:00.000Z");

      const result = getTimelineEvents(coreDb, "2026-04-25");
      expect(result).toHaveLength(1);
      expect(result[0]?.eventName).toBe("pomodoro:session-ended");
    });

    test("excludes events from other dates", () => {
      coreDb
        .query("INSERT INTO event_log (event_name, feature_id, payload, created_at) VALUES (?, ?, ?, ?)")
        .run("todo:item-completed", "todo", null, "2026-04-24T10:00:00.000Z");

      const result = getTimelineEvents(coreDb, "2026-04-25");
      expect(result).toHaveLength(0);
    });

    test("excludes non-timeline events (e.g. todo:item-created)", () => {
      coreDb
        .query("INSERT INTO event_log (event_name, feature_id, payload, created_at) VALUES (?, ?, ?, ?)")
        .run("todo:item-created", "todo", null, "2026-04-25T10:00:00.000Z");

      const result = getTimelineEvents(coreDb, "2026-04-25");
      expect(result).toHaveLength(0);
    });

    test("returns events ordered by created_at ascending", () => {
      coreDb
        .query("INSERT INTO event_log (event_name, feature_id, payload, created_at) VALUES (?, ?, ?, ?)")
        .run("pomodoro:session-ended", "pomodoro", null, "2026-04-25T15:00:00.000Z");
      coreDb
        .query("INSERT INTO event_log (event_name, feature_id, payload, created_at) VALUES (?, ?, ?, ?)")
        .run("todo:item-completed", "todo", null, "2026-04-25T10:00:00.000Z");

      const result = getTimelineEvents(coreDb, "2026-04-25");
      expect(result[0]?.eventName).toBe("todo:item-completed");
      expect(result[1]?.eventName).toBe("pomodoro:session-ended");
    });

    test("parses payload as JSON", () => {
      coreDb
        .query("INSERT INTO event_log (event_name, feature_id, payload, created_at) VALUES (?, ?, ?, ?)")
        .run(
          "todo:item-completed",
          "todo",
          JSON.stringify({ id: "t1", title: "Buy milk" }),
          "2026-04-25T10:00:00.000Z",
        );

      const result = getTimelineEvents(coreDb, "2026-04-25");
      expect(result[0]?.payload).toEqual({ id: "t1", title: "Buy milk" });
    });
  });
});
