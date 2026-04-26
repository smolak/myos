import type { Database } from "bun:sqlite";
import type { HabitCompletion, HabitsQueries, HabitWithStats } from "../shared/types";

interface HabitRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly frequency: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface CompletionRow {
  readonly id: string;
  readonly habit_id: string;
  readonly date: string;
  readonly completed_at: string;
}

export function calcCurrentStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0;

  const set = new Set(dates);
  const todayMs = new Date(today).getTime();
  const startMs = set.has(today) ? todayMs : todayMs - 86400000;

  let streak = 0;
  let checkMs = startMs;
  while (true) {
    const checkStr = new Date(checkMs).toISOString().slice(0, 10);
    if (set.has(checkStr)) {
      streak++;
      checkMs -= 86400000;
    } else {
      break;
    }
  }
  return streak;
}

export function calcLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = sorted[i - 1];
    const currDate = sorted[i];
    if (prevDate === undefined || currDate === undefined) continue;
    const prev = new Date(prevDate).getTime();
    const curr = new Date(currDate).getTime();
    if (curr - prev === 86400000) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

function buildHabitWithStats(db: Database, row: HabitRow, date: string): HabitWithStats {
  const completionDates = db
    .query<{ date: string }, [string]>("SELECT date FROM habit_completions WHERE habit_id = ?")
    .all(row.id)
    .map((r) => r.date);

  const completedToday =
    db
      .query<{ id: string }, [string, string]>("SELECT id FROM habit_completions WHERE habit_id = ? AND date = ?")
      .get(row.id, date) !== null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    frequency: row.frequency as "daily" | "weekly",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedToday,
    currentStreak: calcCurrentStreak(completionDates, date),
    longestStreak: calcLongestStreak(completionDates),
  };
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getAllHabits(
  db: Database,
  params: HabitsQueries["get-all"]["params"],
): Promise<HabitsQueries["get-all"]["result"]> {
  const date = params.date ?? todayString();
  const rows = db
    .query<HabitRow, []>(
      "SELECT id, name, description, frequency, created_at, updated_at FROM habits ORDER BY created_at ASC",
    )
    .all();
  return rows.map((row) => buildHabitWithStats(db, row, date));
}

export async function getHabitById(
  db: Database,
  params: HabitsQueries["get-by-id"]["params"],
): Promise<HabitsQueries["get-by-id"]["result"]> {
  const date = params.date ?? todayString();
  const row = db
    .query<HabitRow, [string]>(
      "SELECT id, name, description, frequency, created_at, updated_at FROM habits WHERE id = ?",
    )
    .get(params.id);
  if (!row) return null;
  return buildHabitWithStats(db, row, date);
}

export async function getHabitHistory(
  db: Database,
  params: HabitsQueries["get-history"]["params"],
): Promise<HabitsQueries["get-history"]["result"]> {
  const rows = db
    .query<CompletionRow, [string]>(
      "SELECT id, habit_id, date, completed_at FROM habit_completions WHERE habit_id = ? ORDER BY date DESC",
    )
    .all(params.id);
  return rows.map(
    (r): HabitCompletion => ({
      id: r.id,
      habitId: r.habit_id,
      date: r.date,
      completedAt: r.completed_at,
    }),
  );
}
