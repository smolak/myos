import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { addFeed } from "./actions";
import { DAY_MS, FAVICON_NEGATIVE_RETRY_DAYS, FAVICON_TTL_DAYS } from "./favicon-cache";
import { daysAgo, deadFetch, makeIconFetch, PNG_BYTES, pngDataUri, withFeed } from "./favicon-test-helpers";
import type { IngestContext } from "./ingest";
import { ingestFeeds } from "./ingest";
import { rssReaderMigrations } from "./migrations";
import { getFavicons } from "./queries";

const FEED = {
  url: "https://example.com/feed",
  xml: `<rss version="2.0"><channel>
  <title>Test Feed</title>
  <item><title>Post</title><link>https://site-a.com/post</link><guid>g1</guid></item>
</channel></rss>`,
};

function makeContext(db: Database): IngestContext {
  return {
    db,
    events: { emit() {} },
    log: { warn() {} },
  };
}

function setFaviconFetchedAt(db: Database, hostname: string, fetchedAt: string): void {
  db.query("UPDATE rss_favicons SET fetched_at = ? WHERE hostname = ?").run(fetchedAt, hostname);
}

describe("ingestFeeds", () => {
  let db: Database;

  beforeEach(async () => {
    db = new Database(":memory:");
    bootstrapMigrationsTable(db);
    runMigrations(db, "rss-reader", rssReaderMigrations);
    await addFeed(db, { url: FEED.url });
  });

  test("re-fetches a stale favicon even when its hostname has no new entries", async () => {
    const first = await ingestFeeds(makeContext(db), withFeed(FEED, makeIconFetch()));
    await first.faviconAcquisition;
    setFaviconFetchedAt(db, "site-a.com", daysAgo(FAVICON_TTL_DAYS + 1));

    const iconCalls: string[] = [];
    const second = await ingestFeeds(makeContext(db), withFeed(FEED, makeIconFetch(iconCalls)));
    await second.faviconAcquisition;

    expect(second.newEntries).toHaveLength(0);
    expect(iconCalls.length).toBeGreaterThan(0);
    const row = db
      .query<{ fetched_at: string }, [string]>("SELECT fetched_at FROM rss_favicons WHERE hostname = ?")
      .get("site-a.com");
    expect(Date.parse(row?.fetched_at ?? "")).toBeGreaterThan(Date.now() - DAY_MS);
  });

  test("keeps serving the stale icon through get-favicons when a refresh fails", async () => {
    const first = await ingestFeeds(makeContext(db), withFeed(FEED, makeIconFetch()));
    await first.faviconAcquisition;
    setFaviconFetchedAt(db, "site-a.com", daysAgo(FAVICON_TTL_DAYS + 1));

    const second = await ingestFeeds(makeContext(db), withFeed(FEED, deadFetch));
    await second.faviconAcquisition;

    const favicons = await getFavicons(db, {});
    expect(favicons["site-a.com"]).toBe(pngDataUri(PNG_BYTES));
  });

  test("does not retry a negative-cached hostname inside the retry window", async () => {
    const first = await ingestFeeds(makeContext(db), withFeed(FEED, deadFetch));
    await first.faviconAcquisition;
    setFaviconFetchedAt(db, "site-a.com", daysAgo(FAVICON_NEGATIVE_RETRY_DAYS - 1));

    const iconCalls: string[] = [];
    const second = await ingestFeeds(makeContext(db), withFeed(FEED, makeIconFetch(iconCalls)));
    await second.faviconAcquisition;

    expect(iconCalls).toHaveLength(0);
    const favicons = await getFavicons(db, {});
    expect(favicons["site-a.com"]).toBeUndefined();
  });

  test("retries a negative-cached hostname after the retry window", async () => {
    const first = await ingestFeeds(makeContext(db), withFeed(FEED, deadFetch));
    await first.faviconAcquisition;
    setFaviconFetchedAt(db, "site-a.com", daysAgo(FAVICON_NEGATIVE_RETRY_DAYS + 1));

    const second = await ingestFeeds(makeContext(db), withFeed(FEED, makeIconFetch()));
    await second.faviconAcquisition;

    const favicons = await getFavicons(db, {});
    expect(favicons["site-a.com"]).toBe(pngDataUri(PNG_BYTES));
  });

  test("remains idempotent across repeated ingests", async () => {
    const first = await ingestFeeds(makeContext(db), withFeed(FEED, makeIconFetch()));
    await first.faviconAcquisition;

    const iconCalls: string[] = [];
    const second = await ingestFeeds(makeContext(db), withFeed(FEED, makeIconFetch(iconCalls)));
    await second.faviconAcquisition;

    expect(second.newEntries).toHaveLength(0);
    expect(iconCalls).toHaveLength(0);
    const entries = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM rss_entries").get();
    expect(entries?.n).toBe(1);
    const favicons = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM rss_favicons").get();
    expect(favicons?.n).toBe(1);
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

    const result = await ingestFeeds(ctx, withFeed(FEED, deadFetch));
    await result.faviconAcquisition;

    expect(result.fetched).toBe(1);
    expect(result.newEntries).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("avicon");
  });
});
