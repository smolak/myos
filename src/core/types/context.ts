import type { Database } from "bun:sqlite";
import type { EventMap, ActionMap, QueryMap } from "./common";

export interface ScheduleConfig {
	readonly type: "cron" | "interval";
	readonly value: string | number;
	readonly maxRetries?: number;
}

export interface ActionMeta {
	readonly executionId: string;
	readonly correlationId: string;
	readonly retriedCount: number;
}

export interface ScopedLogger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
}

export interface FeatureLifecycleContext {
	readonly db: Database;
	readonly log: ScopedLogger;
}

export interface FeatureContext<
	TEvents extends EventMap = EventMap,
	TActions extends ActionMap = ActionMap,
	TQueries extends QueryMap = QueryMap,
> {
	readonly db: Database;

	readonly events: {
		emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void;
	};

	readonly actions: {
		handle<K extends keyof TActions>(
			action: K,
			handler: (
				params: TActions[K]["params"],
				meta: ActionMeta,
			) => Promise<TActions[K]["result"]>,
		): void;
	};

	readonly queries: {
		handle<K extends keyof TQueries>(
			query: K,
			handler: (params: TQueries[K]["params"]) => Promise<TQueries[K]["result"]>,
		): void;
	};

	subscribe(event: string, handler: (payload: unknown) => Promise<void>): void;

	query(feature: string, queryName: string, params: unknown): Promise<unknown>;

	readonly scheduler: {
		register(
			taskId: string,
			schedule: ScheduleConfig,
			handler: () => Promise<void>,
		): void;
	};

	readonly settings: {
		get<T>(key: string, defaultValue: T): T;
		set(key: string, value: unknown): Promise<void>;
	};

	readonly log: ScopedLogger;
}
