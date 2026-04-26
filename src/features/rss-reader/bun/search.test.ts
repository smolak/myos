import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { addFeed } from "./actions";
import { rssReaderMigrations } from "./migrations";
import { searchRssEntries } from "./search";

async function insertEntry(
  db: Database,
  feedId: string,
  title: string,
  description: string | null = null,
): Promise<string> {
  const { nanoid } = await import("nanoid");
  const id = nanoid();
  const now = new Date().toISOString();
  db.query(
    "INSERT INTO rss_entries (id, feed_id, guid, title, link, description, published_at, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
  ).run(id, feedId, id, title, "https://example.com", description, now, now);
  return id;
}

describe("searchRssEntries", () => {
  let db: Database;
  let tmpDir: string;
  let feedId: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-rss-search-"));
    db = new Database(join(tmpDir, "rss.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "rss-reader", rssReaderMigrations);
    const result = await addFeed(db, { url: "https://example.com/feed" });
    feedId = result.id;
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns empty array when no entries exist", async () => {
    const result = await searchRssEntries(db, { query: "news" });
    expect(result).toEqual([]);
  });

  test("returns empty array when query is empty", async () => {
    await insertEntry(db, feedId, "Tech news");
    const result = await searchRssEntries(db, { query: "" });
    expect(result).toEqual([]);
  });

  test("matches entry by title", async () => {
    await insertEntry(db, feedId, "Tech news today");
    const result = await searchRssEntries(db, { query: "tech" });
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Tech news today");
  });

  test("matches entry by description", async () => {
    await insertEntry(db, feedId, "Weekly digest", "Top tech stories");
    const result = await searchRssEntries(db, { query: "stories" });
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Weekly digest");
  });

  test("is case-insensitive", async () => {
    await insertEntry(db, feedId, "Tech News");
    const result = await searchRssEntries(db, { query: "tech" });
    expect(result).toHaveLength(1);
  });

  test("does not match unrelated entries", async () => {
    await insertEntry(db, feedId, "Cooking tips");
    const result = await searchRssEntries(db, { query: "tech" });
    expect(result).toEqual([]);
  });

  test("result has correct shape", async () => {
    const id = await insertEntry(db, feedId, "Tech news");
    const result = await searchRssEntries(db, { query: "tech" });
    expect(result[0]).toMatchObject({
      itemId: id,
      title: "Tech news",
      type: "rss-entry",
    });
  });

  test("subtitle is description when present", async () => {
    await insertEntry(db, feedId, "Tech news", "Top stories from the web");
    const result = await searchRssEntries(db, { query: "tech" });
    expect(result[0]?.subtitle).toBe("Top stories from the web");
  });

  test("limits results to 10", async () => {
    for (let i = 0; i < 15; i++) {
      await insertEntry(db, feedId, `Tech story ${i}`);
    }
    const result = await searchRssEntries(db, { query: "tech" });
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
