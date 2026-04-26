import type { FeatureDefinition } from "@core/types";
import type { HabitsActions, HabitsEvents, HabitsQueries } from "../shared/types";
import { completeHabit, createHabit, deleteHabit, uncompleteHabit } from "./actions";
import { habitsMigrations } from "./migrations";
import { getAllHabits, getHabitById, getHabitHistory } from "./queries";
import { searchHabits } from "./search";

export const habitsFeature: FeatureDefinition<HabitsEvents, HabitsActions, HabitsQueries> = {
  id: "habits",
  name: "Habits",
  version: "1.0.0",
  migrations: habitsMigrations,

  manifest: {
    events: {
      "habits:completed": {
        description: "A habit was completed for the day",
        payload: { id: "string", name: "string", date: "string" },
      },
    },
    actions: {
      create: {
        description: "Create a new habit",
        params: { name: "string", description: "string?", frequency: "string?" },
        result: { id: "string" },
      },
      delete: {
        description: "Delete a habit and all its completions",
        params: { id: "string" },
        result: { success: "boolean" },
      },
      complete: {
        description: "Mark a habit as completed for a given date",
        params: { id: "string", date: "string" },
        result: { success: "boolean" },
      },
      uncomplete: {
        description: "Remove a completion record for a given date",
        params: { id: "string", date: "string" },
        result: { success: "boolean" },
      },
    },
    queries: {
      "get-all": {
        description: "Get all habits with today's completion status and streak data",
        params: { date: "string?" },
        result: "HabitWithStats[]",
      },
      "get-by-id": {
        description: "Get a single habit with stats",
        params: { id: "string", date: "string?" },
        result: "HabitWithStats | null",
      },
      "get-history": {
        description: "Get all completion records for a habit",
        params: { id: "string" },
        result: "HabitCompletion[]",
      },
      search: {
        description: "Search habits by name or description",
        params: { query: "string" },
        result: "FeatureSearchResult[]",
      },
    },
    permissions: [],
    scheduledTasks: [],
    widgets: [
      {
        id: "daily-checkin",
        name: "Habits",
        sizes: ["medium"],
        description: "Shows today's habits with completion status",
      },
    ],
    commands: [
      {
        id: "open-habits",
        label: "Open Habits",
        description: "View and manage your daily habits",
      },
    ],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("create", async (params, _meta) => {
      return createHabit(ctx.db, params);
    });

    ctx.actions.handle("delete", async (params, _meta) => {
      return deleteHabit(ctx.db, params);
    });

    ctx.actions.handle("complete", async (params, _meta) => {
      const result = await completeHabit(ctx.db, params);
      if (result.success) {
        const habit = await getHabitById(ctx.db, { id: params.id });
        if (habit) {
          ctx.events.emit("habits:completed", { id: params.id, name: habit.name, date: params.date });
        }
      }
      return result;
    });

    ctx.actions.handle("uncomplete", async (params, _meta) => {
      return uncompleteHabit(ctx.db, params);
    });

    ctx.queries.handle("get-all", async (params) => {
      return getAllHabits(ctx.db, params);
    });

    ctx.queries.handle("get-by-id", async (params) => {
      return getHabitById(ctx.db, params);
    });

    ctx.queries.handle("get-history", async (params) => {
      return getHabitHistory(ctx.db, params);
    });

    ctx.queries.handle("search", async (params) => {
      return searchHabits(ctx.db, params);
    });
  },

  async deactivate() {},

  async uninstall(_ctx) {},
};
