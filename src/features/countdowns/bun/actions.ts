import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { CountdownsActions } from "../shared/types";

type CreateParams = CountdownsActions["create"]["params"];
type DeleteParams = CountdownsActions["delete"]["params"];
type ArchiveParams = CountdownsActions["archive"]["params"];

export async function createCountdown(db: Database, params: CreateParams): Promise<{ id: string }> {
  const id = nanoid();
  const now = new Date().toISOString();
  db.query(
    `INSERT INTO countdowns (id, name, target_date, archived_at, reached_notified_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
  ).run(id, params.name, params.targetDate, now, now);
  return { id };
}

export async function deleteCountdown(db: Database, params: DeleteParams): Promise<{ success: boolean }> {
  db.query("DELETE FROM countdowns WHERE id = ?").run(params.id);
  return { success: true };
}

export async function archiveCountdown(db: Database, params: ArchiveParams): Promise<{ success: boolean }> {
  const row = db.query<{ id: string }, [string]>("SELECT id FROM countdowns WHERE id = ?").get(params.id);
  if (!row) return { success: false };
  const now = new Date().toISOString();
  db.query("UPDATE countdowns SET archived_at = ?, updated_at = ? WHERE id = ?").run(now, now, params.id);
  return { success: true };
}
