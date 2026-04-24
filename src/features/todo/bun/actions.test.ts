import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { todoMigrations } from "./migrations";
import { createTodo, updateTodo, completeTodo, deleteTodo } from "./actions";

describe("Todo actions", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-todo-actions-"));
    db = new Database(join(tmpDir, "todo.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "todo", todoMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("createTodo", () => {
    test("returns a generated id", async () => {
      const result = await createTodo(db, { title: "Buy milk" });
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
    });

    test("persists title and completed=0 in DB", async () => {
      const { id } = await createTodo(db, { title: "Buy milk" });
      const row = db
        .query<{ title: string; completed: number }, [string]>("SELECT title, completed FROM todos WHERE id = ?")
        .get(id);
      expect(row?.title).toBe("Buy milk");
      expect(row?.completed).toBe(0);
    });

    test("saves optional description", async () => {
      const { id } = await createTodo(db, { title: "Task", description: "Details here" });
      const row = db
        .query<{ description: string | null }, [string]>("SELECT description FROM todos WHERE id = ?")
        .get(id);
      expect(row?.description).toBe("Details here");
    });

    test("description defaults to null", async () => {
      const { id } = await createTodo(db, { title: "No desc" });
      const row = db
        .query<{ description: string | null }, [string]>("SELECT description FROM todos WHERE id = ?")
        .get(id);
      expect(row?.description).toBeNull();
    });

    test("sets created_at and updated_at to the same ISO timestamp", async () => {
      const before = new Date().toISOString();
      const { id } = await createTodo(db, { title: "Timed" });
      const after = new Date().toISOString();
      const row = db
        .query<{ created_at: string; updated_at: string }, [string]>(
          "SELECT created_at, updated_at FROM todos WHERE id = ?",
        )
        .get(id);
      expect(row!.created_at >= before).toBe(true);
      expect(row!.created_at <= after).toBe(true);
      expect(row!.updated_at).toBe(row!.created_at);
    });

    test("two creates produce different ids", async () => {
      const a = await createTodo(db, { title: "A" });
      const b = await createTodo(db, { title: "B" });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("updateTodo", () => {
    test("updates the title", async () => {
      const { id } = await createTodo(db, { title: "Old" });
      const result = await updateTodo(db, { id, title: "New" });
      expect(result.success).toBe(true);
      const row = db.query<{ title: string }, [string]>("SELECT title FROM todos WHERE id = ?").get(id);
      expect(row?.title).toBe("New");
    });

    test("updates the description", async () => {
      const { id } = await createTodo(db, { title: "Task" });
      await updateTodo(db, { id, description: "Added desc" });
      const row = db
        .query<{ description: string | null }, [string]>("SELECT description FROM todos WHERE id = ?")
        .get(id);
      expect(row?.description).toBe("Added desc");
    });

    test("bumps updated_at", async () => {
      const { id } = await createTodo(db, { title: "Task" });
      const before = db
        .query<{ updated_at: string }, [string]>("SELECT updated_at FROM todos WHERE id = ?")
        .get(id)!.updated_at;
      await new Promise((r) => setTimeout(r, 5));
      await updateTodo(db, { id, title: "New" });
      const after = db
        .query<{ updated_at: string }, [string]>("SELECT updated_at FROM todos WHERE id = ?")
        .get(id)!.updated_at;
      expect(after > before).toBe(true);
    });

    test("returns success=false for non-existent id", async () => {
      const result = await updateTodo(db, { id: "ghost", title: "x" });
      expect(result.success).toBe(false);
    });

    test("is idempotent — applying same update twice has same result", async () => {
      const { id } = await createTodo(db, { title: "Task" });
      await updateTodo(db, { id, title: "Final" });
      await updateTodo(db, { id, title: "Final" });
      const row = db.query<{ title: string }, [string]>("SELECT title FROM todos WHERE id = ?").get(id);
      expect(row?.title).toBe("Final");
    });
  });

  describe("completeTodo", () => {
    test("marks the todo as completed", async () => {
      const { id } = await createTodo(db, { title: "Task" });
      const result = await completeTodo(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ completed: number }, [string]>("SELECT completed FROM todos WHERE id = ?").get(id);
      expect(row?.completed).toBe(1);
    });

    test("sets completed_at to a valid ISO timestamp", async () => {
      const before = new Date().toISOString();
      const { id } = await createTodo(db, { title: "Task" });
      await completeTodo(db, { id });
      const after = new Date().toISOString();
      const row = db
        .query<{ completed_at: string | null }, [string]>("SELECT completed_at FROM todos WHERE id = ?")
        .get(id);
      expect(row!.completed_at).not.toBeNull();
      expect(row!.completed_at! >= before).toBe(true);
      expect(row!.completed_at! <= after).toBe(true);
    });

    test("is idempotent — completing an already completed todo succeeds", async () => {
      const { id } = await createTodo(db, { title: "Task" });
      await completeTodo(db, { id });
      const result = await completeTodo(db, { id });
      expect(result.success).toBe(true);
    });

    test("returns success=false for non-existent id", async () => {
      const result = await completeTodo(db, { id: "ghost" });
      expect(result.success).toBe(false);
    });
  });

  describe("deleteTodo", () => {
    test("removes the todo from the DB", async () => {
      const { id } = await createTodo(db, { title: "Task" });
      const result = await deleteTodo(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ id: string }, [string]>("SELECT id FROM todos WHERE id = ?").get(id);
      expect(row).toBeNull();
    });

    test("is idempotent — deleting a non-existent id succeeds", async () => {
      const result = await deleteTodo(db, { id: "ghost" });
      expect(result.success).toBe(true);
    });
  });
});
