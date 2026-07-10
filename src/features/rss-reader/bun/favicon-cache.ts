import type { Database } from "bun:sqlite";
import type { FetchFn } from "./favicon-fetcher";
import { fetchFavicon } from "./favicon-fetcher";

/** How long a cached icon is trusted before ingest re-fetches it. */
export const FAVICON_TTL_DAYS = 30;

/** How long a failed lookup (negative row) suppresses re-attempts for its hostname. */
export const FAVICON_NEGATIVE_RETRY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

interface CachedRow {
  readonly has_icon: number;
  readonly fetched_at: string;
}

export async function acquireFavicons(
  db: Database,
  hostnames: readonly string[],
  fetchFn: FetchFn = fetch,
): Promise<void> {
  const now = new Date();
  for (const hostname of new Set(hostnames)) {
    const cached = db
      .query<CachedRow, [string]>(
        "SELECT icon_data IS NOT NULL AS has_icon, fetched_at FROM rss_favicons WHERE hostname = ?",
      )
      .get(hostname);
    if (cached && isFresh(cached, now)) continue;

    const { iconData, contentType } = await fetchFavicon(hostname, fetchFn);
    // Stale beats blank: a failed refresh never downgrades an existing icon to a negative
    // row; bumping fetched_at defers the next attempt by a full TTL window
    if (iconData === null && cached?.has_icon) {
      db.query("UPDATE rss_favicons SET fetched_at = ? WHERE hostname = ?").run(now.toISOString(), hostname);
      continue;
    }

    db.query(
      `INSERT INTO rss_favicons (hostname, icon_data, content_type, fetched_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(hostname) DO UPDATE SET
				 icon_data = excluded.icon_data,
				 content_type = excluded.content_type,
				 fetched_at = excluded.fetched_at`,
    ).run(hostname, iconData, contentType, now.toISOString());
  }
}

function isFresh(cached: CachedRow, now: Date): boolean {
  const windowDays = cached.has_icon ? FAVICON_TTL_DAYS : FAVICON_NEGATIVE_RETRY_DAYS;
  return now.getTime() - Date.parse(cached.fetched_at) < windowDays * DAY_MS;
}
