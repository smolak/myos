import type { Database } from "bun:sqlite";
import type { EventHandler } from "@core/types";

export class EventBus {
  private readonly subscriptions = new Map<string, Set<EventHandler>>();
  private readonly coreDb: Database;

  constructor(coreDb: Database) {
    this.coreDb = coreDb;
  }

  emit(eventName: string, featureId: string, payload: unknown): void {
    this.coreDb
      .query("INSERT INTO event_log (event_name, feature_id, payload, created_at) VALUES (?, ?, ?, ?)")
      .run(eventName, featureId, payload !== undefined ? JSON.stringify(payload) : null, new Date().toISOString());

    const handlers = this.subscriptions.get(eventName);
    if (!handlers) return;

    for (const handler of handlers) {
      handler(payload).catch((error) => {
        console.error(`[event-bus] Subscriber error for "${eventName}":`, error);
      });
    }
  }

  subscribe(event: string, handler: EventHandler): void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    this.subscriptions.get(event)!.add(handler);
  }
}
