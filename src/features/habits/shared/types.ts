import type { ActionMap, EventMap, FeatureSearchResult, QueryMap } from "@core/types";

export type HabitFrequency = "daily" | "weekly";

export interface Habit {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly frequency: HabitFrequency;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HabitWithStats extends Habit {
  readonly completedToday: boolean;
  readonly currentStreak: number;
  readonly longestStreak: number;
}

export interface HabitCompletion {
  readonly id: string;
  readonly habitId: string;
  readonly date: string;
  readonly completedAt: string;
}

export interface HabitsEvents extends EventMap {
  "habits:completed": { id: string; name: string; date: string };
}

export interface HabitsActions extends ActionMap {
  create: { params: { name: string; description?: string; frequency?: HabitFrequency }; result: { id: string } };
  delete: { params: { id: string }; result: { success: boolean } };
  complete: { params: { id: string; date: string }; result: { success: boolean } };
  uncomplete: { params: { id: string; date: string }; result: { success: boolean } };
}

export interface HabitsQueries extends QueryMap {
  "get-all": { params: { date?: string }; result: readonly HabitWithStats[] };
  "get-by-id": { params: { id: string; date?: string }; result: HabitWithStats | null };
  "get-history": { params: { id: string }; result: readonly HabitCompletion[] };
  search: { params: { query: string }; result: readonly FeatureSearchResult[] };
}
