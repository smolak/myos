import type { EventMap, ActionMap, QueryMap } from "@core/types";

export type TimeFormat = "12h" | "24h";

export interface ClockSettings {
	readonly format: TimeFormat;
}

export interface ClockEvents extends EventMap {}
export interface ClockActions extends ActionMap {}
export interface ClockQueries extends QueryMap {}
