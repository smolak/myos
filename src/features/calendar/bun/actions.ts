import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import { parseIcs } from "../shared/ics-parser";
import type { CalendarActions } from "../shared/types";

const DEFAULT_SYNC_INTERVAL_MINUTES = 60;

type AddSourceParams = CalendarActions["add-source"]["params"];
type DeleteSourceParams = CalendarActions["delete-source"]["params"];
type FetchFn = (url: URL | RequestInfo) => Promise<Response>;

export async function addSource(
  db: Database,
  params: AddSourceParams,
): Promise<CalendarActions["add-source"]["result"]> {
  const existing = db.query<{ id: string }, [string]>("SELECT id FROM calendar_sources WHERE url = ?").get(params.url);
  if (existing) return { id: existing.id };

  const id = nanoid();
  const now = new Date().toISOString();
  const title = params.title ?? params.url;
  const syncInterval = params.syncIntervalMinutes ?? DEFAULT_SYNC_INTERVAL_MINUTES;

  db.query(
    `INSERT INTO calendar_sources (id, url, title, last_synced_at, sync_interval_minutes, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, ?, ?, ?)`,
  ).run(id, params.url, title, syncInterval, now, now);

  return { id };
}

export async function deleteSource(
  db: Database,
  params: DeleteSourceParams,
): Promise<CalendarActions["delete-source"]["result"]> {
  const row = db.query<{ id: string }, [string]>("SELECT id FROM calendar_sources WHERE id = ?").get(params.id);
  if (!row) return { success: false };

  db.query("DELETE FROM calendar_sources WHERE id = ?").run(params.id);
  return { success: true };
}

export interface NewEvent {
  readonly id: string;
  readonly sourceId: string;
  readonly title: string;
  readonly startTime: string;
}

export async function syncAllSources(
  db: Database,
  fetchFn: FetchFn = fetch,
): Promise<{ synced: number; newEvents: NewEvent[] }> {
  const sources = db
    .query<{ id: string; url: string }, []>("SELECT id, url FROM calendar_sources ORDER BY created_at ASC")
    .all();

  const newEvents: NewEvent[] = [];

  for (const source of sources) {
    try {
      const response = await fetchFn(source.url);
      const ics = await response.text();
      const parsed = parseIcs(ics);

      const now = new Date().toISOString();
      const title = parsed.title || null;
      if (title) {
        db.query("UPDATE calendar_sources SET title = ?, last_synced_at = ?, updated_at = ? WHERE id = ?").run(
          title,
          now,
          now,
          source.id,
        );
      } else {
        db.query("UPDATE calendar_sources SET last_synced_at = ?, updated_at = ? WHERE id = ?").run(
          now,
          now,
          source.id,
        );
      }

      for (const event of parsed.events) {
        const inserted = insertEvent(db, source.id, event, now);
        if (inserted) newEvents.push(inserted);
      }
    } catch {
      // Continue with other sources on error
    }
  }

  return { synced: sources.length, newEvents };
}

interface ParsedEventInput {
  readonly uid: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly isAllDay: boolean;
}

function insertEvent(db: Database, sourceId: string, event: ParsedEventInput, now: string): NewEvent | null {
  const existing = db
    .query<{ id: string }, [string, string]>("SELECT id FROM calendar_events WHERE source_id = ? AND uid = ?")
    .get(sourceId, event.uid);
  if (existing) return null;

  const id = nanoid();
  db.query(
    `INSERT INTO calendar_events
		 (id, source_id, uid, title, description, location, start_time, end_time, is_all_day, notified, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    id,
    sourceId,
    event.uid,
    event.title,
    event.description ?? null,
    event.location ?? null,
    event.startTime,
    event.endTime ?? null,
    event.isAllDay ? 1 : 0,
    now,
    now,
  );

  return { id, sourceId, title: event.title, startTime: event.startTime };
}
