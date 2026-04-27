import type { Database } from "bun:sqlite";
import type { FeatureSearchResult } from "@core/types";

interface CountdownSearchRow {
  readonly id: string;
  readonly name: string;
}

export async function searchCountdowns(
  db: Database,
  params: { query: string },
): Promise<readonly FeatureSearchResult[]> {
  if (!params.query.trim()) return [];

  const pattern = `%${params.query}%`;
  const rows = db
    .query<CountdownSearchRow, [string]>(
      "SELECT id, name FROM countdowns WHERE archived_at IS NULL AND name LIKE ? ORDER BY target_date ASC LIMIT 10",
    )
    .all(pattern);

  return rows.map((row) => ({
    itemId: row.id,
    title: row.name,
    type: "countdown",
  }));
}
