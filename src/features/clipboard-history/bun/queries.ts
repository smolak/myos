import type { Database } from "bun:sqlite";
import type { ClipboardEntry, ClipboardHistoryQueries } from "../shared/types";

interface EntryRow {
  readonly id: string;
  readonly content: string;
  readonly content_type: string;
  readonly created_at: string;
}

function rowToEntry(row: EntryRow): ClipboardEntry {
  return {
    id: row.id,
    content: row.content,
    contentType: row.content_type as "text" | "url",
    createdAt: row.created_at,
  };
}

export async function getAllEntries(
  db: Database,
  params: ClipboardHistoryQueries["get-all"]["params"],
): Promise<ClipboardHistoryQueries["get-all"]["result"]> {
  const limit = params.limit ?? 100;

  if (params.search?.trim()) {
    const pattern = `%${params.search}%`;
    const rows = db
      .query<EntryRow, [string, number]>(
        "SELECT id, content, content_type, created_at FROM clipboard_entries WHERE content LIKE ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
      )
      .all(pattern, limit);
    return rows.map(rowToEntry);
  }

  const rows = db
    .query<EntryRow, [number]>(
      "SELECT id, content, content_type, created_at FROM clipboard_entries ORDER BY created_at DESC, rowid DESC LIMIT ?",
    )
    .all(limit);
  return rows.map(rowToEntry);
}

export async function getMostRecentContent(db: Database): Promise<string | null> {
  const row = db
    .query<{ content: string }, []>(
      "SELECT content FROM clipboard_entries ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .get();
  return row?.content ?? null;
}
