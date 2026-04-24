export interface EventLogEntry {
  readonly id: number;
  readonly eventName: string;
  readonly featureId: string;
  readonly payload: string | null;
  readonly createdAt: string;
}

export type EventHandler = (payload: unknown) => Promise<void>;

export interface EventSubscription {
  readonly event: string;
  readonly handler: EventHandler;
}
