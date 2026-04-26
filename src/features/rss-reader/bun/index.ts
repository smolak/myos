import type { FeatureDefinition } from "@core/types";
import type { RssReaderActions, RssReaderEvents, RssReaderQueries } from "../shared/types";
import { addFeed, deleteFeed, fetchAllFeeds, markRead, markUnread } from "./actions";
import { rssReaderMigrations } from "./migrations";
import { getEntries, getFeeds, getUnreadCount } from "./queries";
import { searchRssEntries } from "./search";

const FETCH_INTERVAL_MS = 30 * 60 * 1000;

export const rssReaderFeature: FeatureDefinition<RssReaderEvents, RssReaderActions, RssReaderQueries> = {
  id: "rss-reader",
  name: "RSS Reader",
  version: "1.0.0",
  migrations: rssReaderMigrations,

  manifest: {
    events: {
      "rss:feed-added": {
        description: "A new RSS feed was added",
        payload: { feedId: "string", url: "string" },
      },
      "rss:feed-deleted": {
        description: "An RSS feed was deleted",
        payload: { feedId: "string" },
      },
      "rss:new-entry": {
        description: "A new RSS entry was fetched and stored",
        payload: { entryId: "string", feedId: "string", title: "string", link: "string" },
      },
      "rss:entry-read": {
        description: "An RSS entry was marked as read",
        payload: { entryId: "string", feedId: "string" },
      },
    },
    actions: {
      "add-feed": {
        description: "Add a new RSS feed URL",
        params: { url: "string", title: "string?", fetchIntervalMinutes: "number?" },
        result: { id: "string" },
      },
      "delete-feed": {
        description: "Remove an RSS feed and all its entries",
        params: { id: "string" },
        result: { success: "boolean" },
      },
      "fetch-feeds": {
        description: "Fetch new entries from all configured feeds",
        params: {},
        result: { fetched: "number", newEntries: "number" },
      },
      "mark-read": {
        description: "Mark an RSS entry as read",
        params: { id: "string" },
        result: { success: "boolean" },
      },
      "mark-unread": {
        description: "Mark an RSS entry as unread",
        params: { id: "string" },
        result: { success: "boolean" },
      },
    },
    queries: {
      "get-feeds": {
        description: "Get all configured RSS feeds",
        params: {},
        result: "RssFeed[]",
      },
      "get-entries": {
        description: "Get RSS entries, optionally filtered by feed or read status",
        params: { feedId: "string?", unreadOnly: "boolean?", limit: "number?" },
        result: "RssEntry[]",
      },
      "get-unread-count": {
        description: "Get total number of unread entries",
        params: {},
        result: { count: "number" },
      },
      search: {
        description: "Search RSS entries by title or description",
        params: { query: "string" },
        result: "FeatureSearchResult[]",
      },
    },
    permissions: [{ type: "network", reason: "Fetch RSS feeds from the internet" }],
    scheduledTasks: [
      {
        id: "rss-reader:fetch-feeds",
        defaultSchedule: { type: "interval", value: FETCH_INTERVAL_MS },
        description: "Periodically fetch new entries from all RSS feeds",
      },
    ],
    widgets: [
      {
        id: "feed-list",
        name: "RSS Reader",
        sizes: ["medium", "wide"],
        description: "Shows recent RSS feed entries",
      },
    ],
    commands: [
      {
        id: "add-feed",
        label: "Add RSS Feed",
        description: "Add a new RSS feed URL to the reader",
      },
    ],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("add-feed", async (params, _meta) => {
      const result = await addFeed(ctx.db, params);
      ctx.events.emit("rss:feed-added", { feedId: result.id, url: params.url });
      return result;
    });

    ctx.actions.handle("delete-feed", async (params, _meta) => {
      const result = await deleteFeed(ctx.db, params);
      if (result.success) {
        ctx.events.emit("rss:feed-deleted", { feedId: params.id });
      }
      return result;
    });

    ctx.actions.handle("fetch-feeds", async (_params, _meta) => {
      const { fetched, newEntries } = await fetchAllFeeds(ctx.db);
      for (const entry of newEntries) {
        ctx.events.emit("rss:new-entry", {
          entryId: entry.id,
          feedId: entry.feedId,
          title: entry.title,
          link: entry.link,
        });
      }
      return { fetched, newEntries: newEntries.length };
    });

    ctx.actions.handle("mark-read", async (params, _meta) => {
      const entryRow = ctx.db
        .query<{ feed_id: string }, [string]>("SELECT feed_id FROM rss_entries WHERE id = ?")
        .get(params.id);
      const result = await markRead(ctx.db, params);
      if (result.success && entryRow) {
        ctx.events.emit("rss:entry-read", { entryId: params.id, feedId: entryRow.feed_id });
      }
      return result;
    });

    ctx.actions.handle("mark-unread", async (params, _meta) => {
      return markUnread(ctx.db, params);
    });

    ctx.queries.handle("get-feeds", async (params) => {
      return getFeeds(ctx.db, params);
    });

    ctx.queries.handle("get-entries", async (params) => {
      return getEntries(ctx.db, params);
    });

    ctx.queries.handle("get-unread-count", async (params) => {
      return getUnreadCount(ctx.db, params);
    });

    ctx.queries.handle("search", async (params) => {
      return searchRssEntries(ctx.db, params);
    });

    ctx.scheduler.register("rss-reader:fetch-feeds", { type: "interval", value: FETCH_INTERVAL_MS }, async () => {
      const { fetched, newEntries } = await fetchAllFeeds(ctx.db);
      for (const entry of newEntries) {
        ctx.events.emit("rss:new-entry", {
          entryId: entry.id,
          feedId: entry.feedId,
          title: entry.title,
          link: entry.link,
        });
      }
      ctx.log.info(`Fetched ${fetched} feeds, ${newEntries.length} new entries`);
    });
  },

  async deactivate() {},

  async uninstall(_ctx) {},
};
