import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { EventBus } from "./event-bus";

describe("EventBus", () => {
	let db: Database;
	let bus: EventBus;

	beforeEach(() => {
		db = new Database(":memory:");
		db.run(`
			CREATE TABLE event_log (
				id         INTEGER PRIMARY KEY AUTOINCREMENT,
				event_name TEXT NOT NULL,
				feature_id TEXT NOT NULL,
				payload    TEXT,
				created_at TEXT NOT NULL
			)
		`);
		bus = new EventBus(db);
	});

	afterEach(() => {
		db.close();
	});

	describe("emit", () => {
		test("logs event to event_log table", () => {
			bus.emit("todo:item-created", "todo", { id: "abc", title: "Test" });

			const row = db
				.query<
					{ event_name: string; feature_id: string; payload: string | null },
					[]
				>("SELECT event_name, feature_id, payload FROM event_log")
				.get();

			expect(row?.event_name).toBe("todo:item-created");
			expect(row?.feature_id).toBe("todo");
			expect(JSON.parse(row?.payload ?? "null")).toEqual({ id: "abc", title: "Test" });
		});

		test("logs null payload when payload is undefined", () => {
			bus.emit("todo:item-deleted", "todo", undefined);

			const row = db
				.query<{ payload: string | null }, []>("SELECT payload FROM event_log")
				.get();

			expect(row?.payload).toBeNull();
		});

		test("stores created_at as ISO 8601 string", () => {
			bus.emit("todo:item-created", "todo", {});

			const row = db
				.query<{ created_at: string }, []>("SELECT created_at FROM event_log")
				.get();

			expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		test("delivers event to subscriber", async () => {
			const received: unknown[] = [];
			bus.subscribe("todo:item-created", async (payload) => {
				received.push(payload);
			});

			bus.emit("todo:item-created", "todo", { id: "abc" });

			await Bun.sleep(0);
			expect(received).toHaveLength(1);
			expect(received[0]).toEqual({ id: "abc" });
		});

		test("delivers event to multiple subscribers", async () => {
			const calls: number[] = [];
			bus.subscribe("todo:item-created", async () => { calls.push(1); });
			bus.subscribe("todo:item-created", async () => { calls.push(2); });

			bus.emit("todo:item-created", "todo", {});

			await Bun.sleep(0);
			expect(calls).toHaveLength(2);
		});

		test("does not deliver to subscribers of a different event", async () => {
			const received: unknown[] = [];
			bus.subscribe("other:event", async (payload) => {
				received.push(payload);
			});

			bus.emit("todo:item-created", "todo", {});

			await Bun.sleep(0);
			expect(received).toHaveLength(0);
		});

		test("subscriber error does not affect other subscribers", async () => {
			const received: unknown[] = [];

			bus.subscribe("todo:item-created", async () => {
				throw new Error("subscriber failure");
			});
			bus.subscribe("todo:item-created", async (payload) => {
				received.push(payload);
			});

			bus.emit("todo:item-created", "todo", { id: "abc" });

			await Bun.sleep(0);
			expect(received).toHaveLength(1);
		});

		test("subscriber error does not propagate to emitter", () => {
			bus.subscribe("todo:item-created", async () => {
				throw new Error("subscriber failure");
			});

			expect(() => bus.emit("todo:item-created", "todo", {})).not.toThrow();
		});

		test("emitting with no subscribers still logs the event", () => {
			bus.emit("todo:item-created", "todo", { id: "abc" });

			const count = db
				.query<{ n: number }, []>("SELECT COUNT(*) as n FROM event_log")
				.get();

			expect(count?.n).toBe(1);
		});
	});

	describe("subscribe", () => {
		test("same handler can be registered for multiple events", async () => {
			const received: string[] = [];
			const handler = async (payload: unknown) => {
				received.push((payload as { event: string }).event);
			};

			bus.subscribe("event-a", handler);
			bus.subscribe("event-b", handler);

			bus.emit("event-a", "feat", { event: "a" });
			bus.emit("event-b", "feat", { event: "b" });

			await Bun.sleep(0);
			expect(received).toContain("a");
			expect(received).toContain("b");
		});
	});
});
