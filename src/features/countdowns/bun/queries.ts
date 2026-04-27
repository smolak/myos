import type { Database } from "bun:sqlite";
import type { CountdownsQueries, CountdownWithTimeLeft } from "../shared/types";

interface CountdownRow {
  readonly id: string;
  readonly name: string;
  readonly target_date: string;
  readonly archived_at: string | null;
  readonly reached_notified_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export function calcTimeLeft(
  targetDate: string,
  now: Date = new Date(),
): Pick<CountdownWithTimeLeft, "isReached" | "daysRemaining" | "hoursRemaining" | "minutesRemaining"> {
  const diff = new Date(targetDate).getTime() - now.getTime();
  if (diff <= 0) return { isReached: true, daysRemaining: 0, hoursRemaining: 0, minutesRemaining: 0 };

  const totalMinutes = Math.floor(diff / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  return { isReached: false, daysRemaining: days, hoursRemaining: hours, minutesRemaining: minutes };
}

function rowToCountdown(row: CountdownRow): CountdownWithTimeLeft {
  const timeLeft = calcTimeLeft(row.target_date);
  return {
    id: row.id,
    name: row.name,
    targetDate: row.target_date,
    archivedAt: row.archived_at,
    reachedNotifiedAt: row.reached_notified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...timeLeft,
  };
}

export async function getAllCountdowns(
  db: Database,
  params: CountdownsQueries["get-all"]["params"],
): Promise<CountdownsQueries["get-all"]["result"]> {
  const sql = params.includeArchived
    ? "SELECT id, name, target_date, archived_at, reached_notified_at, created_at, updated_at FROM countdowns ORDER BY target_date ASC"
    : "SELECT id, name, target_date, archived_at, reached_notified_at, created_at, updated_at FROM countdowns WHERE archived_at IS NULL ORDER BY target_date ASC";
  const rows = db.query<CountdownRow, []>(sql).all();
  return rows.map(rowToCountdown);
}

export async function getCountdownById(
  db: Database,
  params: CountdownsQueries["get-by-id"]["params"],
): Promise<CountdownsQueries["get-by-id"]["result"]> {
  const row = db
    .query<CountdownRow, [string]>(
      "SELECT id, name, target_date, archived_at, reached_notified_at, created_at, updated_at FROM countdowns WHERE id = ?",
    )
    .get(params.id);
  if (!row) return null;
  return rowToCountdown(row);
}
