import type { Database } from "bun:sqlite";
import type { FeatureSearchResult } from "@core/types";

interface HabitSearchRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
}

export async function searchHabits(db: Database, params: { query: string }): Promise<readonly FeatureSearchResult[]> {
  if (!params.query.trim()) return [];

  const pattern = `%${params.query}%`;
  const rows = db
    .query<HabitSearchRow, [string, string]>(
      "SELECT id, name, description FROM habits WHERE (name LIKE ? OR description LIKE ?) ORDER BY created_at DESC LIMIT 10",
    )
    .all(pattern, pattern);

  return rows.map((row) => ({
    itemId: row.id,
    title: row.name,
    subtitle: row.description ?? undefined,
    type: "habit",
  }));
}
