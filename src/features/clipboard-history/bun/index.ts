import type { FeatureDefinition } from "@core/types";
import type { ClipboardHistoryActions, ClipboardHistoryEvents, ClipboardHistoryQueries } from "../shared/types";
import { addEntry, clearEntries, deleteEntry, detectContentType } from "./actions";
import { clipboardHistoryMigrations } from "./migrations";
import { getAllEntries, getMostRecentContent } from "./queries";
import { searchClipboardHistory } from "./search";

const POLL_INTERVAL_MS = 1000;

let pollTimer: ReturnType<typeof setInterval> | undefined;

export const clipboardHistoryFeature: FeatureDefinition<
  ClipboardHistoryEvents,
  ClipboardHistoryActions,
  ClipboardHistoryQueries
> = {
  id: "clipboard-history",
  name: "Clipboard History",
  version: "1.0.0",
  migrations: clipboardHistoryMigrations,

  manifest: {
    events: {
      "clipboard:copied": {
        description: "A new clipboard entry was captured",
        payload: { id: "string", content: "string", contentType: "string" },
      },
    },
    actions: {
      add: {
        description: "Add a clipboard entry",
        params: { content: "string", contentType: "string?" },
        result: { id: "string" },
      },
      delete: {
        description: "Delete a clipboard entry",
        params: { id: "string" },
        result: { success: "boolean" },
      },
      clear: {
        description: "Clear all clipboard history",
        params: {},
        result: { success: "boolean" },
      },
    },
    queries: {
      "get-all": {
        description: "Get clipboard history entries",
        params: { limit: "number?", search: "string?" },
        result: "ClipboardEntry[]",
      },
      search: {
        description: "Search clipboard history",
        params: { query: "string" },
        result: "FeatureSearchResult[]",
      },
    },
    permissions: [],
    scheduledTasks: [],
    widgets: [
      {
        id: "recent-clips",
        name: "Clipboard History",
        sizes: ["medium"],
        description: "Shows recent clipboard entries",
      },
    ],
    commands: [
      {
        id: "open-clipboard-history",
        label: "Open Clipboard History",
        description: "Browse and search clipboard history",
      },
    ],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("add", async (params) => {
      const result = await addEntry(ctx.db, params);
      ctx.events.emit("clipboard:copied", {
        id: result.id,
        content: params.content,
        contentType: params.contentType ?? detectContentType(params.content),
      });
      return result;
    });

    ctx.actions.handle("delete", async (params) => {
      return deleteEntry(ctx.db, params);
    });

    ctx.actions.handle("clear", async (_params) => {
      return clearEntries(ctx.db);
    });

    ctx.queries.handle("get-all", async (params) => {
      return getAllEntries(ctx.db, params);
    });

    ctx.queries.handle("search", async (params) => {
      return searchClipboardHistory(ctx.db, params);
    });

    // Poll the system clipboard for changes (macOS via pbpaste)
    let lastContent: string | null = await getMostRecentContent(ctx.db);

    const pollClipboard = async () => {
      try {
        const proc = Bun.spawn(["pbpaste"], { stdout: "pipe" });
        const content = (await new Response(proc.stdout).text()).trim();
        if (content && content !== lastContent) {
          lastContent = content;
          const result = await addEntry(ctx.db, { content });
          ctx.events.emit("clipboard:copied", {
            id: result.id,
            content,
            contentType: detectContentType(content),
          });
        }
      } catch {
        // Ignore clipboard read errors silently
      }
    };

    pollTimer = setInterval(() => void pollClipboard(), POLL_INTERVAL_MS);
  },

  async deactivate() {
    if (pollTimer !== undefined) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  },

  async uninstall(_ctx) {},
};
