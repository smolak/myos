import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { completeTodo, createTodo } from "./actions";
import { todoMigrations } from "./migrations";
import { findTodos, getTodoById } from "./queries";

describe("Todo queries", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-todo-queries-"));
    db = new Database(join(tmpDir, "todo.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "todo", todoMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("findTodos", () => {
    test("returns empty array when no todos exist", async () => {
      const result = await findTodos(db, {});
      expect(result).toEqual([]);
    });

    test("returns all todos when no filter is applied", async () => {
      await createTodo(db, { title: "Task 1" });
      await createTodo(db, { title: "Task 2" });
      const result = await findTodos(db, {});
      expect(result).toHaveLength(2);
    });

    test("filters to active todos with completed=false", async () => {
      const { id } = await createTodo(db, { title: "Done" });
      await createTodo(db, { title: "Active" });
      await completeTodo(db, { id });
      const result = await findTodos(db, { completed: false });
      expect(result).toHaveLength(1);
      expect(result[0]?.completed).toBe(false);
    });

    test("filters to completed todos with completed=true", async () => {
      const { id } = await createTodo(db, { title: "Done" });
      await createTodo(db, { title: "Active" });
      await completeTodo(db, { id });
      const result = await findTodos(db, { completed: true });
      expect(result).toHaveLength(1);
      expect(result[0]?.completed).toBe(true);
    });

    test("respects limit", async () => {
      await createTodo(db, { title: "T1" });
      await createTodo(db, { title: "T2" });
      await createTodo(db, { title: "T3" });
      const result = await findTodos(db, { limit: 2 });
      expect(result).toHaveLength(2);
    });

    test("returns todos with correct shape, mapping snake_case to camelCase", async () => {
      const { id } = await createTodo(db, { title: "Task", description: "Desc" });
      const [todo] = await findTodos(db, {});
      expect(todo).toMatchObject({
        id,
        title: "Task",
        description: "Desc",
        completed: false,
        completedAt: null,
      });
      expect(typeof todo?.createdAt).toBe("string");
      expect(typeof todo?.updatedAt).toBe("string");
    });

    test("returns completed boolean true for completed todos", async () => {
      const { id } = await createTodo(db, { title: "Task" });
      await completeTodo(db, { id });
      const [todo] = await findTodos(db, { completed: true });
      expect(todo?.completed).toBe(true);
      expect(todo?.completedAt).not.toBeNull();
    });
  });

  describe("getTodoById", () => {
    test("returns the todo for a known id", async () => {
      const { id } = await createTodo(db, { title: "Task" });
      const todo = await getTodoById(db, { id });
      expect(todo).not.toBeNull();
      expect(todo?.id).toBe(id);
      expect(todo?.title).toBe("Task");
    });

    test("returns null for an unknown id", async () => {
      const todo = await getTodoById(db, { id: "ghost" });
      expect(todo).toBeNull();
    });

    test("maps completed integer to boolean", async () => {
      const { id } = await createTodo(db, { title: "Task" });
      await completeTodo(db, { id });
      const todo = await getTodoById(db, { id });
      expect(todo?.completed).toBe(true);
    });
  });
});
