import type { Database } from "bun:sqlite";
import type { CalendarEvent, CalendarQueries, CalendarSource } from "../shared/types";

interface SourceRow {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly last_synced_at: string | null;
  readonly sync_interval_minutes: number;
  readonly created_at: string;
  readonly updated_at: string;
}

interface EventRow {
  readonly id: string;
  readonly source_id: string;
  readonly uid: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly start_time: string;
  readonly end_time: string | null;
  readonly is_all_day: number;
  readonly created_at: string;
  readonly updated_at: string;
}

function rowToSource(row: SourceRow): CalendarSource {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    lastSyncedAt: row.last_synced_at,
    syncIntervalMinutes: row.sync_interval_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    sourceId: row.source_id,
    uid: row.uid,
    title: row.title,
    description: row.description,
    location: row.location,
    startTime: row.start_time,
    endTime: row.end_time,
    isAllDay: row.is_all_day === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSources(
  db: Database,
  _params: CalendarQueries["get-sources"]["params"],
): Promise<CalendarQueries["get-sources"]["result"]> {
  return db.query<SourceRow, []>("SELECT * FROM calendar_sources ORDER BY created_at ASC").all().map(rowToSource);
}

export async function getEvents(
  db: Database,
  params: CalendarQueries["get-events"]["params"],
): Promise<CalendarQueries["get-events"]["result"]> {
  const limit = params.limit ?? 100;

  let sql = "SELECT * FROM calendar_events WHERE 1=1";
  const args: (string | number | null)[] = [];

  if (params.sourceId) {
    sql += " AND source_id = ?";
    args.push(params.sourceId);
  }
  if (params.from) {
    sql += " AND start_time >= ?";
    args.push(params.from);
  }
  if (params.to) {
    sql += " AND start_time <= ?";
    args.push(params.to);
  }

  sql += " ORDER BY start_time ASC LIMIT ?";
  args.push(limit);

  return db
    .query<EventRow, (string | number | null)[]>(sql)
    .all(...args)
    .map(rowToEvent);
}

export async function getUpcoming(
  db: Database,
  params: CalendarQueries["get-upcoming"]["params"],
): Promise<CalendarQueries["get-upcoming"]["result"]> {
  const limit = params.limit ?? 10;
  const now = new Date().toISOString();
  return db
    .query<EventRow, [string, number]>(
      "SELECT * FROM calendar_events WHERE start_time >= ? ORDER BY start_time ASC LIMIT ?",
    )
    .all(now, limit)
    .map(rowToEvent);
}

export async function getEventsStartingSoon(
  db: Database,
  windowStart: string,
  windowEnd: string,
): Promise<{ id: string; title: string; startTime: string }[]> {
  return db
    .query<{ id: string; title: string; start_time: string }, [string, string]>(
      "SELECT id, title, start_time FROM calendar_events WHERE start_time >= ? AND start_time <= ? AND notified = 0",
    )
    .all(windowStart, windowEnd)
    .map((row) => ({ id: row.id, title: row.title, startTime: row.start_time }));
}

export function markNotified(db: Database, eventId: string): void {
  db.query("UPDATE calendar_events SET notified = 1 WHERE id = ?").run(eventId);
}
