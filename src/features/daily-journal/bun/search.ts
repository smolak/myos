import type { Database } from "bun:sqlite";
import type { FeatureSearchResult } from "@core/types";

interface NoteSearchRow {
  readonly id: string;
  readonly date: string;
  readonly content: string;
}

export async function searchJournalNotes(
  db: Database,
  params: { query: string },
): Promise<readonly FeatureSearchResult[]> {
  if (!params.query.trim()) return [];

  const pattern = `%${params.query}%`;
  const rows = db
    .query<NoteSearchRow, [string, number]>(
      "SELECT id, date, content FROM journal_notes WHERE content LIKE ? ORDER BY date DESC LIMIT ?",
    )
    .all(pattern, 10);

  return rows.map((row) => {
    const title = row.content.length > 60 ? `${row.content.slice(0, 60)}...` : row.content;
    return { itemId: row.id, title, subtitle: row.date, type: "journal-note" };
  });
}
