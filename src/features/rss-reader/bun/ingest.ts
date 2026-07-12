import type { Database } from "bun:sqlite";
import type { RssReaderEvents } from "../shared/types";
import type { FetchFn, NewEntry } from "./actions";
import { fetchAllFeeds } from "./actions";
import { acquireFavicons } from "./favicon-cache";

export interface IngestContext {
  readonly db: Database;
  readonly events: {
    emit<K extends "rss:new-entry" | "rss:ingest-completed">(event: K, payload: RssReaderEvents[K]): void;
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

  // One signal per Ingest, sent as soon as entries are stored: views coalesce on this,
  // and it must never wait on favicon acquisition below (which carries no timeout).
  ctx.events.emit("rss:ingest-completed", { fetched, newEntries: newEntries.length });

  // Runs in the background and never rejects: favicon failures must never delay or fail
  // the feed pipeline; callers observe completion via the returned faviconAcquisition.
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
