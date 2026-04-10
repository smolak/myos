export interface EventLogEntry {
	id: number;
	eventName: string;
	featureId: string;
	payload: string | null;
	createdAt: string;
}

export type EventHandler = (payload: unknown) => Promise<void>;

export interface EventSubscription {
	event: string;
	handler: EventHandler;
}
