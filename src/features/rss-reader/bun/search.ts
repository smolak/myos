import type { Database } from "bun:sqlite";
import type { FeatureSearchResult } from "@core/types";

interface EntrySearchRow {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
}

export async function searchRssEntries(
  db: Database,
  params: { query: string },
): Promise<readonly FeatureSearchResult[]> {
  if (!params.query.trim()) return [];

  const pattern = `%${params.query}%`;
  const rows = db
    .query<EntrySearchRow, [string, string, number]>(
      "SELECT id, title, description FROM rss_entries WHERE title LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT ?",
    )
    .all(pattern, pattern, 10);

  return rows.map((row) => ({
    itemId: row.id,
    title: row.title,
    subtitle: row.description ?? undefined,
    type: "rss-entry",
  }));
}
