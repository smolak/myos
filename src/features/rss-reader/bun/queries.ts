import type { Database } from "bun:sqlite";
import type { RssEntry, RssFeed, RssReaderQueries } from "../shared/types";

interface FeedRow {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly description: string | null;
  readonly last_fetched_at: string | null;
  readonly fetch_interval_minutes: number;
  readonly created_at: string;
  readonly updated_at: string;
}

interface EntryRow {
  readonly id: string;
  readonly feed_id: string;
  readonly guid: string;
  readonly title: string;
  readonly link: string;
  readonly description: string | null;
  readonly published_at: string | null;
  readonly is_read: number;
  readonly created_at: string;
}

function rowToFeed(row: FeedRow): RssFeed {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    lastFetchedAt: row.last_fetched_at,
    fetchIntervalMinutes: row.fetch_interval_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEntry(row: EntryRow): RssEntry {
  return {
    id: row.id,
    feedId: row.feed_id,
    guid: row.guid,
    title: row.title,
    link: row.link,
    description: row.description,
    publishedAt: row.published_at,
    isRead: row.is_read === 1,
    createdAt: row.created_at,
  };
}

export async function getFeeds(
  db: Database,
  _params: RssReaderQueries["get-feeds"]["params"],
): Promise<RssReaderQueries["get-feeds"]["result"]> {
  return db.query<FeedRow, []>("SELECT * FROM rss_feeds ORDER BY created_at ASC").all().map(rowToFeed);
}

export async function getEntries(
  db: Database,
  params: RssReaderQueries["get-entries"]["params"],
): Promise<RssReaderQueries["get-entries"]["result"]> {
  const limit = params.limit ?? 50;

  if (params.feedId && params.unreadOnly) {
    return db
      .query<EntryRow, [string, number, number]>(
        "SELECT * FROM rss_entries WHERE feed_id = ? AND is_read = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(params.feedId, 0, limit)
      .map(rowToEntry);
  }

  if (params.feedId) {
    return db
      .query<EntryRow, [string, number]>("SELECT * FROM rss_entries WHERE feed_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(params.feedId, limit)
      .map(rowToEntry);
  }

  if (params.unreadOnly) {
    return db
      .query<EntryRow, [number, number]>("SELECT * FROM rss_entries WHERE is_read = ? ORDER BY created_at DESC LIMIT ?")
      .all(0, limit)
      .map(rowToEntry);
  }

  return db
    .query<EntryRow, [number]>("SELECT * FROM rss_entries ORDER BY created_at DESC LIMIT ?")
    .all(limit)
    .map(rowToEntry);
}

export async function getUnreadCount(
  db: Database,
  _params: RssReaderQueries["get-unread-count"]["params"],
): Promise<RssReaderQueries["get-unread-count"]["result"]> {
  const row = db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM rss_entries WHERE is_read = 0").get();
  return { count: row?.count ?? 0 };
}
