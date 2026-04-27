import type { FeatureDefinition } from "@core/types";
import type { SnippetsActions, SnippetsEvents, SnippetsQueries } from "../shared/types";
import { createSnippet, deleteSnippet, updateSnippet } from "./actions";
import { snippetsMigrations } from "./migrations";
import { expandSnippet, getAllSnippets, getSnippetById } from "./queries";
import { searchSnippets } from "./search";

export const snippetsFeature: FeatureDefinition<SnippetsEvents, SnippetsActions, SnippetsQueries> = {
  id: "snippets",
  name: "Snippets",
  version: "1.0.0",
  migrations: snippetsMigrations,

  manifest: {
    events: {
      "snippet:expanded": {
        description: "A snippet was expanded and copied",
        payload: { id: "string", name: "string" },
      },
    },
    actions: {
      create: {
        description: "Create a new snippet",
        params: { name: "string", template: "string", isFavorite: "boolean?" },
        result: { id: "string" },
      },
      update: {
        description: "Update a snippet name, template, or favorite status",
        params: { id: "string", name: "string?", template: "string?", isFavorite: "boolean?" },
        result: { success: "boolean" },
      },
      delete: {
        description: "Delete a snippet permanently",
        params: { id: "string" },
        result: { success: "boolean" },
      },
    },
    queries: {
      "get-all": {
        description: "Get all snippets",
        params: { favoritesOnly: "boolean?" },
        result: "Snippet[]",
      },
      "get-by-id": {
        description: "Get a single snippet by id",
        params: { id: "string" },
        result: "Snippet | null",
      },
      expand: {
        description: "Expand a snippet template with variable substitution",
        params: { id: "string", clipboard: "string?" },
        result: "{ text: string }",
      },
      search: {
        description: "Search snippets by name or template content",
        params: { query: "string" },
        result: "FeatureSearchResult[]",
      },
    },
    permissions: [],
    scheduledTasks: [],
    widgets: [
      {
        id: "favorites",
        name: "Snippets",
        sizes: ["medium"],
        description: "Shows favorite snippets for quick access",
      },
    ],
    commands: [
      {
        id: "open-snippets",
        label: "Open Snippets",
        description: "View and manage text snippets",
      },
    ],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("create", async (params) => createSnippet(ctx.db, params));
    ctx.actions.handle("update", async (params) => updateSnippet(ctx.db, params));
    ctx.actions.handle("delete", async (params) => deleteSnippet(ctx.db, params));

    ctx.queries.handle("get-all", async (params) => getAllSnippets(ctx.db, params));
    ctx.queries.handle("get-by-id", async (params) => getSnippetById(ctx.db, params));
    ctx.queries.handle("expand", async (params) => expandSnippet(ctx.db, params));
    ctx.queries.handle("search", async (params) => searchSnippets(ctx.db, params));
  },

  async deactivate() {},
  async uninstall(_ctx) {},
};
