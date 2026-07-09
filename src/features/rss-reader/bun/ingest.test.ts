import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { addFeed } from "./actions";
import type { IngestContext } from "./ingest";
import { ingestFeeds } from "./ingest";
import { rssReaderMigrations } from "./migrations";

const FEED_XML = `<rss version="2.0"><channel>
  <title>Test Feed</title>
  <item><title>Post</title><link>https://site-a.com/post</link><guid>g1</guid></item>
</channel></rss>`;

describe("ingestFeeds", () => {
  let db: Database;

  beforeEach(async () => {
    db = new Database(":memory:");
    bootstrapMigrationsTable(db);
    runMigrations(db, "rss-reader", rssReaderMigrations);
    await addFeed(db, { url: "https://example.com/feed" });
  });

  test("logs a warning when favicon acquisition fails unexpectedly", async () => {
    // Removing the cache table makes acquireFavicons reject with a real SQLite error
    db.run("DROP TABLE rss_favicons");
    const warnings: string[] = [];
    const ctx: IngestContext = {
      db,
      events: { emit() {} },
      log: {
        warn(message) {
          warnings.push(message);
        },
      },
    };
    const fetchFn = async () => new Response(FEED_XML, { headers: { "content-type": "application/rss+xml" } });

    const result = await ingestFeeds(ctx, fetchFn);

    expect(result.fetched).toBe(1);
    expect(result.newEntries).toHaveLength(1);
    for (let attempt = 0; attempt < 100 && warnings.length === 0; attempt++) {
      await Bun.sleep(5);
    }
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("avicon");
  });
});
