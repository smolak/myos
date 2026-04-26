import type { Database } from "bun:sqlite";
import type { FeatureSearchResult } from "@core/types";

interface EventSearchRow {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
}

export async function searchCalendarEvents(
  db: Database,
  params: { query: string },
): Promise<readonly FeatureSearchResult[]> {
  if (!params.query.trim()) return [];

  const pattern = `%${params.query}%`;
  const rows = db
    .query<EventSearchRow, [string, string, number]>(
      "SELECT id, title, description FROM calendar_events WHERE title LIKE ? OR description LIKE ? ORDER BY start_time DESC LIMIT ?",
    )
    .all(pattern, pattern, 10);

  return rows.map((row) => ({
    itemId: row.id,
    title: row.title,
    subtitle: row.description ?? undefined,
    type: "calendar-event",
  }));
}
