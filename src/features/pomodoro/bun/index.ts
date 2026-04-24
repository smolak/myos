import type { FeatureDefinition } from "@core/types";
import type { PomodoroEvents, PomodoroActions, PomodoroQueries } from "../shared/types";
import { pomodoroMigrations } from "./migrations";
import { startSession, pauseSession, resumeSession, completeSession, cancelSession } from "./actions";
import { getCurrentSession, getSessionHistory } from "./queries";

export const pomodoroFeature: FeatureDefinition<PomodoroEvents, PomodoroActions, PomodoroQueries> = {
  id: "pomodoro",
  name: "Pomodoro",
  version: "1.0.0",
  migrations: pomodoroMigrations,

  manifest: {
    events: {
      "pomodoro:session-started": {
        description: "A new pomodoro session was started",
        payload: { id: "string", type: "string", durationSeconds: "number" },
      },
      "pomodoro:session-paused": {
        description: "A pomodoro session was paused",
        payload: { id: "string", elapsedSeconds: "number" },
      },
      "pomodoro:session-resumed": {
        description: "A paused pomodoro session was resumed",
        payload: { id: "string" },
      },
      "pomodoro:session-ended": {
        description: "A pomodoro session completed successfully",
        payload: { id: "string", type: "string", durationSeconds: "number" },
      },
      "pomodoro:session-cancelled": {
        description: "A pomodoro session was cancelled",
        payload: { id: "string" },
      },
    },
    actions: {
      start: {
        description: "Start a new pomodoro session",
        params: { type: "string?", durationSeconds: "number?" },
        result: { id: "string" },
      },
      pause: {
        description: "Pause the current pomodoro session",
        params: { id: "string", elapsedSeconds: "number" },
        result: { success: "boolean" },
      },
      resume: {
        description: "Resume a paused pomodoro session",
        params: { id: "string" },
        result: { success: "boolean" },
      },
      complete: {
        description: "Mark a pomodoro session as completed",
        params: { id: "string", elapsedSeconds: "number?" },
        result: { success: "boolean" },
      },
      cancel: {
        description: "Cancel a pomodoro session",
        params: { id: "string" },
        result: { success: "boolean" },
      },
    },
    queries: {
      "get-current": {
        description: "Get the current running or paused session",
        params: {},
        result: "PomodoroSession | null",
      },
      "get-history": {
        description: "Get completed sessions",
        params: { limit: "number?" },
        result: "PomodoroSession[]",
      },
    },
    permissions: [],
    scheduledTasks: [],
    widgets: [
      {
        id: "timer",
        name: "Pomodoro Timer",
        sizes: ["small", "medium"],
        description: "Countdown timer with start/pause/reset controls",
      },
    ],
    commands: [
      {
        id: "start-work-session",
        label: "Start Work Session",
        description: "Start a 25-minute work session",
      },
      {
        id: "start-break-session",
        label: "Start Break Session",
        description: "Start a 5-minute break session",
      },
    ],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("start", async (params, _meta) => {
      const result = await startSession(ctx.db, params);
      const row = ctx.db
        .query<{ type: string; duration_seconds: number }, [string]>(
          "SELECT type, duration_seconds FROM pomodoro_sessions WHERE id = ?",
        )
        .get(result.id);
      if (row) {
        ctx.events.emit("pomodoro:session-started", {
          id: result.id,
          type: row.type as "work" | "break",
          durationSeconds: row.duration_seconds,
        });
      }
      return result;
    });

    ctx.actions.handle("pause", async (params, _meta) => {
      const result = await pauseSession(ctx.db, params);
      if (result.success) {
        ctx.events.emit("pomodoro:session-paused", {
          id: params.id,
          elapsedSeconds: params.elapsedSeconds,
        });
      }
      return result;
    });

    ctx.actions.handle("resume", async (params, _meta) => {
      const result = await resumeSession(ctx.db, params);
      if (result.success) {
        ctx.events.emit("pomodoro:session-resumed", { id: params.id });
      }
      return result;
    });

    ctx.actions.handle("complete", async (params, _meta) => {
      const row = ctx.db
        .query<{ type: string; duration_seconds: number }, [string]>(
          "SELECT type, duration_seconds FROM pomodoro_sessions WHERE id = ?",
        )
        .get(params.id);
      const result = await completeSession(ctx.db, params);
      if (result.success && row) {
        ctx.events.emit("pomodoro:session-ended", {
          id: params.id,
          type: row.type as "work" | "break",
          durationSeconds: row.duration_seconds,
        });
      }
      return result;
    });

    ctx.actions.handle("cancel", async (params, _meta) => {
      const result = await cancelSession(ctx.db, params);
      if (result.success) {
        ctx.events.emit("pomodoro:session-cancelled", { id: params.id });
      }
      return result;
    });

    ctx.queries.handle("get-current", async (params) => {
      return getCurrentSession(ctx.db, params);
    });

    ctx.queries.handle("get-history", async (params) => {
      return getSessionHistory(ctx.db, params);
    });
  },

  async deactivate() {},

  async uninstall(_ctx) {},
};
