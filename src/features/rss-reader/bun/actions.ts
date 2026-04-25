import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { ParsedEntry } from "../shared/feed-parser";
import { parseFeed } from "../shared/feed-parser";
import type { RssReaderActions } from "../shared/types";

const DEFAULT_FETCH_INTERVAL_MINUTES = 30;

type AddFeedParams = RssReaderActions["add-feed"]["params"];
type DeleteFeedParams = RssReaderActions["delete-feed"]["params"];
type MarkReadParams = RssReaderActions["mark-read"]["params"];
type MarkUnreadParams = RssReaderActions["mark-unread"]["params"];

export async function addFeed(db: Database, params: AddFeedParams): Promise<RssReaderActions["add-feed"]["result"]> {
  const existing = db.query<{ id: string }, [string]>("SELECT id FROM rss_feeds WHERE url = ?").get(params.url);
  if (existing) return { id: existing.id };

  const id = nanoid();
  const now = new Date().toISOString();
  const title = params.title ?? params.url;
  const fetchInterval = params.fetchIntervalMinutes ?? DEFAULT_FETCH_INTERVAL_MINUTES;

  db.query(
    `INSERT INTO rss_feeds (id, url, title, description, last_fetched_at, fetch_interval_minutes, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)`,
  ).run(id, params.url, title, fetchInterval, now, now);

  return { id };
}

export async function deleteFeed(
  db: Database,
  params: DeleteFeedParams,
): Promise<RssReaderActions["delete-feed"]["result"]> {
  const row = db.query<{ id: string }, [string]>("SELECT id FROM rss_feeds WHERE id = ?").get(params.id);
  if (!row) return { success: false };

  db.query("DELETE FROM rss_feeds WHERE id = ?").run(params.id);
  return { success: true };
}

export interface NewEntry {
  readonly id: string;
  readonly feedId: string;
  readonly title: string;
  readonly link: string;
}

type FetchFn = (url: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

export async function fetchAllFeeds(
  db: Database,
  fetchFn: FetchFn = fetch,
): Promise<{ fetched: number; newEntries: NewEntry[] }> {
  const feeds = db
    .query<{ id: string; url: string }, []>("SELECT id, url FROM rss_feeds ORDER BY created_at ASC")
    .all();

  const newEntries: NewEntry[] = [];

  for (const feed of feeds) {
    try {
      const response = await fetchFn(feed.url);
      const xml = await response.text();
      const parsed = parseFeed(xml);

      const now = new Date().toISOString();
      db.query("UPDATE rss_feeds SET title = ?, last_fetched_at = ?, updated_at = ? WHERE id = ?").run(
        parsed.title,
        now,
        now,
        feed.id,
      );

      for (const entry of parsed.entries) {
        const inserted = insertEntry(db, feed.id, entry, now);
        if (inserted) newEntries.push(inserted);
      }
    } catch {
      // Continue with other feeds on error
    }
  }

  return { fetched: feeds.length, newEntries };
}

function insertEntry(db: Database, feedId: string, entry: ParsedEntry, now: string): NewEntry | null {
  const existing = db
    .query<{ id: string }, [string, string]>("SELECT id FROM rss_entries WHERE feed_id = ? AND guid = ?")
    .get(feedId, entry.guid);
  if (existing) return null;

  const id = nanoid();
  db.query(
    `INSERT INTO rss_entries (id, feed_id, guid, title, link, description, published_at, is_read, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(id, feedId, entry.guid, entry.title, entry.link, entry.description ?? null, entry.publishedAt, now);

  return { id, feedId, title: entry.title, link: entry.link };
}

export async function markRead(db: Database, params: MarkReadParams): Promise<RssReaderActions["mark-read"]["result"]> {
  const row = db.query<{ id: string }, [string]>("SELECT id FROM rss_entries WHERE id = ?").get(params.id);
  if (!row) return { success: false };

  db.query("UPDATE rss_entries SET is_read = 1 WHERE id = ?").run(params.id);
  return { success: true };
}

export async function markUnread(
  db: Database,
  params: MarkUnreadParams,
): Promise<RssReaderActions["mark-unread"]["result"]> {
  const row = db.query<{ id: string }, [string]>("SELECT id FROM rss_entries WHERE id = ?").get(params.id);
  if (!row) return { success: false };

  db.query("UPDATE rss_entries SET is_read = 0 WHERE id = ?").run(params.id);
  return { success: true };
}
