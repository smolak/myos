import type { FeatureDefinition } from "@core/types";
import type { BookmarksActions, BookmarksEvents, BookmarksQueries } from "../shared/types";
import { createBookmark, deleteBookmark, updateBookmark } from "./actions";
import { bookmarksMigrations } from "./migrations";
import { getAllBookmarks, getBookmarkById } from "./queries";
import { searchBookmarks } from "./search";

export const bookmarksFeature: FeatureDefinition<BookmarksEvents, BookmarksActions, BookmarksQueries> = {
  id: "bookmarks",
  name: "Bookmarks",
  version: "1.0.0",
  migrations: bookmarksMigrations,

  manifest: {
    events: {
      "bookmarks:added": {
        description: "A bookmark was added",
        payload: { id: "string", title: "string", url: "string" },
      },
    },
    actions: {
      create: {
        description: "Save a new bookmark",
        params: { title: "string", url: "string", description: "string?", folder: "string?", tags: "string[]?" },
        result: { id: "string" },
      },
      update: {
        description: "Update an existing bookmark",
        params: {
          id: "string",
          title: "string?",
          url: "string?",
          description: "string?",
          folder: "string?",
          tags: "string[]?",
        },
        result: { success: "boolean" },
      },
      delete: {
        description: "Delete a bookmark",
        params: { id: "string" },
        result: { success: "boolean" },
      },
    },
    queries: {
      "get-all": {
        description: "Get all bookmarks, optionally filtered by folder or tag",
        params: { folder: "string?", tag: "string?" },
        result: "Bookmark[]",
      },
      "get-by-id": {
        description: "Get a single bookmark by id",
        params: { id: "string" },
        result: "Bookmark | null",
      },
      search: {
        description: "Search bookmarks by title, description or url",
        params: { query: "string" },
        result: "FeatureSearchResult[]",
      },
    },
    permissions: [],
    scheduledTasks: [],
    widgets: [
      {
        id: "recent-list",
        name: "Bookmarks",
        sizes: ["medium"],
        description: "Shows recent saved bookmarks",
      },
    ],
    commands: [
      {
        id: "open-bookmarks",
        label: "Open Bookmarks",
        description: "View and manage your bookmarks",
      },
    ],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("create", async (params, _meta) => {
      const result = await createBookmark(ctx.db, params);
      ctx.events.emit("bookmarks:added", { id: result.id, title: params.title, url: params.url });
      return result;
    });

    ctx.actions.handle("update", async (params, _meta) => {
      return updateBookmark(ctx.db, params);
    });

    ctx.actions.handle("delete", async (params, _meta) => {
      return deleteBookmark(ctx.db, params);
    });

    ctx.queries.handle("get-all", async (params) => {
      return getAllBookmarks(ctx.db, params);
    });

    ctx.queries.handle("get-by-id", async (params) => {
      return getBookmarkById(ctx.db, params);
    });

    ctx.queries.handle("search", async (params) => {
      return searchBookmarks(ctx.db, params);
    });
  },

  async deactivate() {},

  async uninstall(_ctx) {},
};
