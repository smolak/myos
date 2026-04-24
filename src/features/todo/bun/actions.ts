import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { TodoActions } from "../shared/types";

type CreateParams = TodoActions["create"]["params"];
type UpdateParams = TodoActions["update"]["params"];
type CompleteParams = TodoActions["complete"]["params"];
type DeleteParams = TodoActions["delete"]["params"];

export async function createTodo(db: Database, params: CreateParams): Promise<TodoActions["create"]["result"]> {
  const id = nanoid();
  const now = new Date().toISOString();
  db.query(
    `INSERT INTO todos (id, title, description, completed, completed_at, created_at, updated_at)
		 VALUES (?, ?, ?, 0, NULL, ?, ?)`,
  ).run(id, params.title, params.description ?? null, now, now);
  return { id };
}

export async function updateTodo(db: Database, params: UpdateParams): Promise<TodoActions["update"]["result"]> {
  const row = db
    .query<{ title: string; description: string | null }, [string]>("SELECT title, description FROM todos WHERE id = ?")
    .get(params.id);
  if (!row) return { success: false };

  const now = new Date().toISOString();
  db.query("UPDATE todos SET title = ?, description = ?, updated_at = ? WHERE id = ?").run(
    params.title ?? row.title,
    params.description !== undefined ? params.description : row.description,
    now,
    params.id,
  );
  return { success: true };
}

export async function completeTodo(db: Database, params: CompleteParams): Promise<TodoActions["complete"]["result"]> {
  const row = db.query<{ id: string }, [string]>("SELECT id FROM todos WHERE id = ?").get(params.id);
  if (!row) return { success: false };

  const now = new Date().toISOString();
  db.query("UPDATE todos SET completed = 1, completed_at = ?, updated_at = ? WHERE id = ?").run(now, now, params.id);
  return { success: true };
}

export async function deleteTodo(db: Database, params: DeleteParams): Promise<TodoActions["delete"]["result"]> {
  db.query("DELETE FROM todos WHERE id = ?").run(params.id);
  return { success: true };
}
