import type { Database } from "bun:sqlite";
import type { TodoItem, TodoQueries } from "../shared/types";

interface TodoRow {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly completed: number;
  readonly completed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

function rowToItem(row: TodoRow): TodoItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: row.completed === 1,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findTodos(
  db: Database,
  params: TodoQueries["find"]["params"],
): Promise<TodoQueries["find"]["result"]> {
  if (params.completed !== undefined && params.limit !== undefined) {
    return db
      .query<TodoRow, [number, number]>("SELECT * FROM todos WHERE completed = ? ORDER BY created_at DESC LIMIT ?")
      .all(params.completed ? 1 : 0, params.limit)
      .map(rowToItem);
  }
  if (params.completed !== undefined) {
    return db
      .query<TodoRow, [number]>("SELECT * FROM todos WHERE completed = ? ORDER BY created_at DESC")
      .all(params.completed ? 1 : 0)
      .map(rowToItem);
  }
  if (params.limit !== undefined) {
    return db
      .query<TodoRow, [number]>("SELECT * FROM todos ORDER BY created_at DESC LIMIT ?")
      .all(params.limit)
      .map(rowToItem);
  }
  return db.query<TodoRow, []>("SELECT * FROM todos ORDER BY created_at DESC").all().map(rowToItem);
}

export async function getTodoById(
  db: Database,
  params: TodoQueries["get-by-id"]["params"],
): Promise<TodoQueries["get-by-id"]["result"]> {
  const row = db.query<TodoRow, [string]>("SELECT * FROM todos WHERE id = ?").get(params.id);
  return row ? rowToItem(row) : null;
}
