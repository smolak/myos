import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { cancelSession, completeSession, pauseSession, resumeSession, startSession } from "./actions";
import { pomodoroMigrations } from "./migrations";

describe("Pomodoro actions", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-pomodoro-actions-"));
    db = new Database(join(tmpDir, "pomodoro.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "pomodoro", pomodoroMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("startSession", () => {
    test("returns a generated id", async () => {
      const result = await startSession(db, {});
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
    });

    test("defaults type to 'work'", async () => {
      const { id } = await startSession(db, {});
      const row = db.query<{ type: string }, [string]>("SELECT type FROM pomodoro_sessions WHERE id = ?").get(id);
      expect(row?.type).toBe("work");
    });

    test("stores explicit type 'break'", async () => {
      const { id } = await startSession(db, { type: "break" });
      const row = db.query<{ type: string }, [string]>("SELECT type FROM pomodoro_sessions WHERE id = ?").get(id);
      expect(row?.type).toBe("break");
    });

    test("defaults work duration to 25 minutes", async () => {
      const { id } = await startSession(db, { type: "work" });
      const row = db
        .query<{ duration_seconds: number }, [string]>("SELECT duration_seconds FROM pomodoro_sessions WHERE id = ?")
        .get(id);
      expect(row?.duration_seconds).toBe(25 * 60);
    });

    test("defaults break duration to 5 minutes", async () => {
      const { id } = await startSession(db, { type: "break" });
      const row = db
        .query<{ duration_seconds: number }, [string]>("SELECT duration_seconds FROM pomodoro_sessions WHERE id = ?")
        .get(id);
      expect(row?.duration_seconds).toBe(5 * 60);
    });

    test("respects explicit durationSeconds", async () => {
      const { id } = await startSession(db, { type: "work", durationSeconds: 1800 });
      const row = db
        .query<{ duration_seconds: number }, [string]>("SELECT duration_seconds FROM pomodoro_sessions WHERE id = ?")
        .get(id);
      expect(row?.duration_seconds).toBe(1800);
    });

    test("sets status to 'running' and elapsed_seconds to 0", async () => {
      const { id } = await startSession(db, {});
      const row = db
        .query<{ status: string; elapsed_seconds: number }, [string]>(
          "SELECT status, elapsed_seconds FROM pomodoro_sessions WHERE id = ?",
        )
        .get(id);
      expect(row?.status).toBe("running");
      expect(row?.elapsed_seconds).toBe(0);
    });

    test("cancels any existing running session before starting new one", async () => {
      const { id: first } = await startSession(db, {});
      await startSession(db, {});
      const row = db
        .query<{ status: string }, [string]>("SELECT status FROM pomodoro_sessions WHERE id = ?")
        .get(first);
      expect(row?.status).toBe("cancelled");
    });

    test("cancels any existing paused session before starting new one", async () => {
      const { id: first } = await startSession(db, {});
      await pauseSession(db, { id: first, elapsedSeconds: 60 });
      await startSession(db, {});
      const row = db
        .query<{ status: string }, [string]>("SELECT status FROM pomodoro_sessions WHERE id = ?")
        .get(first);
      expect(row?.status).toBe("cancelled");
    });

    test("two starts produce different ids", async () => {
      const first = await startSession(db, {});
      const second = await startSession(db, {});
      expect(first.id).not.toBe(second.id);
    });
  });

  describe("pauseSession", () => {
    test("transitions running session to paused", async () => {
      const { id } = await startSession(db, {});
      const result = await pauseSession(db, { id, elapsedSeconds: 120 });
      expect(result.success).toBe(true);
      const row = db
        .query<{ status: string; elapsed_seconds: number }, [string]>(
          "SELECT status, elapsed_seconds FROM pomodoro_sessions WHERE id = ?",
        )
        .get(id);
      expect(row?.status).toBe("paused");
      expect(row?.elapsed_seconds).toBe(120);
    });

    test("returns success=false for non-existent id", async () => {
      const result = await pauseSession(db, { id: "ghost", elapsedSeconds: 0 });
      expect(result.success).toBe(false);
    });

    test("returns success=false when session is not running", async () => {
      const { id } = await startSession(db, {});
      await completeSession(db, { id });
      const result = await pauseSession(db, { id, elapsedSeconds: 100 });
      expect(result.success).toBe(false);
    });

    test("is idempotent on elapsed_seconds — pausing twice preserves last value", async () => {
      const { id } = await startSession(db, {});
      await pauseSession(db, { id, elapsedSeconds: 60 });
      await resumeSession(db, { id });
      await pauseSession(db, { id, elapsedSeconds: 90 });
      const row = db
        .query<{ elapsed_seconds: number }, [string]>("SELECT elapsed_seconds FROM pomodoro_sessions WHERE id = ?")
        .get(id);
      expect(row?.elapsed_seconds).toBe(90);
    });
  });

  describe("resumeSession", () => {
    test("transitions paused session back to running", async () => {
      const { id } = await startSession(db, {});
      await pauseSession(db, { id, elapsedSeconds: 60 });
      const result = await resumeSession(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ status: string }, [string]>("SELECT status FROM pomodoro_sessions WHERE id = ?").get(id);
      expect(row?.status).toBe("running");
    });

    test("returns success=false for non-existent id", async () => {
      const result = await resumeSession(db, { id: "ghost" });
      expect(result.success).toBe(false);
    });

    test("returns success=false when session is not paused", async () => {
      const { id } = await startSession(db, {});
      const result = await resumeSession(db, { id });
      expect(result.success).toBe(false);
    });
  });

  describe("completeSession", () => {
    test("transitions running session to completed", async () => {
      const { id } = await startSession(db, {});
      const result = await completeSession(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ status: string }, [string]>("SELECT status FROM pomodoro_sessions WHERE id = ?").get(id);
      expect(row?.status).toBe("completed");
    });

    test("sets ended_at to a valid ISO timestamp", async () => {
      const before = new Date().toISOString();
      const { id } = await startSession(db, {});
      await completeSession(db, { id });
      const after = new Date().toISOString();
      const row = db
        .query<{ ended_at: string | null }, [string]>("SELECT ended_at FROM pomodoro_sessions WHERE id = ?")
        .get(id);
      expect(row?.ended_at).not.toBeNull();
      expect(row!.ended_at! >= before).toBe(true);
      expect(row!.ended_at! <= after).toBe(true);
    });

    test("stores elapsedSeconds when provided", async () => {
      const { id } = await startSession(db, {});
      await completeSession(db, { id, elapsedSeconds: 1500 });
      const row = db
        .query<{ elapsed_seconds: number }, [string]>("SELECT elapsed_seconds FROM pomodoro_sessions WHERE id = ?")
        .get(id);
      expect(row?.elapsed_seconds).toBe(1500);
    });

    test("is idempotent — completing an already completed session succeeds", async () => {
      const { id } = await startSession(db, {});
      await completeSession(db, { id });
      const result = await completeSession(db, { id });
      expect(result.success).toBe(true);
    });

    test("returns success=false for non-existent id", async () => {
      const result = await completeSession(db, { id: "ghost" });
      expect(result.success).toBe(false);
    });

    test("returns success=false for cancelled session", async () => {
      const { id } = await startSession(db, {});
      await cancelSession(db, { id });
      const result = await completeSession(db, { id });
      expect(result.success).toBe(false);
    });

    test("transitions paused session to completed", async () => {
      const { id } = await startSession(db, {});
      await pauseSession(db, { id, elapsedSeconds: 300 });
      const result = await completeSession(db, { id });
      expect(result.success).toBe(true);
    });
  });

  describe("cancelSession", () => {
    test("transitions running session to cancelled", async () => {
      const { id } = await startSession(db, {});
      const result = await cancelSession(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ status: string }, [string]>("SELECT status FROM pomodoro_sessions WHERE id = ?").get(id);
      expect(row?.status).toBe("cancelled");
    });

    test("is idempotent — cancelling an already cancelled session succeeds", async () => {
      const { id } = await startSession(db, {});
      await cancelSession(db, { id });
      const result = await cancelSession(db, { id });
      expect(result.success).toBe(true);
    });

    test("returns success=false for non-existent id", async () => {
      const result = await cancelSession(db, { id: "ghost" });
      expect(result.success).toBe(false);
    });

    test("returns success=false for completed session", async () => {
      const { id } = await startSession(db, {});
      await completeSession(db, { id });
      const result = await cancelSession(db, { id });
      expect(result.success).toBe(false);
    });

    test("sets ended_at when cancelling", async () => {
      const before = new Date().toISOString();
      const { id } = await startSession(db, {});
      await cancelSession(db, { id });
      const after = new Date().toISOString();
      const row = db
        .query<{ ended_at: string | null }, [string]>("SELECT ended_at FROM pomodoro_sessions WHERE id = ?")
        .get(id);
      expect(row?.ended_at).not.toBeNull();
      expect(row!.ended_at! >= before).toBe(true);
      expect(row!.ended_at! <= after).toBe(true);
    });
  });
});
