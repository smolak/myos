import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { rssReaderMigrations } from "./migrations";
import { addFeed, deleteFeed, fetchAllFeeds, markRead, markUnread } from "./actions";

const RSS_XML = `<rss version="2.0"><channel>
  <title>Test Feed</title>
  <description>A test feed</description>
  <item>
    <title>Post One</title>
    <link>https://example.com/1</link>
    <guid>guid-1</guid>
    <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Post Two</title>
    <link>https://example.com/2</link>
    <guid>guid-2</guid>
  </item>
</channel></rss>`;

type FetchFn = (url: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

function makeFetchFn(xml: string): FetchFn {
  return async () => new Response(xml, { headers: { "content-type": "application/rss+xml" } });
}

describe("addFeed", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-add-"));
    db = new Database(join(tmpDir, "rss.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "rss-reader", rssReaderMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns a generated id", async () => {
    const result = await addFeed(db, { url: "https://example.com/feed" });
    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
  });

  test("stores the feed in the database", async () => {
    const { id } = await addFeed(db, { url: "https://example.com/feed", title: "My Feed" });
    const row = db
      .query<{ url: string; title: string }, [string]>("SELECT url, title FROM rss_feeds WHERE id = ?")
      .get(id);
    expect(row?.url).toBe("https://example.com/feed");
    expect(row?.title).toBe("My Feed");
  });

  test("falls back to URL as title when title not provided", async () => {
    const { id } = await addFeed(db, { url: "https://example.com/feed.xml" });
    const row = db.query<{ title: string }, [string]>("SELECT title FROM rss_feeds WHERE id = ?").get(id);
    expect(row?.title).toBe("https://example.com/feed.xml");
  });

  test("defaults fetchIntervalMinutes to 30", async () => {
    const { id } = await addFeed(db, { url: "https://example.com/feed" });
    const row = db
      .query<{ fetch_interval_minutes: number }, [string]>("SELECT fetch_interval_minutes FROM rss_feeds WHERE id = ?")
      .get(id);
    expect(row?.fetch_interval_minutes).toBe(30);
  });

  test("respects explicit fetchIntervalMinutes", async () => {
    const { id } = await addFeed(db, { url: "https://example.com/feed", fetchIntervalMinutes: 60 });
    const row = db
      .query<{ fetch_interval_minutes: number }, [string]>("SELECT fetch_interval_minutes FROM rss_feeds WHERE id = ?")
      .get(id);
    expect(row?.fetch_interval_minutes).toBe(60);
  });

  test("is idempotent — adding duplicate URL returns existing id", async () => {
    const first = await addFeed(db, { url: "https://example.com/feed" });
    const second = await addFeed(db, { url: "https://example.com/feed" });
    expect(second.id).toBe(first.id);
    const count = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM rss_feeds").get();
    expect(count?.n).toBe(1);
  });

  test("two different URLs produce different ids", async () => {
    const a = await addFeed(db, { url: "https://a.com/feed" });
    const b = await addFeed(db, { url: "https://b.com/feed" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("deleteFeed", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-delete-"));
    db = new Database(join(tmpDir, "rss.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "rss-reader", rssReaderMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("removes the feed from the database", async () => {
    const { id } = await addFeed(db, { url: "https://example.com/feed" });
    await deleteFeed(db, { id });
    const row = db.query<{ id: string }, [string]>("SELECT id FROM rss_feeds WHERE id = ?").get(id);
    expect(row).toBeNull();
  });

  test("returns success=true on successful delete", async () => {
    const { id } = await addFeed(db, { url: "https://example.com/feed" });
    const result = await deleteFeed(db, { id });
    expect(result.success).toBe(true);
  });

  test("returns success=false for non-existent id", async () => {
    const result = await deleteFeed(db, { id: "ghost" });
    expect(result.success).toBe(false);
  });
});

describe("fetchAllFeeds", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-fetch-"));
    db = new Database(join(tmpDir, "rss.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "rss-reader", rssReaderMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns fetched=0 and newEntries=[] when no feeds exist", async () => {
    const result = await fetchAllFeeds(db, makeFetchFn(RSS_XML));
    expect(result.fetched).toBe(0);
    expect(result.newEntries).toHaveLength(0);
  });

  test("fetches entries and stores them in the database", async () => {
    const { id: feedId } = await addFeed(db, { url: "https://example.com/feed" });
    await fetchAllFeeds(db, makeFetchFn(RSS_XML));
    const entries = db.query<{ id: string }, [string]>("SELECT id FROM rss_entries WHERE feed_id = ?").all(feedId);
    expect(entries).toHaveLength(2);
  });

  test("returns newEntries with id, feedId, title, link", async () => {
    await addFeed(db, { url: "https://example.com/feed" });
    const { newEntries } = await fetchAllFeeds(db, makeFetchFn(RSS_XML));
    expect(newEntries).toHaveLength(2);
    expect(newEntries[0]).toMatchObject({
      title: "Post One",
      link: "https://example.com/1",
    });
  });

  test("updates feed title from parsed feed", async () => {
    const { id: feedId } = await addFeed(db, { url: "https://example.com/feed" });
    await fetchAllFeeds(db, makeFetchFn(RSS_XML));
    const row = db.query<{ title: string }, [string]>("SELECT title FROM rss_feeds WHERE id = ?").get(feedId);
    expect(row?.title).toBe("Test Feed");
  });

  test("sets last_fetched_at after fetching", async () => {
    const { id: feedId } = await addFeed(db, { url: "https://example.com/feed" });
    const before = new Date().toISOString();
    await fetchAllFeeds(db, makeFetchFn(RSS_XML));
    const after = new Date().toISOString();
    const row = db
      .query<{ last_fetched_at: string | null }, [string]>("SELECT last_fetched_at FROM rss_feeds WHERE id = ?")
      .get(feedId);
    expect(row?.last_fetched_at).not.toBeNull();
    expect(row!.last_fetched_at! >= before).toBe(true);
    expect(row!.last_fetched_at! <= after).toBe(true);
  });

  test("is idempotent — second fetch does not duplicate entries", async () => {
    await addFeed(db, { url: "https://example.com/feed" });
    await fetchAllFeeds(db, makeFetchFn(RSS_XML));
    const second = await fetchAllFeeds(db, makeFetchFn(RSS_XML));
    expect(second.newEntries).toHaveLength(0);
    const count = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM rss_entries").get();
    expect(count?.n).toBe(2);
  });

  test("continues fetching other feeds when one fails", async () => {
    await addFeed(db, { url: "https://fails.com/feed" });
    await addFeed(db, { url: "https://succeeds.com/feed" });
    const partialFetch: FetchFn = async (url) => {
      const u = typeof url === "string" ? url : (url as Request).url;
      if (u.includes("fails")) throw new Error("Network error");
      return new Response(RSS_XML, { headers: { "content-type": "application/rss+xml" } });
    };
    const result = await fetchAllFeeds(db, partialFetch);
    expect(result.fetched).toBe(2);
    expect(result.newEntries).toHaveLength(2);
  });

  test("new entries have is_read=0 by default", async () => {
    await addFeed(db, { url: "https://example.com/feed" });
    await fetchAllFeeds(db, makeFetchFn(RSS_XML));
    const entries = db.query<{ is_read: number }, []>("SELECT is_read FROM rss_entries").all();
    expect(entries.every((e) => e.is_read === 0)).toBe(true);
  });
});

describe("markRead / markUnread", () => {
  let db: Database;
  let tmpDir: string;
  let entryId: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-mark-"));
    db = new Database(join(tmpDir, "rss.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "rss-reader", rssReaderMigrations);

    const { id: feedId } = await addFeed(db, { url: "https://example.com/feed" });
    const { newEntries } = await fetchAllFeeds(db, makeFetchFn(RSS_XML));
    entryId = newEntries[0]!.id;
    void feedId;
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("markRead sets is_read=1", async () => {
    await markRead(db, { id: entryId });
    const row = db.query<{ is_read: number }, [string]>("SELECT is_read FROM rss_entries WHERE id = ?").get(entryId);
    expect(row?.is_read).toBe(1);
  });

  test("markRead returns success=true", async () => {
    const result = await markRead(db, { id: entryId });
    expect(result.success).toBe(true);
  });

  test("markRead returns success=false for non-existent entry", async () => {
    const result = await markRead(db, { id: "ghost" });
    expect(result.success).toBe(false);
  });

  test("markUnread sets is_read=0 after marking read", async () => {
    await markRead(db, { id: entryId });
    await markUnread(db, { id: entryId });
    const row = db.query<{ is_read: number }, [string]>("SELECT is_read FROM rss_entries WHERE id = ?").get(entryId);
    expect(row?.is_read).toBe(0);
  });

  test("markUnread returns success=false for non-existent entry", async () => {
    const result = await markUnread(db, { id: "ghost" });
    expect(result.success).toBe(false);
  });
});
