import type { Database } from "bun:sqlite";
import type { EventMap, ActionMap, QueryMap } from "./common";

export interface ActionMeta {
	executionId: string;
	correlationId: string;
	retriedCount: number;
}

export interface ScopedLogger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
}

export interface FeatureLifecycleContext {
	db: Database;
	log: ScopedLogger;
}

export interface FeatureContext<
	TEvents extends EventMap = EventMap,
	TActions extends ActionMap = ActionMap,
	TQueries extends QueryMap = QueryMap,
> {
	db: Database;

	events: {
		emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void;
	};

	actions: {
		handle<K extends keyof TActions>(
			action: K,
			handler: (
				params: TActions[K]["params"],
				meta: ActionMeta,
			) => Promise<TActions[K]["result"]>,
		): void;
	};

	queries: {
		handle<K extends keyof TQueries>(
			query: K,
			handler: (params: TQueries[K]["params"]) => Promise<TQueries[K]["result"]>,
		): void;
	};

	subscribe(event: string, handler: (payload: unknown) => Promise<void>): void;

	query(feature: string, queryName: string, params: unknown): Promise<unknown>;

	scheduler: {
		register(taskId: string, handler: () => Promise<void>): void;
	};

	settings: {
		get<T>(key: string, defaultValue: T): T;
		set(key: string, value: unknown): Promise<void>;
	};

	log: ScopedLogger;
}
