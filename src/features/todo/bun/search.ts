import type { Database } from "bun:sqlite";
import type { FeatureSearchResult } from "@core/types";

interface TodoSearchRow {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly completed: number;
}

export async function searchTodos(db: Database, params: { query: string }): Promise<readonly FeatureSearchResult[]> {
  if (!params.query.trim()) return [];

  const pattern = `%${params.query}%`;
  const rows = db
    .query<TodoSearchRow, [string, string, number]>(
      "SELECT id, title, description, completed FROM todos WHERE (title LIKE ? OR description LIKE ?) ORDER BY completed ASC, created_at DESC LIMIT ?",
    )
    .all(pattern, pattern, 10);

  return rows.map((row) => {
    let subtitle: string | undefined;
    if (row.completed === 1) {
      subtitle = row.description ? `${row.description} · Completed` : "Completed";
    } else {
      subtitle = row.description ?? undefined;
    }
    return { itemId: row.id, title: row.title, subtitle, type: "todo" };
  });
}
