import type { Database } from "bun:sqlite";
import type { FeatureSearchResult } from "@core/types";

interface BookmarkSearchRow {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly url: string;
}

export async function searchBookmarks(
  db: Database,
  params: { query: string },
): Promise<readonly FeatureSearchResult[]> {
  if (!params.query.trim()) return [];

  const pattern = `%${params.query}%`;
  const rows = db
    .query<BookmarkSearchRow, [string, string, string]>(
      `SELECT id, title, description, url FROM bookmarks
       WHERE (title LIKE ? OR description LIKE ? OR url LIKE ?)
       ORDER BY created_at DESC LIMIT 10`,
    )
    .all(pattern, pattern, pattern);

  return rows.map((row) => ({
    itemId: row.id,
    title: row.title,
    subtitle: row.description ?? row.url,
    type: "bookmark",
  }));
}
