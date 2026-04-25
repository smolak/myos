import type { ActionMap, EventMap, QueryMap } from "./common";
import type { FeatureContext, FeatureLifecycleContext } from "./context";

export interface Migration {
  readonly version: string;
  readonly name: string;
  readonly up: string;
  readonly down?: string;
}

export interface EventDeclaration {
  readonly description?: string;
  readonly payload?: Record<string, string>;
}

export interface ActionDeclaration {
  readonly description?: string;
  readonly params?: Record<string, string>;
  readonly result?: Record<string, string>;
}

export interface QueryDeclaration {
  readonly description?: string;
  readonly params?: Record<string, string>;
  readonly result?: string | Record<string, string>;
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
  readonly type: "network" | "notifications" | "clipboard" | "filesystem";
  readonly reason: string;
}

export interface ScheduledTaskDeclaration {
  readonly id: string;
  readonly defaultSchedule: {
    readonly type: "cron" | "interval";
    readonly value: string | number;
  };
  readonly description?: string;
}

export type WidgetSize = "small" | "medium" | "wide" | "full-width";

export interface WidgetDeclaration {
  readonly id: string;
  readonly sizes: WidgetSize[];
  readonly name?: string;
  readonly description?: string;
}

export interface CommandDeclaration {
  readonly id: string;
  readonly label: string;
  readonly params?: string[];
  readonly description?: string;
}

export interface FeatureManifest<
  TEvents extends EventMap = EventMap,
  TActions extends ActionMap = ActionMap,
  TQueries extends QueryMap = QueryMap,
> {
  readonly events: EventDeclarations<TEvents>;
  readonly actions: ActionDeclarations<TActions>;
  readonly queries: QueryDeclarations<TQueries>;
  readonly permissions: Permission[];
  readonly scheduledTasks: ScheduledTaskDeclaration[];
  readonly widgets: WidgetDeclaration[];
  readonly commands: CommandDeclaration[];
}

export interface FeatureDefinition<
  TEvents extends EventMap = EventMap,
  TActions extends ActionMap = ActionMap,
  TQueries extends QueryMap = QueryMap,
> {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  install(ctx: FeatureLifecycleContext): Promise<void>;
  activate(ctx: FeatureContext<TEvents, TActions, TQueries>): Promise<void>;
  deactivate(): Promise<void>;
  uninstall(ctx: FeatureLifecycleContext): Promise<void>;

  readonly migrations: Migration[];
  readonly manifest: FeatureManifest<TEvents, TActions, TQueries>;
}
