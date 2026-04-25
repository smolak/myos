import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { DailyJournalActions } from "../shared/types";

export async function addNote(
  db: Database,
  params: DailyJournalActions["add-note"]["params"],
): Promise<DailyJournalActions["add-note"]["result"]> {
  const id = nanoid();
  const now = new Date().toISOString();
  db.query("INSERT INTO journal_notes (id, date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    params.date,
    params.content,
    now,
    now,
  );
  return { id };
}

export async function updateNote(
  db: Database,
  params: DailyJournalActions["update-note"]["params"],
): Promise<DailyJournalActions["update-note"]["result"]> {
  const row = db.query<{ id: string }, [string]>("SELECT id FROM journal_notes WHERE id = ?").get(params.id);
  if (!row) return { success: false };
  const now = new Date().toISOString();
  db.query("UPDATE journal_notes SET content = ?, updated_at = ? WHERE id = ?").run(params.content, now, params.id);
  return { success: true };
}

export async function deleteNote(
  db: Database,
  params: DailyJournalActions["delete-note"]["params"],
): Promise<DailyJournalActions["delete-note"]["result"]> {
  db.query("DELETE FROM journal_notes WHERE id = ?").run(params.id);
  return { success: true };
}
