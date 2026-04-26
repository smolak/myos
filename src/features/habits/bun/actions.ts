import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { HabitsActions } from "../shared/types";

type CreateParams = HabitsActions["create"]["params"];
type DeleteParams = HabitsActions["delete"]["params"];
type CompleteParams = HabitsActions["complete"]["params"];
type UncompleteParams = HabitsActions["uncomplete"]["params"];

export async function createHabit(db: Database, params: CreateParams): Promise<{ id: string }> {
  const id = nanoid();
  const now = new Date().toISOString();
  db.query(
    `INSERT INTO habits (id, name, description, frequency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, params.name, params.description ?? null, params.frequency ?? "daily", now, now);
  return { id };
}

export async function deleteHabit(db: Database, params: DeleteParams): Promise<{ success: boolean }> {
  db.query("DELETE FROM habits WHERE id = ?").run(params.id);
  return { success: true };
}

export async function completeHabit(db: Database, params: CompleteParams): Promise<{ success: boolean }> {
  const habit = db.query<{ id: string }, [string]>("SELECT id FROM habits WHERE id = ?").get(params.id);
  if (!habit) return { success: false };

  const id = nanoid();
  const now = new Date().toISOString();
  db.query(
    `INSERT INTO habit_completions (id, habit_id, date, completed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO NOTHING`,
  ).run(id, params.id, params.date, now);
  return { success: true };
}

export async function uncompleteHabit(db: Database, params: UncompleteParams): Promise<{ success: boolean }> {
  db.query("DELETE FROM habit_completions WHERE habit_id = ? AND date = ?").run(params.id, params.date);
  return { success: true };
}
