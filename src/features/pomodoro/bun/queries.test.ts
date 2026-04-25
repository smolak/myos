import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { cancelSession, completeSession, pauseSession, startSession } from "./actions";
import { pomodoroMigrations } from "./migrations";
import { getCurrentSession, getSessionHistory } from "./queries";

describe("Pomodoro queries", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-pomodoro-queries-"));
    db = new Database(join(tmpDir, "pomodoro.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "pomodoro", pomodoroMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getCurrentSession", () => {
    test("returns null when no sessions exist", async () => {
      const result = await getCurrentSession(db, {} as Record<string, never>);
      expect(result).toBeNull();
    });

    test("returns the running session", async () => {
      const { id } = await startSession(db, { type: "work", durationSeconds: 1500 });
      const session = await getCurrentSession(db, {} as Record<string, never>);
      expect(session).not.toBeNull();
      expect(session?.id).toBe(id);
      expect(session?.status).toBe("running");
      expect(session?.type).toBe("work");
      expect(session?.durationSeconds).toBe(1500);
    });

    test("returns the paused session", async () => {
      const { id } = await startSession(db, {});
      await pauseSession(db, { id, elapsedSeconds: 300 });
      const session = await getCurrentSession(db, {} as Record<string, never>);
      expect(session).not.toBeNull();
      expect(session?.id).toBe(id);
      expect(session?.status).toBe("paused");
      expect(session?.elapsedSeconds).toBe(300);
    });

    test("returns null after session is completed", async () => {
      const { id } = await startSession(db, {});
      await completeSession(db, { id });
      const session = await getCurrentSession(db, {} as Record<string, never>);
      expect(session).toBeNull();
    });

    test("returns null after session is cancelled", async () => {
      const { id } = await startSession(db, {});
      await cancelSession(db, { id });
      const session = await getCurrentSession(db, {} as Record<string, never>);
      expect(session).toBeNull();
    });

    test("maps all fields correctly", async () => {
      const { id } = await startSession(db, { type: "break", durationSeconds: 300 });
      const session = await getCurrentSession(db, {} as Record<string, never>);
      expect(session?.id).toBe(id);
      expect(session?.type).toBe("break");
      expect(session?.durationSeconds).toBe(300);
      expect(session?.elapsedSeconds).toBe(0);
      expect(session?.status).toBe("running");
      expect(session?.endedAt).toBeNull();
      expect(typeof session?.startedAt).toBe("string");
      expect(typeof session?.createdAt).toBe("string");
      expect(typeof session?.updatedAt).toBe("string");
    });
  });

  describe("getSessionHistory", () => {
    test("returns empty array when no completed sessions", async () => {
      const result = await getSessionHistory(db, {});
      expect(result).toEqual([]);
    });

    test("returns only completed sessions", async () => {
      const { id: a } = await startSession(db, {});
      await completeSession(db, { id: a });
      const { id: b } = await startSession(db, {});
      await cancelSession(db, { id: b });
      await startSession(db, {});

      const history = await getSessionHistory(db, {});
      expect(history).toHaveLength(1);
      expect(history[0]?.id).toBe(a);
      expect(history[0]?.status).toBe("completed");
    });

    test("orders by most recent first", async () => {
      const { id: first } = await startSession(db, { type: "work" });
      await completeSession(db, { id: first });
      await new Promise((r) => setTimeout(r, 5));
      const { id: second } = await startSession(db, { type: "break" });
      await completeSession(db, { id: second });

      const history = await getSessionHistory(db, {});
      expect(history[0]?.id).toBe(second);
      expect(history[1]?.id).toBe(first);
    });

    test("respects limit", async () => {
      for (let i = 0; i < 5; i++) {
        const { id } = await startSession(db, {});
        await completeSession(db, { id });
      }
      const history = await getSessionHistory(db, { limit: 3 });
      expect(history).toHaveLength(3);
    });

    test("maps all fields correctly", async () => {
      const { id } = await startSession(db, { type: "work", durationSeconds: 1500 });
      await completeSession(db, { id, elapsedSeconds: 1500 });

      const history = await getSessionHistory(db, {});
      const session = history[0]!;
      expect(session.id).toBe(id);
      expect(session.type).toBe("work");
      expect(session.durationSeconds).toBe(1500);
      expect(session.elapsedSeconds).toBe(1500);
      expect(session.status).toBe("completed");
      expect(session.endedAt).not.toBeNull();
    });
  });
});
