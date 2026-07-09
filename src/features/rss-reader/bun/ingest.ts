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
}

export interface IngestResult {
  readonly fetched: number;
  readonly newEntries: NewEntry[];
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

  // Fire-and-forget: favicon failures must never delay or fail the feed pipeline
  void acquireFavicons(ctx.db, distinctHostnames(newEntries), fetchFn).catch(() => {});

  return { fetched, newEntries };
}

function distinctHostnames(entries: readonly NewEntry[]): string[] {
  const hostnames = new Set<string>();
  for (const entry of entries) {
    try {
      hostnames.add(new URL(entry.link).hostname);
    } catch {
      // Entries whose link is not a valid URL get no favicon
    }
  }
  return [...hostnames];
}
