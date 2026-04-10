import type { EventMap, ActionMap, QueryMap } from "./common";
import type { FeatureContext, FeatureLifecycleContext } from "./context";

export interface Migration {
	version: string;
	name: string;
	up: string;
	down?: string;
}

export interface EventDeclaration {
	description?: string;
	payload?: Record<string, string>;
}

export interface ActionDeclaration {
	description?: string;
	params?: Record<string, string>;
	result?: Record<string, string>;
}

export interface QueryDeclaration {
	description?: string;
	params?: Record<string, string>;
	result?: string | Record<string, string>;
}

export type EventDeclarations<T extends EventMap> = {
	[K in keyof T]: EventDeclaration;
};

export type ActionDeclarations<T extends ActionMap> = {
	[K in keyof T]: ActionDeclaration;
};

export type QueryDeclarations<T extends QueryMap> = {
	[K in keyof T]: QueryDeclaration;
};

export interface Permission {
	type: "network" | "notifications" | "clipboard" | "filesystem";
	reason: string;
}

export interface ScheduledTaskDeclaration {
	id: string;
	defaultSchedule: {
		type: "cron" | "interval";
		value: string | number;
	};
	description?: string;
}

export type WidgetSize = "small" | "medium" | "wide" | "full-width";

export interface WidgetDeclaration {
	id: string;
	sizes: WidgetSize[];
	name?: string;
	description?: string;
}

export interface CommandDeclaration {
	id: string;
	label: string;
	params?: string[];
	description?: string;
}

export interface FeatureManifest<
	TEvents extends EventMap = EventMap,
	TActions extends ActionMap = ActionMap,
	TQueries extends QueryMap = QueryMap,
> {
	events: EventDeclarations<TEvents>;
	actions: ActionDeclarations<TActions>;
	queries: QueryDeclarations<TQueries>;
	permissions: Permission[];
	scheduledTasks: ScheduledTaskDeclaration[];
	widgets: WidgetDeclaration[];
	commands: CommandDeclaration[];
}

export interface FeatureDefinition<
	TEvents extends EventMap = EventMap,
	TActions extends ActionMap = ActionMap,
	TQueries extends QueryMap = QueryMap,
> {
	id: string;
	name: string;
	version: string;

	install(ctx: FeatureLifecycleContext): Promise<void>;
	activate(ctx: FeatureContext<TEvents, TActions, TQueries>): Promise<void>;
	deactivate(): Promise<void>;
	uninstall(ctx: FeatureLifecycleContext): Promise<void>;

	migrations: Migration[];
	manifest: FeatureManifest<TEvents, TActions, TQueries>;
}
