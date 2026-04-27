import type { Database } from "bun:sqlite";
import type { FeatureSearchResult } from "@core/types";

interface EntrySearchRow {
  readonly id: string;
  readonly content: string;
}

export async function searchClipboardHistory(
  db: Database,
  params: { query: string },
): Promise<readonly FeatureSearchResult[]> {
  if (!params.query.trim()) return [];

  const pattern = `%${params.query}%`;
  const rows = db
    .query<EntrySearchRow, [string]>(
      "SELECT id, content FROM clipboard_entries WHERE content LIKE ? ORDER BY created_at DESC LIMIT 10",
    )
    .all(pattern);

  return rows.map((row) => ({
    itemId: row.id,
    title: row.content.slice(0, 100),
    subtitle: "Clipboard",
    type: "clipboard-entry",
  }));
}
