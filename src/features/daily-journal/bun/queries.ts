import type { Database } from "bun:sqlite";
import type { DailyJournalQueries, JournalNote, TimelineEvent } from "../shared/types";

interface NoteRow {
  readonly id: string;
  readonly date: string;
  readonly content: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface EventLogRow {
  readonly id: number;
  readonly event_name: string;
  readonly feature_id: string;
  readonly payload: string | null;
  readonly created_at: string;
}

const TIMELINE_EVENT_NAMES = ["todo:item-completed", "pomodoro:session-ended", "rss:new-entry", "rss:entry-read"];

function rowToNote(row: NoteRow): JournalNote {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getNotes(
  db: Database,
  params: DailyJournalQueries["get-notes"]["params"],
): Promise<DailyJournalQueries["get-notes"]["result"]> {
  let sql = "SELECT * FROM journal_notes";
  const values: (string | number)[] = [];

  if (params.search) {
    sql += " WHERE content LIKE ?";
    values.push(`%${params.search}%`);
  }

  sql += " ORDER BY date DESC";

  if (params.limit) {
    sql += " LIMIT ?";
    values.push(params.limit);
  }

  return db
    .query<NoteRow, (string | number)[]>(sql)
    .all(...values)
    .map(rowToNote);
}

export async function getNoteByDate(
  db: Database,
  params: DailyJournalQueries["get-note-by-date"]["params"],
): Promise<DailyJournalQueries["get-note-by-date"]["result"]> {
  const row = db.query<NoteRow, [string]>("SELECT * FROM journal_notes WHERE date = ?").get(params.date);
  return row ? rowToNote(row) : null;
}

export function getTimelineEvents(coreDb: Database, date: string): readonly TimelineEvent[] {
  const placeholders = TIMELINE_EVENT_NAMES.map(() => "?").join(", ");
  const sql = `
    SELECT id, event_name, feature_id, payload, created_at
    FROM event_log
    WHERE event_name IN (${placeholders})
      AND DATE(created_at) = ?
    ORDER BY created_at ASC
  `;
  const rows = coreDb.query<EventLogRow, string[]>(sql).all(...TIMELINE_EVENT_NAMES, date);

  return rows.map((r) => ({
    id: r.id,
    eventName: r.event_name,
    featureId: r.feature_id,
    payload: r.payload ? (JSON.parse(r.payload) as unknown) : null,
    createdAt: r.created_at,
  }));
}
