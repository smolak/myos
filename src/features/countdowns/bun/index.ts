import type { FeatureDefinition } from "@core/types";
import type { CountdownsActions, CountdownsEvents, CountdownsQueries } from "../shared/types";
import { archiveCountdown, createCountdown, deleteCountdown } from "./actions";
import { countdownsMigrations } from "./migrations";
import { getAllCountdowns, getCountdownById } from "./queries";
import { searchCountdowns } from "./search";

export const countdownsFeature: FeatureDefinition<CountdownsEvents, CountdownsActions, CountdownsQueries> = {
  id: "countdowns",
  name: "Countdowns",
  version: "1.0.0",
  migrations: countdownsMigrations,

  manifest: {
    events: {
      "countdown:reached": {
        description: "A countdown has reached its target date",
        payload: { id: "string", name: "string" },
      },
    },
    actions: {
      create: {
        description: "Create a new countdown",
        params: { name: "string", targetDate: "string" },
        result: { id: "string" },
      },
      delete: {
        description: "Delete a countdown permanently",
        params: { id: "string" },
        result: { success: "boolean" },
      },
      archive: {
        description: "Archive a completed countdown",
        params: { id: "string" },
        result: { success: "boolean" },
      },
    },
    queries: {
      "get-all": {
        description: "Get all countdowns with time remaining",
        params: { includeArchived: "boolean?" },
        result: "CountdownWithTimeLeft[]",
      },
      "get-by-id": {
        description: "Get a single countdown with time remaining",
        params: { id: "string" },
        result: "CountdownWithTimeLeft | null",
      },
      search: {
        description: "Search countdowns by name",
        params: { query: "string" },
        result: "FeatureSearchResult[]",
      },
    },
    permissions: [],
    scheduledTasks: [],
    widgets: [
      {
        id: "upcoming",
        name: "Countdowns",
        sizes: ["medium"],
        description: "Shows upcoming countdown timers",
      },
    ],
    commands: [
      {
        id: "open-countdowns",
        label: "Open Countdowns",
        description: "View and manage countdown timers",
      },
    ],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("create", async (params, _meta) => {
      return createCountdown(ctx.db, params);
    });

    ctx.actions.handle("delete", async (params, _meta) => {
      return deleteCountdown(ctx.db, params);
    });

    ctx.actions.handle("archive", async (params, _meta) => {
      return archiveCountdown(ctx.db, params);
    });

    ctx.queries.handle("get-all", async (params) => {
      return getAllCountdowns(ctx.db, params);
    });

    ctx.queries.handle("get-by-id", async (params) => {
      return getCountdownById(ctx.db, params);
    });

    ctx.queries.handle("search", async (params) => {
      return searchCountdowns(ctx.db, params);
    });

    // Check hourly for countdowns that have reached their target date
    ctx.scheduler.register("countdowns:check-reached", { type: "interval", value: 60 * 60 * 1000 }, async () => {
      const now = new Date().toISOString();
      const reached = ctx.db
        .query<{ id: string; name: string }, [string]>(
          "SELECT id, name FROM countdowns WHERE archived_at IS NULL AND reached_notified_at IS NULL AND target_date <= ?",
        )
        .all(now);

      for (const row of reached) {
        ctx.events.emit("countdown:reached", { id: row.id, name: row.name });
        ctx.db
          .query("UPDATE countdowns SET reached_notified_at = ?, updated_at = ? WHERE id = ?")
          .run(now, now, row.id);
      }
    });
  },

  async deactivate() {},

  async uninstall(_ctx) {},
};
