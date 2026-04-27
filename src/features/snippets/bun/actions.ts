import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { SnippetsActions } from "../shared/types";

type CreateParams = SnippetsActions["create"]["params"];
type UpdateParams = SnippetsActions["update"]["params"];
type DeleteParams = SnippetsActions["delete"]["params"];

export async function createSnippet(db: Database, params: CreateParams): Promise<{ id: string }> {
  const id = nanoid();
  const now = new Date().toISOString();
  db.query(
    `INSERT INTO snippets (id, name, template, is_favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, params.name, params.template, params.isFavorite ? 1 : 0, now, now);
  return { id };
}

export async function updateSnippet(db: Database, params: UpdateParams): Promise<{ success: boolean }> {
  const row = db.query<{ id: string }, [string]>("SELECT id FROM snippets WHERE id = ?").get(params.id);
  if (!row) return { success: false };

  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (params.name !== undefined) {
    sets.push("name = ?");
    values.push(params.name);
  }
  if (params.template !== undefined) {
    sets.push("template = ?");
    values.push(params.template);
  }
  if (params.isFavorite !== undefined) {
    sets.push("is_favorite = ?");
    values.push(params.isFavorite ? 1 : 0);
  }

  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(params.id);

  db.query(`UPDATE snippets SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return { success: true };
}

export async function deleteSnippet(db: Database, params: DeleteParams): Promise<{ success: boolean }> {
  db.query("DELETE FROM snippets WHERE id = ?").run(params.id);
  return { success: true };
}
