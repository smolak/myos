import type { Database } from "bun:sqlite";
import { DAY_MS } from "./favicon-cache";
import type { FetchFn } from "./favicon-fetcher";

export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export function pngDataUri(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

export const deadFetch: FetchFn = async () => {
  throw new Error("Network down");
};

export function urlOf(input: URL | RequestInfo): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function makeIconFetch(calls?: string[]): FetchFn {
  return async (input) => {
    const url = urlOf(input);
    calls?.push(url);
    if (url.endsWith("/favicon.ico")) {
      return new Response(PNG_BYTES, { headers: { "content-type": "image/png" } });
    }
    return new Response("<html></html>", { headers: { "content-type": "text/html" } });
  };
}

export interface FeedStub {
  readonly url: string;
  readonly xml: string;
}

/** Answers the feed URL with the given XML; every other request goes to `inner`. */
export function withFeed(feed: FeedStub, inner: FetchFn): FetchFn {
  return async (input, init) => {
    if (urlOf(input) === feed.url) {
      return new Response(feed.xml, { headers: { "content-type": "application/rss+xml" } });
    }
    return inner(input, init);
  };
}

export interface SeedIconRowParams {
  readonly hostname: string;
  readonly iconData: Uint8Array | null;
  readonly fetchedAt: string;
}

export function seedIconRow(db: Database, { hostname, iconData, fetchedAt }: SeedIconRowParams): void {
  db.query("INSERT INTO rss_favicons (hostname, icon_data, content_type, fetched_at) VALUES (?, ?, ?, ?)").run(
    hostname,
    iconData,
    iconData ? "image/png" : null,
    fetchedAt,
  );
}
