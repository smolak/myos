import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { completeHabit, createHabit } from "./actions";
import { habitsMigrations } from "./migrations";
import { calcCurrentStreak, calcLongestStreak, getAllHabits, getHabitById, getHabitHistory } from "./queries";

describe("Streak calculations", () => {
  describe("calcCurrentStreak", () => {
    test("returns 0 when no completions", () => {
      expect(calcCurrentStreak([], "2025-01-10")).toBe(0);
    });

    test("returns 1 when only today is completed", () => {
      expect(calcCurrentStreak(["2025-01-10"], "2025-01-10")).toBe(1);
    });

    test("counts consecutive days ending today", () => {
      const dates = ["2025-01-08", "2025-01-09", "2025-01-10"];
      expect(calcCurrentStreak(dates, "2025-01-10")).toBe(3);
    });

    test("counts consecutive days ending yesterday when today not completed", () => {
      const dates = ["2025-01-07", "2025-01-08", "2025-01-09"];
      expect(calcCurrentStreak(dates, "2025-01-10")).toBe(3);
    });

    test("returns 0 when streak broken before yesterday", () => {
      const dates = ["2025-01-07", "2025-01-08"];
      expect(calcCurrentStreak(dates, "2025-01-10")).toBe(0);
    });

    test("ignores old non-consecutive completions", () => {
      const dates = ["2025-01-01", "2025-01-09", "2025-01-10"];
      expect(calcCurrentStreak(dates, "2025-01-10")).toBe(2);
    });
  });

  describe("calcLongestStreak", () => {
    test("returns 0 when no completions", () => {
      expect(calcLongestStreak([])).toBe(0);
    });

    test("returns 1 for a single completion", () => {
      expect(calcLongestStreak(["2025-01-10"])).toBe(1);
    });

    test("counts the longest run", () => {
      const dates = ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-07", "2025-01-08"];
      expect(calcLongestStreak(dates)).toBe(3);
    });

    test("handles unsorted input", () => {
      const dates = ["2025-01-03", "2025-01-01", "2025-01-02"];
      expect(calcLongestStreak(dates)).toBe(3);
    });

    test("returns 1 when all completions are isolated", () => {
      const dates = ["2025-01-01", "2025-01-03", "2025-01-05"];
      expect(calcLongestStreak(dates)).toBe(1);
    });
  });
});

describe("Habits queries", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-habits-queries-"));
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

  describe("getAllHabits", () => {
    test("returns empty array when no habits", async () => {
      const result = await getAllHabits(db, {});
      expect(result).toEqual([]);
    });

    test("returns all habits with stats", async () => {
      await createHabit(db, { name: "Run" });
      await createHabit(db, { name: "Read" });
      const result = await getAllHabits(db, {});
      expect(result).toHaveLength(2);
    });

    test("includes completedToday=false when not completed", async () => {
      const today = new Date().toISOString().split("T")[0]!;
      await createHabit(db, { name: "Run" });
      const result = await getAllHabits(db, { date: today });
      expect(result[0]?.completedToday).toBe(false);
    });

    test("includes completedToday=true when completed on given date", async () => {
      const today = "2025-01-10";
      const { id } = await createHabit(db, { name: "Run" });
      await completeHabit(db, { id, date: today });
      const result = await getAllHabits(db, { date: today });
      expect(result[0]?.completedToday).toBe(true);
    });

    test("includes streak data", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      await completeHabit(db, { id, date: "2025-01-08" });
      await completeHabit(db, { id, date: "2025-01-09" });
      await completeHabit(db, { id, date: "2025-01-10" });
      const result = await getAllHabits(db, { date: "2025-01-10" });
      expect(result[0]?.currentStreak).toBe(3);
      expect(result[0]?.longestStreak).toBe(3);
    });
  });

  describe("getHabitById", () => {
    test("returns null for non-existent id", async () => {
      const result = await getHabitById(db, { id: "ghost" });
      expect(result).toBeNull();
    });

    test("returns the habit with stats", async () => {
      const { id } = await createHabit(db, { name: "Meditate" });
      const result = await getHabitById(db, { id });
      expect(result?.id).toBe(id);
      expect(result?.name).toBe("Meditate");
      expect(result?.currentStreak).toBe(0);
    });
  });

  describe("getHabitHistory", () => {
    test("returns empty array for habit with no completions", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      const result = await getHabitHistory(db, { id });
      expect(result).toEqual([]);
    });

    test("returns all completions for the habit", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      await completeHabit(db, { id, date: "2025-01-01" });
      await completeHabit(db, { id, date: "2025-01-02" });
      const result = await getHabitHistory(db, { id });
      expect(result).toHaveLength(2);
    });

    test("completions include correct fields", async () => {
      const { id } = await createHabit(db, { name: "Run" });
      await completeHabit(db, { id, date: "2025-01-01" });
      const result = await getHabitHistory(db, { id });
      expect(result[0]?.habitId).toBe(id);
      expect(result[0]?.date).toBe("2025-01-01");
      expect(typeof result[0]?.completedAt).toBe("string");
    });
  });
});
