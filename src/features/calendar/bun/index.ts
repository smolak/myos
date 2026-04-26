import type { FeatureDefinition } from "@core/types";
import type { CalendarActions, CalendarEvents, CalendarQueries } from "../shared/types";
import { addSource, deleteSource, syncAllSources } from "./actions";
import { calendarMigrations } from "./migrations";
import { getEvents, getEventsStartingSoon, getSources, getUpcoming, markNotified } from "./queries";
import { searchCalendarEvents } from "./search";

const SYNC_INTERVAL_MS = 60 * 60 * 1000;
const NOTIFICATION_CHECK_INTERVAL_MS = 60 * 1000;
const NOTIFICATION_WINDOW_MINUTES = 15;

export const calendarFeature: FeatureDefinition<CalendarEvents, CalendarActions, CalendarQueries> = {
  id: "calendar",
  name: "Calendar",
  version: "1.0.0",
  migrations: calendarMigrations,

  manifest: {
    events: {
      "calendar:source-added": {
        description: "A new calendar source was added",
        payload: { sourceId: "string", url: "string" },
      },
      "calendar:source-deleted": {
        description: "A calendar source was deleted",
        payload: { sourceId: "string" },
      },
      "calendar:synced": {
        description: "Calendar source was synced",
        payload: { sourceId: "string", newEvents: "number" },
      },
      "calendar:event-starting": {
        description: "A calendar event is about to start",
        payload: { eventId: "string", title: "string", startTime: "string" },
      },
    },
    actions: {
      "add-source": {
        description: "Add a new ICS calendar URL",
        params: { url: "string", title: "string?", syncIntervalMinutes: "number?" },
        result: { id: "string" },
      },
      "delete-source": {
        description: "Remove a calendar source and all its events",
        params: { id: "string" },
        result: { success: "boolean" },
      },
      "sync-all": {
        description: "Sync events from all configured calendar sources",
        params: {},
        result: { synced: "number", newEvents: "number" },
      },
    },
    queries: {
      "get-sources": {
        description: "Get all configured calendar sources",
        params: {},
        result: "CalendarSource[]",
      },
      "get-events": {
        description: "Get calendar events, optionally filtered by source, date range, or limit",
        params: { sourceId: "string?", from: "string?", to: "string?", limit: "number?" },
        result: "CalendarEvent[]",
      },
      "get-upcoming": {
        description: "Get upcoming events starting from now",
        params: { limit: "number?" },
        result: "CalendarEvent[]",
      },
      search: {
        description: "Search calendar events by title or description",
        params: { query: "string" },
        result: "FeatureSearchResult[]",
      },
    },
    permissions: [{ type: "network", reason: "Fetch ICS calendar feeds from the internet" }],
    scheduledTasks: [
      {
        id: "calendar:sync-all",
        defaultSchedule: { type: "interval", value: SYNC_INTERVAL_MS },
        description: "Periodically sync events from all calendar sources",
      },
      {
        id: "calendar:check-notifications",
        defaultSchedule: { type: "interval", value: NOTIFICATION_CHECK_INTERVAL_MS },
        description: "Check for calendar events starting soon and emit notification events",
      },
    ],
    widgets: [
      {
        id: "upcoming-events",
        name: "Calendar",
        sizes: ["medium", "wide"],
        description: "Shows upcoming calendar events",
      },
    ],
    commands: [
      {
        id: "add-calendar",
        label: "Add Calendar",
        description: "Add a new ICS calendar URL",
      },
    ],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("add-source", async (params, _meta) => {
      const result = await addSource(ctx.db, params);
      ctx.events.emit("calendar:source-added", { sourceId: result.id, url: params.url });
      return result;
    });

    ctx.actions.handle("delete-source", async (params, _meta) => {
      const result = await deleteSource(ctx.db, params);
      if (result.success) {
        ctx.events.emit("calendar:source-deleted", { sourceId: params.id });
      }
      return result;
    });

    ctx.actions.handle("sync-all", async (_params, _meta) => {
      const { synced, newEvents } = await syncAllSources(ctx.db);
      for (const event of newEvents) {
        ctx.events.emit("calendar:synced", { sourceId: event.sourceId, newEvents: 1 });
      }
      return { synced, newEvents: newEvents.length };
    });

    ctx.queries.handle("get-sources", async (params) => {
      return getSources(ctx.db, params);
    });

    ctx.queries.handle("get-events", async (params) => {
      return getEvents(ctx.db, params);
    });

    ctx.queries.handle("get-upcoming", async (params) => {
      return getUpcoming(ctx.db, params);
    });

    ctx.queries.handle("search", async (params) => {
      return searchCalendarEvents(ctx.db, params);
    });

    ctx.scheduler.register("calendar:sync-all", { type: "interval", value: SYNC_INTERVAL_MS }, async () => {
      const { synced, newEvents } = await syncAllSources(ctx.db);
      ctx.log.info(`Synced ${synced} sources, ${newEvents.length} new events`);
    });

    ctx.scheduler.register(
      "calendar:check-notifications",
      { type: "interval", value: NOTIFICATION_CHECK_INTERVAL_MS },
      async () => {
        const now = new Date();
        const windowEnd = new Date(now.getTime() + NOTIFICATION_WINDOW_MINUTES * 60 * 1000);
        const events = await getEventsStartingSoon(ctx.db, now.toISOString(), windowEnd.toISOString());
        for (const event of events) {
          ctx.events.emit("calendar:event-starting", {
            eventId: event.id,
            title: event.title,
            startTime: event.startTime,
          });
          markNotified(ctx.db, event.id);
        }
      },
    );
  },

  async deactivate() {},

  async uninstall(_ctx) {},
};
