import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { acquireFavicons } from "./favicon-cache";
import { rssReaderMigrations } from "./migrations";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

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
    const deadFetch: FetchFn = async () => {
      throw new Error("Network down");
    };

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
    const deadFetch: FetchFn = async () => {
      throw new Error("Network down");
    };
    await acquireFavicons(db, ["dead-host.com"], deadFetch);

    const calls: string[] = [];
    await acquireFavicons(db, ["dead-host.com"], makeIconFetch(calls));

    expect(calls).toHaveLength(0);
  });

  test("fetches a duplicated hostname at most once", async () => {
    const calls: string[] = [];
    await acquireFavicons(db, ["site-a.com", "site-a.com", "site-a.com"], makeIconFetch(calls));

    const rootCalls = calls.filter((url) => url === "https://site-a.com/");
    expect(rootCalls).toHaveLength(1);
  });
});
