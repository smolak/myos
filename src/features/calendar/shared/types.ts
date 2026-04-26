import type { ActionMap, EventMap, FeatureSearchResult, QueryMap } from "@core/types";

export interface CalendarSource {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly lastSyncedAt: string | null;
  readonly syncIntervalMinutes: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CalendarEvent {
  readonly id: string;
  readonly sourceId: string;
  readonly uid: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly isAllDay: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CalendarEvents extends EventMap {
  "calendar:source-added": { sourceId: string; url: string };
  "calendar:source-deleted": { sourceId: string };
  "calendar:synced": { sourceId: string; newEvents: number };
  "calendar:event-starting": { eventId: string; title: string; startTime: string };
}

export interface CalendarActions extends ActionMap {
  "add-source": {
    params: { url: string; title?: string; syncIntervalMinutes?: number };
    result: { id: string };
  };
  "delete-source": {
    params: { id: string };
    result: { success: boolean };
  };
  "sync-all": {
    params: Record<string, never>;
    result: { synced: number; newEvents: number };
  };
}

export interface CalendarQueries extends QueryMap {
  "get-sources": {
    params: Record<string, never>;
    result: readonly CalendarSource[];
  };
  "get-events": {
    params: { sourceId?: string; from?: string; to?: string; limit?: number };
    result: readonly CalendarEvent[];
  };
  "get-upcoming": {
    params: { limit?: number };
    result: readonly CalendarEvent[];
  };
  search: { params: { query: string }; result: readonly FeatureSearchResult[] };
}
