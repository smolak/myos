import type { Database } from "bun:sqlite";
import type { FeatureSearchResult } from "@core/types";

interface SnippetSearchRow {
  readonly id: string;
  readonly name: string;
  readonly template: string;
}

export async function searchSnippets(db: Database, params: { query: string }): Promise<readonly FeatureSearchResult[]> {
  if (!params.query.trim()) return [];

  const pattern = `%${params.query}%`;
  const rows = db
    .query<SnippetSearchRow, [string, string]>(
      "SELECT id, name, template FROM snippets WHERE name LIKE ? OR template LIKE ? ORDER BY name ASC LIMIT 10",
    )
    .all(pattern, pattern);

  return rows.map((row) => ({
    itemId: row.id,
    title: row.name,
    subtitle: row.template.length > 50 ? `${row.template.slice(0, 50)}…` : row.template,
    type: "snippet",
  }));
}
