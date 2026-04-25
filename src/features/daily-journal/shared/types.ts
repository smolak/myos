import type { ActionMap, EventMap, QueryMap } from "@core/types";

export interface JournalNote {
  readonly id: string;
  readonly date: string;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TimelineEvent {
  readonly id: number;
  readonly eventName: string;
  readonly featureId: string;
  readonly payload: unknown;
  readonly createdAt: string;
}

export interface DayData {
  readonly date: string;
  readonly note: JournalNote | null;
  readonly events: readonly TimelineEvent[];
}

export interface DailyJournalEvents extends EventMap {
  "journal:note-created": { id: string; date: string };
  "journal:note-updated": { id: string; date: string };
  "journal:note-deleted": { id: string };
}

export interface DailyJournalActions extends ActionMap {
  "add-note": {
    params: { date: string; content: string };
    result: { id: string };
  };
  "update-note": {
    params: { id: string; content: string };
    result: { success: boolean };
  };
  "delete-note": {
    params: { id: string };
    result: { success: boolean };
  };
}

export interface DailyJournalQueries extends QueryMap {
  "get-notes": {
    params: { limit?: number; search?: string };
    result: readonly JournalNote[];
  };
  "get-note-by-date": {
    params: { date: string };
    result: JournalNote | null;
  };
}
