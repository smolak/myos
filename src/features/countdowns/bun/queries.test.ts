import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { createCountdown } from "./actions";
import { countdownsMigrations } from "./migrations";
import { calcTimeLeft, getAllCountdowns, getCountdownById } from "./queries";

describe("calcTimeLeft", () => {
  test("returns isReached=true and zero time when target is in the past", () => {
    const now = new Date("2026-04-27T12:00:00Z");
    const result = calcTimeLeft("2026-04-20T00:00:00Z", now);
    expect(result.isReached).toBe(true);
    expect(result.daysRemaining).toBe(0);
    expect(result.hoursRemaining).toBe(0);
    expect(result.minutesRemaining).toBe(0);
  });

  test("returns isReached=false with correct days for a future date", () => {
    const now = new Date("2026-04-27T00:00:00Z");
    const result = calcTimeLeft("2026-05-07T00:00:00Z", now);
    expect(result.isReached).toBe(false);
    expect(result.daysRemaining).toBe(10);
    expect(result.hoursRemaining).toBe(0);
    expect(result.minutesRemaining).toBe(0);
  });

  test("returns correct hours when less than a day remains", () => {
    const now = new Date("2026-04-27T10:00:00Z");
    const result = calcTimeLeft("2026-04-27T22:30:00Z", now);
    expect(result.isReached).toBe(false);
    expect(result.daysRemaining).toBe(0);
    expect(result.hoursRemaining).toBe(12);
    expect(result.minutesRemaining).toBe(30);
  });

  test("returns correct minutes within the same hour", () => {
    const now = new Date("2026-04-27T10:00:00Z");
    const result = calcTimeLeft("2026-04-27T10:45:00Z", now);
    expect(result.isReached).toBe(false);
    expect(result.daysRemaining).toBe(0);
    expect(result.hoursRemaining).toBe(0);
    expect(result.minutesRemaining).toBe(45);
  });
});

describe("Countdowns queries", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-countdowns-queries-"));
    db = new Database(join(tmpDir, "countdowns.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "countdowns", countdownsMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getAllCountdowns", () => {
    test("returns empty array when no countdowns exist", async () => {
      const result = await getAllCountdowns(db, {});
      expect(result).toEqual([]);
    });

    test("returns active countdowns", async () => {
      await createCountdown(db, { name: "Launch", targetDate: "2027-06-15" });
      const result = await getAllCountdowns(db, {});
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Launch");
    });

    test("excludes archived countdowns by default", async () => {
      const { id } = await createCountdown(db, { name: "Old event", targetDate: "2027-01-01" });
      db.query("UPDATE countdowns SET archived_at = ? WHERE id = ?").run(new Date().toISOString(), id);
      const result = await getAllCountdowns(db, {});
      expect(result).toHaveLength(0);
    });

    test("includes archived when includeArchived=true", async () => {
      const { id } = await createCountdown(db, { name: "Old event", targetDate: "2027-01-01" });
      db.query("UPDATE countdowns SET archived_at = ? WHERE id = ?").run(new Date().toISOString(), id);
      const result = await getAllCountdowns(db, { includeArchived: true });
      expect(result).toHaveLength(1);
    });

    test("returns CountdownWithTimeLeft shape", async () => {
      await createCountdown(db, { name: "Test", targetDate: "2027-12-31" });
      const result = await getAllCountdowns(db, {});
      const item = result[0];
      expect(item).toBeDefined();
      expect(typeof item?.isReached).toBe("boolean");
      expect(typeof item?.daysRemaining).toBe("number");
      expect(typeof item?.hoursRemaining).toBe("number");
      expect(typeof item?.minutesRemaining).toBe("number");
    });
  });

  describe("getCountdownById", () => {
    test("returns null for non-existent id", async () => {
      const result = await getCountdownById(db, { id: "ghost" });
      expect(result).toBeNull();
    });

    test("returns the countdown with time left", async () => {
      const { id } = await createCountdown(db, { name: "Milestone", targetDate: "2027-01-01" });
      const result = await getCountdownById(db, { id });
      expect(result?.id).toBe(id);
      expect(result?.name).toBe("Milestone");
      expect(typeof result?.isReached).toBe("boolean");
    });
  });
});
