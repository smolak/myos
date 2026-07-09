import type { Database } from "bun:sqlite";
import type { FetchFn } from "./favicon-fetcher";
import { fetchFavicon } from "./favicon-fetcher";

export async function acquireFavicons(
  db: Database,
  hostnames: readonly string[],
  fetchFn: FetchFn = fetch,
): Promise<void> {
  for (const hostname of new Set(hostnames)) {
    const cached = db
      .query<{ hostname: string }, [string]>("SELECT hostname FROM rss_favicons WHERE hostname = ?")
      .get(hostname);
    if (cached) continue;

    const { iconData, contentType } = await fetchFavicon(hostname, fetchFn);
    db.query(
      "INSERT OR IGNORE INTO rss_favicons (hostname, icon_data, content_type, fetched_at) VALUES (?, ?, ?, ?)",
    ).run(hostname, iconData, contentType, new Date().toISOString());
  }
}
