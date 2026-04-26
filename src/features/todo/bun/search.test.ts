import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { completeTodo, createTodo } from "./actions";
import { todoMigrations } from "./migrations";
import { searchTodos } from "./search";

describe("searchTodos", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-todo-search-"));
    db = new Database(join(tmpDir, "todo.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "todo", todoMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns empty array when no todos exist", async () => {
    const result = await searchTodos(db, { query: "milk" });
    expect(result).toEqual([]);
  });

  test("returns empty array when query is empty", async () => {
    await createTodo(db, { title: "Buy milk" });
    const result = await searchTodos(db, { query: "" });
    expect(result).toEqual([]);
  });

  test("matches todo by title", async () => {
    await createTodo(db, { title: "Buy milk" });
    const result = await searchTodos(db, { query: "milk" });
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Buy milk");
  });

  test("matches todo by description", async () => {
    await createTodo(db, { title: "Groceries", description: "get oat milk" });
    const result = await searchTodos(db, { query: "oat" });
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Groceries");
  });

  test("is case-insensitive", async () => {
    await createTodo(db, { title: "Buy Milk" });
    const result = await searchTodos(db, { query: "milk" });
    expect(result).toHaveLength(1);
  });

  test("does not match unrelated todos", async () => {
    await createTodo(db, { title: "Write tests" });
    const result = await searchTodos(db, { query: "milk" });
    expect(result).toEqual([]);
  });

  test("result has correct shape", async () => {
    const { id } = await createTodo(db, { title: "Buy milk" });
    const result = await searchTodos(db, { query: "milk" });
    expect(result[0]).toMatchObject({
      itemId: id,
      title: "Buy milk",
      type: "todo",
    });
  });

  test("subtitle includes description when present", async () => {
    await createTodo(db, { title: "Groceries", description: "oat milk, eggs" });
    const result = await searchTodos(db, { query: "groceries" });
    expect(result[0]?.subtitle).toBe("oat milk, eggs");
  });

  test("completed todos appear with subtitle indicating completion", async () => {
    const { id } = await createTodo(db, { title: "Done task" });
    await completeTodo(db, { id });
    const result = await searchTodos(db, { query: "done" });
    expect(result).toHaveLength(1);
    expect(result[0]?.subtitle).toContain("Completed");
  });

  test("limits results to 10", async () => {
    for (let i = 0; i < 15; i++) {
      await createTodo(db, { title: `Task ${i}` });
    }
    const result = await searchTodos(db, { query: "task" });
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
