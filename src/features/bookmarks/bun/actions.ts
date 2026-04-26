import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { BookmarksActions } from "../shared/types";

type CreateParams = BookmarksActions["create"]["params"];
type UpdateParams = BookmarksActions["update"]["params"];
type DeleteParams = BookmarksActions["delete"]["params"];

export async function createBookmark(db: Database, params: CreateParams): Promise<{ id: string }> {
  const id = nanoid();
  const now = new Date().toISOString();
  const tags = JSON.stringify(params.tags ?? []);
  db.query(
    `INSERT INTO bookmarks (id, title, url, description, folder, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, params.title, params.url, params.description ?? null, params.folder ?? null, tags, now, now);
  return { id };
}

export async function updateBookmark(db: Database, params: UpdateParams): Promise<{ success: boolean }> {
  const now = new Date().toISOString();
  const existing = db
    .query<
      { id: string; title: string; url: string; description: string | null; folder: string | null; tags: string },
      [string]
    >("SELECT id, title, url, description, folder, tags FROM bookmarks WHERE id = ?")
    .get(params.id);
  if (!existing) return { success: false };

  const title = params.title ?? existing.title;
  const url = params.url ?? existing.url;
  const description = params.description !== undefined ? (params.description ?? null) : existing.description;
  const folder = params.folder !== undefined ? (params.folder ?? null) : existing.folder;
  const tags = params.tags !== undefined ? JSON.stringify(params.tags) : existing.tags;

  db.query(
    `UPDATE bookmarks SET title = ?, url = ?, description = ?, folder = ?, tags = ?, updated_at = ? WHERE id = ?`,
  ).run(title, url, description, folder, tags, now, params.id);
  return { success: true };
}

export async function deleteBookmark(db: Database, params: DeleteParams): Promise<{ success: boolean }> {
  db.query("DELETE FROM bookmarks WHERE id = ?").run(params.id);
  return { success: true };
}
