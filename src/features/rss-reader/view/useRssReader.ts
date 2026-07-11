import { rpc } from "@shell/view/electrobun";
import { useCallback, useEffect, useState } from "react";
import type { FaviconMap, RssEntry, RssFeed } from "../shared/types";

// Type aliases preserved for component compatibility
export type StoredFeed = RssFeed;
export type StoredEntry = RssEntry;

export interface UseRssReaderReturn {
  readonly feeds: readonly RssFeed[];
  readonly entries: readonly RssEntry[];
  readonly favicons: FaviconMap;
  readonly unreadCount: number;
  readonly isLoading: boolean;
  addFeed(url: string): Promise<void>;
  deleteFeed(id: string): Promise<void>;
  markRead(id: string): Promise<void>;
  markUnread(id: string): Promise<void>;
  refresh(): Promise<void>;
}

export function useRssReader(): UseRssReaderReturn {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [entries, setEntries] = useState<RssEntry[]>([]);
  const [favicons, setFavicons] = useState<FaviconMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const reloadAll = useCallback(async () => {
    const [feedList, entryList, faviconMap] = await Promise.all([
      rpc.request["rss:get-feeds"]({}),
      rpc.request["rss:get-entries"]({}),
      // Favicons are purely additive: a failed lookup degrades to placeholders
      // instead of blocking feeds and entries
      rpc.request["rss:get-favicons"]({}).catch((): FaviconMap => ({})),
    ]);
    setFeeds(feedList as RssFeed[]);
    setEntries(entryList as RssEntry[]);
    setFavicons(faviconMap);
  }, []);

  useEffect(() => {
    void (async () => {
      await reloadAll();
      setIsLoading(false);
      // Startup fetch: pull fresh entries from network, then show them
      await rpc.request["rss:fetch-feeds"]({}).catch(() => {});
      await reloadAll();
    })();
  }, [reloadAll]);

  // React to background Ingests pushed from the bun side; deliberately no
  // isLoading toggle — a background refresh must never flicker the view
  useEffect(() => {
    const handler = () => void reloadAll();
    rpc.addMessageListener("rss:ingest-completed", handler);
    return () => rpc.removeMessageListener("rss:ingest-completed", handler);
  }, [reloadAll]);

  const addFeed = useCallback(
    async (url: string) => {
      setIsLoading(true);
      try {
        await rpc.request["rss:add-feed"]({ url });
        await rpc.request["rss:fetch-feeds"]({});
        await reloadAll();
      } finally {
        setIsLoading(false);
      }
    },
    [reloadAll],
  );

  const deleteFeed = useCallback(
    async (id: string) => {
      await rpc.request["rss:delete-feed"]({ id });
      await reloadAll();
    },
    [reloadAll],
  );

  const markRead = useCallback(async (id: string) => {
    await rpc.request["rss:mark-read"]({ id });
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, isRead: true } : e)));
  }, []);

  const markUnread = useCallback(async (id: string) => {
    await rpc.request["rss:mark-unread"]({ id });
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, isRead: false } : e)));
  }, []);

  const refresh = useCallback(async () => {
    if (feeds.length === 0) return;
    setIsLoading(true);
    try {
      await rpc.request["rss:fetch-feeds"]({});
      await reloadAll();
    } finally {
      setIsLoading(false);
    }
  }, [feeds.length, reloadAll]);

  const unreadCount = entries.filter((e) => !e.isRead).length;

  return { feeds, entries, favicons, unreadCount, isLoading, addFeed, deleteFeed, markRead, markUnread, refresh };
}
