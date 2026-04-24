import type { EventMap, ActionMap, QueryMap } from "@core/types";

export type SessionType = "work" | "break";
export type SessionStatus = "running" | "paused" | "completed" | "cancelled";

export interface PomodoroSession {
  readonly id: string;
  readonly type: SessionType;
  readonly durationSeconds: number;
  readonly elapsedSeconds: number;
  readonly status: SessionStatus;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PomodoroEvents extends EventMap {
  "pomodoro:session-started": { id: string; type: SessionType; durationSeconds: number };
  "pomodoro:session-paused": { id: string; elapsedSeconds: number };
  "pomodoro:session-resumed": { id: string };
  "pomodoro:session-ended": { id: string; type: SessionType; durationSeconds: number };
  "pomodoro:session-cancelled": { id: string };
}

export interface PomodoroActions extends ActionMap {
  start: { params: { type?: SessionType; durationSeconds?: number }; result: { id: string } };
  pause: { params: { id: string; elapsedSeconds: number }; result: { success: boolean } };
  resume: { params: { id: string }; result: { success: boolean } };
  complete: { params: { id: string; elapsedSeconds?: number }; result: { success: boolean } };
  cancel: { params: { id: string }; result: { success: boolean } };
}

export interface PomodoroQueries extends QueryMap {
  "get-current": { params: Record<string, never>; result: PomodoroSession | null };
  "get-history": { params: { limit?: number }; result: readonly PomodoroSession[] };
}
