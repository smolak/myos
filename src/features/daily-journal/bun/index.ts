import type { FeatureDefinition } from "@core/types";
import type { DailyJournalActions, DailyJournalEvents, DailyJournalQueries } from "../shared/types";
import { addNote, deleteNote, updateNote } from "./actions";
import { dailyJournalMigrations } from "./migrations";
import { getNoteByDate, getNotes } from "./queries";
import { searchJournalNotes } from "./search";

export const dailyJournalFeature: FeatureDefinition<DailyJournalEvents, DailyJournalActions, DailyJournalQueries> = {
  id: "daily-journal",
  name: "Daily Journal",
  version: "1.0.0",
  migrations: dailyJournalMigrations,

  manifest: {
    events: {
      "journal:note-created": {
        description: "A journal note was created",
        payload: { id: "string", date: "string" },
      },
      "journal:note-updated": {
        description: "A journal note was updated",
        payload: { id: "string", date: "string" },
      },
      "journal:note-deleted": {
        description: "A journal note was deleted",
        payload: { id: "string" },
      },
    },
    actions: {
      "add-note": {
        description: "Add a free-text note for a day",
        params: { date: "string", content: "string" },
        result: { id: "string" },
      },
      "update-note": {
        description: "Update an existing note",
        params: { id: "string", content: "string" },
        result: { success: "boolean" },
      },
      "delete-note": {
        description: "Delete a note",
        params: { id: "string" },
        result: { success: "boolean" },
      },
    },
    queries: {
      "get-notes": {
        description: "Get notes with optional search and limit",
        params: { limit: "number?", search: "string?" },
        result: "JournalNote[]",
      },
      "get-note-by-date": {
        description: "Get note for a specific date",
        params: { date: "string" },
        result: "JournalNote | null",
      },
      search: {
        description: "Search journal notes by content",
        params: { query: "string" },
        result: "FeatureSearchResult[]",
      },
    },
    permissions: [],
    scheduledTasks: [],
    widgets: [
      {
        id: "summary",
        name: "Daily Journal",
        sizes: ["wide"],
        description: "Shows today's activity and note",
      },
    ],
    commands: [
      {
        id: "open-journal",
        label: "Open Daily Journal",
        description: "View today's activity timeline and write notes",
      },
    ],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("add-note", async (params, _meta) => {
      const result = await addNote(ctx.db, params);
      ctx.events.emit("journal:note-created", { id: result.id, date: params.date });
      return result;
    });

    ctx.actions.handle("update-note", async (params, _meta) => {
      const existing = ctx.db
        .query<{ date: string }, [string]>("SELECT date FROM journal_notes WHERE id = ?")
        .get(params.id);
      const result = await updateNote(ctx.db, params);
      if (result.success && existing) {
        ctx.events.emit("journal:note-updated", { id: params.id, date: existing.date });
      }
      return result;
    });

    ctx.actions.handle("delete-note", async (params, _meta) => {
      const result = await deleteNote(ctx.db, params);
      if (result.success) {
        ctx.events.emit("journal:note-deleted", { id: params.id });
      }
      return result;
    });

    ctx.queries.handle("get-notes", async (params) => {
      return getNotes(ctx.db, params);
    });

    ctx.queries.handle("get-note-by-date", async (params) => {
      return getNoteByDate(ctx.db, params);
    });

    ctx.queries.handle("search", async (params) => {
      return searchJournalNotes(ctx.db, params);
    });
  },

  async deactivate() {},

  async uninstall(_ctx) {},
};
