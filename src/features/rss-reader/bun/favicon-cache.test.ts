import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { acquireFavicons, FAVICON_NEGATIVE_RETRY_DAYS, FAVICON_TTL_DAYS } from "./favicon-cache";
import { rssReaderMigrations } from "./migrations";
import { getFavicons } from "./queries";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const OLD_PNG_BYTES = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

const deadFetch: FetchFn = async () => {
  throw new Error("Network down");
};

function seedIconRow(db: Database, hostname: string, iconData: Uint8Array | null, fetchedAt: string): void {
  db.query("INSERT INTO rss_favicons (hostname, icon_data, content_type, fetched_at) VALUES (?, ?, ?, ?)").run(
    hostname,
    iconData,
    iconData ? "image/png" : null,
    fetchedAt,
  );
}

type FetchFn = (url: URL | RequestInfo, init?: RequestInit) => Promise<Response>;

function urlOf(input: URL | RequestInfo): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function makeIconFetch(calls: string[]): FetchFn {
  return async (input) => {
    const url = urlOf(input);
    calls.push(url);
    if (url.endsWith("/favicon.ico")) {
      return new Response(PNG_BYTES, { headers: { "content-type": "image/png" } });
    }
    return new Response("<html></html>", { headers: { "content-type": "text/html" } });
  };
}

describe("acquireFavicons", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    bootstrapMigrationsTable(db);
    runMigrations(db, "rss-reader", rssReaderMigrations);
  });

  test("stores an icon row for each hostname", async () => {
    await acquireFavicons(db, ["site-a.com", "site-b.com"], makeIconFetch([]));

    const rows = db
      .query<{ hostname: string; icon_data: Uint8Array; content_type: string }, []>(
        "SELECT hostname, icon_data, content_type FROM rss_favicons ORDER BY hostname",
      )
      .all();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.hostname).toBe("site-a.com");
    expect(new Uint8Array(rows[0]?.icon_data ?? [])).toEqual(PNG_BYTES);
    expect(rows[0]?.content_type).toBe("image/png");
  });

  test("writes a negative row when the lookup fails", async () => {
    await acquireFavicons(db, ["dead-host.com"], deadFetch);

    const row = db
      .query<{ hostname: string; icon_data: Uint8Array | null; fetched_at: string }, [string]>(
        "SELECT hostname, icon_data, fetched_at FROM rss_favicons WHERE hostname = ?",
      )
      .get("dead-host.com");
    expect(row?.hostname).toBe("dead-host.com");
    expect(row?.icon_data).toBeNull();
    expect(row?.fetched_at).toBeTruthy();
  });

  test("does not re-fetch hostnames already in the cache", async () => {
    const calls: string[] = [];
    await acquireFavicons(db, ["site-a.com"], makeIconFetch(calls));
    const callsAfterFirst = calls.length;

    await acquireFavicons(db, ["site-a.com"], makeIconFetch(calls));

    expect(calls.length).toBe(callsAfterFirst);
    const count = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM rss_favicons").get();
    expect(count?.n).toBe(1);
  });

  test("does not re-fetch hostnames with a cached negative row", async () => {
    await acquireFavicons(db, ["dead-host.com"], deadFetch);

    const calls: string[] = [];
    await acquireFavicons(db, ["dead-host.com"], makeIconFetch(calls));

    expect(calls).toHaveLength(0);
  });

  test("re-fetches an icon whose fetched-at is older than the TTL", async () => {
    seedIconRow(db, "site-a.com", OLD_PNG_BYTES, daysAgo(FAVICON_TTL_DAYS + 1));

    await acquireFavicons(db, ["site-a.com"], makeIconFetch([]));

    const row = db
      .query<{ icon_data: Uint8Array; fetched_at: string }, [string]>(
        "SELECT icon_data, fetched_at FROM rss_favicons WHERE hostname = ?",
      )
      .get("site-a.com");
    expect(new Uint8Array(row?.icon_data ?? [])).toEqual(PNG_BYTES);
    expect(Date.parse(row?.fetched_at ?? "")).toBeGreaterThan(Date.now() - DAY_MS);
  });

  test("does not re-fetch an icon still inside the TTL", async () => {
    seedIconRow(db, "site-a.com", OLD_PNG_BYTES, daysAgo(FAVICON_TTL_DAYS - 1));

    const calls: string[] = [];
    await acquireFavicons(db, ["site-a.com"], makeIconFetch(calls));

    expect(calls).toHaveLength(0);
  });

  test("keeps serving the stale icon when a refresh fails", async () => {
    seedIconRow(db, "site-a.com", OLD_PNG_BYTES, daysAgo(FAVICON_TTL_DAYS + 1));

    await acquireFavicons(db, ["site-a.com"], deadFetch);

    const favicons = await getFavicons(db, {});
    expect(favicons["site-a.com"]).toBe(`data:image/png;base64,${Buffer.from(OLD_PNG_BYTES).toString("base64")}`);
  });

  test("does not re-attempt a failed refresh on the next acquisition", async () => {
    seedIconRow(db, "site-a.com", OLD_PNG_BYTES, daysAgo(FAVICON_TTL_DAYS + 1));
    await acquireFavicons(db, ["site-a.com"], deadFetch);

    const calls: string[] = [];
    await acquireFavicons(db, ["site-a.com"], makeIconFetch(calls));

    expect(calls).toHaveLength(0);
  });

  test("retries a negative-cached hostname after the retry window", async () => {
    seedIconRow(db, "was-dead.com", null, daysAgo(FAVICON_NEGATIVE_RETRY_DAYS + 1));

    await acquireFavicons(db, ["was-dead.com"], makeIconFetch([]));

    const favicons = await getFavicons(db, {});
    expect(favicons["was-dead.com"]).toBe(`data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`);
  });

  test("does not retry a negative-cached hostname inside the retry window", async () => {
    seedIconRow(db, "was-dead.com", null, daysAgo(FAVICON_NEGATIVE_RETRY_DAYS - 1));

    const calls: string[] = [];
    await acquireFavicons(db, ["was-dead.com"], makeIconFetch(calls));

    expect(calls).toHaveLength(0);
  });

  test("re-arms the retry window when a negative retry fails again", async () => {
    seedIconRow(db, "still-dead.com", null, daysAgo(FAVICON_NEGATIVE_RETRY_DAYS + 1));
    await acquireFavicons(db, ["still-dead.com"], deadFetch);

    const calls: string[] = [];
    await acquireFavicons(db, ["still-dead.com"], makeIconFetch(calls));

    expect(calls).toHaveLength(0);
  });

  test("fetches a duplicated hostname at most once", async () => {
    const calls: string[] = [];
    await acquireFavicons(db, ["site-a.com", "site-a.com", "site-a.com"], makeIconFetch(calls));

    const rootCalls = calls.filter((url) => url === "https://site-a.com/");
    expect(rootCalls).toHaveLength(1);
  });
});
