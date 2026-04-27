import type { Database } from "bun:sqlite";
import type { Snippet, SnippetsQueries } from "../shared/types";
import { buildVars, expandTemplate } from "./template";

interface SnippetRow {
  readonly id: string;
  readonly name: string;
  readonly template: string;
  readonly is_favorite: number;
  readonly created_at: string;
  readonly updated_at: string;
}

function rowToSnippet(row: SnippetRow): Snippet {
  return {
    id: row.id,
    name: row.name,
    template: row.template,
    isFavorite: row.is_favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllSnippets(
  db: Database,
  params: SnippetsQueries["get-all"]["params"],
): Promise<SnippetsQueries["get-all"]["result"]> {
  const sql = params.favoritesOnly
    ? "SELECT id, name, template, is_favorite, created_at, updated_at FROM snippets WHERE is_favorite = 1 ORDER BY name ASC"
    : "SELECT id, name, template, is_favorite, created_at, updated_at FROM snippets ORDER BY name ASC";
  const rows = db.query<SnippetRow, []>(sql).all();
  return rows.map(rowToSnippet);
}

export async function getSnippetById(
  db: Database,
  params: SnippetsQueries["get-by-id"]["params"],
): Promise<SnippetsQueries["get-by-id"]["result"]> {
  const row = db
    .query<SnippetRow, [string]>(
      "SELECT id, name, template, is_favorite, created_at, updated_at FROM snippets WHERE id = ?",
    )
    .get(params.id);
  return row ? rowToSnippet(row) : null;
}

export async function expandSnippet(
  db: Database,
  params: SnippetsQueries["expand"]["params"],
): Promise<SnippetsQueries["expand"]["result"]> {
  const row = db.query<{ template: string }, [string]>("SELECT template FROM snippets WHERE id = ?").get(params.id);
  if (!row) throw new Error(`Snippet not found: ${params.id}`);
  const vars = buildVars(new Date(), params.clipboard ?? "");
  return { text: expandTemplate(row.template, vars) };
}
