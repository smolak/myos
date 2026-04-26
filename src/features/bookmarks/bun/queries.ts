import type { Database } from "bun:sqlite";
import type { Bookmark, BookmarksQueries } from "../shared/types";

interface BookmarkRow {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly description: string | null;
  readonly folder: string | null;
  readonly tags: string;
  readonly created_at: string;
  readonly updated_at: string;
}

function rowToBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    folder: row.folder,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllBookmarks(
  db: Database,
  params: BookmarksQueries["get-all"]["params"],
): Promise<BookmarksQueries["get-all"]["result"]> {
  let sql = "SELECT id, title, url, description, folder, tags, created_at, updated_at FROM bookmarks";
  const args: string[] = [];

  if (params.folder !== undefined) {
    sql += " WHERE folder = ?";
    args.push(params.folder);
  }

  sql += " ORDER BY created_at DESC";

  const rows = db.query<BookmarkRow, string[]>(sql).all(...args);

  if (params.tag !== undefined) {
    const tag = params.tag;
    return rows.map(rowToBookmark).filter((b) => b.tags.includes(tag));
  }

  return rows.map(rowToBookmark);
}

export async function getBookmarkById(
  db: Database,
  params: BookmarksQueries["get-by-id"]["params"],
): Promise<BookmarksQueries["get-by-id"]["result"]> {
  const row = db
    .query<BookmarkRow, [string]>(
      "SELECT id, title, url, description, folder, tags, created_at, updated_at FROM bookmarks WHERE id = ?",
    )
    .get(params.id);
  if (!row) return null;
  return rowToBookmark(row);
}
