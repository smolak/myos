import type { Database } from "bun:sqlite";
import type { RssReaderEvents } from "../shared/types";
import type { FetchFn, NewEntry } from "./actions";
import { fetchAllFeeds } from "./actions";
import { acquireFavicons } from "./favicon-cache";

export interface IngestContext {
  readonly db: Database;
  readonly events: {
    emit(event: "rss:new-entry", payload: RssReaderEvents["rss:new-entry"]): void;
  };
  readonly log: {
    warn(message: string, ...args: unknown[]): void;
  };
}

export interface IngestResult {
  readonly fetched: number;
  readonly newEntries: NewEntry[];
  /** Settles when background favicon acquisition finishes; never rejects. */
  readonly faviconAcquisition: Promise<void>;
}

export async function ingestFeeds(ctx: IngestContext, fetchFn: FetchFn = fetch): Promise<IngestResult> {
  const { fetched, newEntries } = await fetchAllFeeds(ctx.db, fetchFn);

  for (const entry of newEntries) {
    ctx.events.emit("rss:new-entry", {
      entryId: entry.id,
      feedId: entry.feedId,
      title: entry.title,
      link: entry.link,
    });
  }

  // Fire-and-forget: favicon failures must never delay or fail the feed pipeline.
  // All stored entries' hostnames are considered — not just this run's new entries —
  // so stale icons refresh and expired negative rows retry even on quiet feeds.
  const faviconAcquisition = acquireFavicons(ctx.db, listEntryHostnames(ctx.db), fetchFn).catch((error) => {
    ctx.log.warn("Favicon acquisition failed", error);
  });

  return { fetched, newEntries, faviconAcquisition };
}

function listEntryHostnames(db: Database): string[] {
  const links = db.query<{ link: string }, []>("SELECT DISTINCT link FROM rss_entries").all();
  const hostnames = new Set<string>();
  for (const { link } of links) {
    try {
      hostnames.add(new URL(link).hostname);
    } catch {
      // Entries whose link is not a valid URL get no favicon
    }
  }
  return [...hostnames];
}
