import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { rssReaderMigrations } from "./migrations";
import { addFeed, fetchAllFeeds, markRead } from "./actions";
import { getFeeds, getEntries, getUnreadCount } from "./queries";

const RSS_XML_A = `<rss version="2.0"><channel>
  <title>Feed A</title>
  <item><title>A1</title><link>https://a.com/1</link><guid>a1</guid></item>
  <item><title>A2</title><link>https://a.com/2</link><guid>a2</guid></item>
</channel></rss>`;

const RSS_XML_B = `<rss version="2.0"><channel>
  <title>Feed B</title>
  <item><title>B1</title><link>https://b.com/1</link><guid>b1</guid></item>
</channel></rss>`;

type FetchFn = (url: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

function makeFetchFn(xmlByUrl: Record<string, string>): FetchFn {
	return async (input) => {
		const url = typeof input === "string" ? input : (input as Request).url;
		const xml = xmlByUrl[url] ?? `<rss><channel><title>Empty</title></channel></rss>`;
		return new Response(xml, { headers: { "content-type": "application/rss+xml" } });
	};
}

describe("getFeeds", () => {
	let db: Database;
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-qfeeds-"));
		db = new Database(join(tmpDir, "rss.db"));
		db.run("PRAGMA journal_mode=WAL");
		bootstrapMigrationsTable(db);
		runMigrations(db, "rss-reader", rssReaderMigrations);
	});

	afterEach(async () => {
		db.close();
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("returns empty array when no feeds exist", async () => {
		const feeds = await getFeeds(db, {});
		expect(feeds).toHaveLength(0);
	});

	test("returns all added feeds", async () => {
		await addFeed(db, { url: "https://a.com/feed" });
		await addFeed(db, { url: "https://b.com/feed" });
		const feeds = await getFeeds(db, {});
		expect(feeds).toHaveLength(2);
	});

	test("maps database columns to camelCase fields", async () => {
		const { id } = await addFeed(db, {
			url: "https://example.com/feed",
			title: "My Feed",
			fetchIntervalMinutes: 60,
		});
		const feeds = await getFeeds(db, {});
		const feed = feeds.find((f) => f.id === id)!;
		expect(feed.url).toBe("https://example.com/feed");
		expect(feed.title).toBe("My Feed");
		expect(feed.fetchIntervalMinutes).toBe(60);
		expect(feed.lastFetchedAt).toBeNull();
	});

	test("lastFetchedAt is populated after fetch", async () => {
		const { id } = await addFeed(db, { url: "https://a.com/feed" });
		await fetchAllFeeds(db, makeFetchFn({ "https://a.com/feed": RSS_XML_A }));
		const feeds = await getFeeds(db, {});
		const feed = feeds.find((f) => f.id === id)!;
		expect(feed.lastFetchedAt).not.toBeNull();
	});
});

describe("getEntries", () => {
	let db: Database;
	let tmpDir: string;
	let feedAId: string;
	let feedBId: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-qentries-"));
		db = new Database(join(tmpDir, "rss.db"));
		db.run("PRAGMA journal_mode=WAL");
		bootstrapMigrationsTable(db);
		runMigrations(db, "rss-reader", rssReaderMigrations);

		const a = await addFeed(db, { url: "https://a.com/feed" });
		const b = await addFeed(db, { url: "https://b.com/feed" });
		feedAId = a.id;
		feedBId = b.id;
		await fetchAllFeeds(
			db,
			makeFetchFn({
				"https://a.com/feed": RSS_XML_A,
				"https://b.com/feed": RSS_XML_B,
			}),
		);
	});

	afterEach(async () => {
		db.close();
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("returns all entries when no filter given", async () => {
		const entries = await getEntries(db, {});
		expect(entries).toHaveLength(3);
	});

	test("filters by feedId", async () => {
		const entries = await getEntries(db, { feedId: feedAId });
		expect(entries).toHaveLength(2);
		expect(entries.every((e) => e.feedId === feedAId)).toBe(true);
	});

	test("filters unread only", async () => {
		const all = await getEntries(db, {});
		await markRead(db, { id: all[0]!.id });
		const unread = await getEntries(db, { unreadOnly: true });
		expect(unread).toHaveLength(2);
		expect(unread.every((e) => !e.isRead)).toBe(true);
	});

	test("filters by feedId and unreadOnly together", async () => {
		const aEntries = await getEntries(db, { feedId: feedAId });
		await markRead(db, { id: aEntries[0]!.id });
		const unread = await getEntries(db, { feedId: feedAId, unreadOnly: true });
		expect(unread).toHaveLength(1);
		expect(unread[0]!.feedId).toBe(feedAId);
		expect(unread[0]!.isRead).toBe(false);
	});

	test("respects limit parameter", async () => {
		const entries = await getEntries(db, { limit: 2 });
		expect(entries).toHaveLength(2);
	});

	test("maps columns to camelCase fields", async () => {
		const entries = await getEntries(db, { feedId: feedBId });
		const entry = entries[0]!;
		expect(typeof entry.id).toBe("string");
		expect(entry.feedId).toBe(feedBId);
		expect(entry.title).toBe("B1");
		expect(entry.link).toBe("https://b.com/1");
		expect(entry.isRead).toBe(false);
	});
});

describe("getUnreadCount", () => {
	let db: Database;
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-unread-"));
		db = new Database(join(tmpDir, "rss.db"));
		db.run("PRAGMA journal_mode=WAL");
		bootstrapMigrationsTable(db);
		runMigrations(db, "rss-reader", rssReaderMigrations);
	});

	afterEach(async () => {
		db.close();
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("returns 0 when no entries exist", async () => {
		const result = await getUnreadCount(db, {});
		expect(result.count).toBe(0);
	});

	test("returns total unread across all feeds", async () => {
		await addFeed(db, { url: "https://a.com/feed" });
		await fetchAllFeeds(
			db,
			async () => new Response(RSS_XML_A, { headers: { "content-type": "application/rss+xml" } }),
		);
		const result = await getUnreadCount(db, {});
		expect(result.count).toBe(2);
	});

	test("decrements after marking entries read", async () => {
		await addFeed(db, { url: "https://a.com/feed" });
		const { newEntries } = await fetchAllFeeds(
			db,
			async () => new Response(RSS_XML_A, { headers: { "content-type": "application/rss+xml" } }),
		);
		await markRead(db, { id: newEntries[0]!.id });
		const result = await getUnreadCount(db, {});
		expect(result.count).toBe(1);
	});
});
