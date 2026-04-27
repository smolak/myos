import type { ActionMap, EventMap, FeatureSearchResult, QueryMap } from "@core/types";

export interface Countdown {
  readonly id: string;
  readonly name: string;
  readonly targetDate: string;
  readonly archivedAt: string | null;
  readonly reachedNotifiedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CountdownWithTimeLeft extends Countdown {
  readonly isReached: boolean;
  readonly daysRemaining: number;
  readonly hoursRemaining: number;
  readonly minutesRemaining: number;
}

export interface CountdownsEvents extends EventMap {
  "countdown:reached": { id: string; name: string };
}

export interface CountdownsActions extends ActionMap {
  create: { params: { name: string; targetDate: string }; result: { id: string } };
  delete: { params: { id: string }; result: { success: boolean } };
  archive: { params: { id: string }; result: { success: boolean } };
}

export interface CountdownsQueries extends QueryMap {
  "get-all": { params: { includeArchived?: boolean }; result: readonly CountdownWithTimeLeft[] };
  "get-by-id": { params: { id: string }; result: CountdownWithTimeLeft | null };
  search: { params: { query: string }; result: readonly FeatureSearchResult[] };
}
