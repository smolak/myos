import type { ActionMap, EventMap, QueryMap } from "@core/types";

export interface RssFeed {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly description: string | null;
  readonly lastFetchedAt: string | null;
  readonly fetchIntervalMinutes: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RssEntry {
  readonly id: string;
  readonly feedId: string;
  readonly guid: string;
  readonly title: string;
  readonly link: string;
  readonly description: string | null;
  readonly publishedAt: string | null;
  readonly isRead: boolean;
  readonly createdAt: string;
}

export interface RssReaderEvents extends EventMap {
  "rss:feed-added": { feedId: string; url: string };
  "rss:feed-deleted": { feedId: string };
  "rss:new-entry": { entryId: string; feedId: string; title: string; link: string };
  "rss:entry-read": { entryId: string; feedId: string };
}

export interface RssReaderActions extends ActionMap {
  "add-feed": {
    params: { url: string; title?: string; fetchIntervalMinutes?: number };
    result: { id: string };
  };
  "delete-feed": {
    params: { id: string };
    result: { success: boolean };
  };
  "fetch-feeds": {
    params: Record<string, never>;
    result: { fetched: number; newEntries: number };
  };
  "mark-read": {
    params: { id: string };
    result: { success: boolean };
  };
  "mark-unread": {
    params: { id: string };
    result: { success: boolean };
  };
}

export interface RssReaderQueries extends QueryMap {
  "get-feeds": {
    params: Record<string, never>;
    result: readonly RssFeed[];
  };
  "get-entries": {
    params: { feedId?: string; unreadOnly?: boolean; limit?: number };
    result: readonly RssEntry[];
  };
  "get-unread-count": {
    params: Record<string, never>;
    result: { count: number };
  };
}
