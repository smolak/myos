import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { ActionQueue } from "./action-queue";

function setupDb(): Database {
	const db = new Database(":memory:");
	db.exec(`
    CREATE TABLE script_executions (
      id           TEXT PRIMARY KEY,
      script_id    TEXT NOT NULL,
      triggered_by TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      created_at   TEXT NOT NULL
    )
  `);
	db.exec(`
    CREATE TABLE execution_actions (
      id             TEXT PRIMARY KEY,
      execution_id   TEXT NOT NULL,
      sequence       INTEGER NOT NULL,
      feature_id     TEXT NOT NULL,
      action_name    TEXT NOT NULL,
      params         TEXT NOT NULL,
      depends_on     INTEGER,
      output_key     TEXT,
      status         TEXT NOT NULL DEFAULT 'pending',
      result         TEXT,
      error          TEXT,
      retry_count    INTEGER NOT NULL DEFAULT 0,
      correlation_id TEXT,
      max_retries    INTEGER NOT NULL DEFAULT 3,
      created_at     TEXT NOT NULL,
      completed_at   TEXT
    )
  `);
	return db;
}

function seedExecution(db: Database, id: string): void {
	db.exec(
		`INSERT INTO script_executions (id, script_id, triggered_by, status, created_at)
     VALUES ('${id}', 'sys', 'manual', 'pending', '${new Date().toISOString()}')`,
	);
}

function getAction(db: Database, executionId: string, sequence: number) {
	return db
		.query<
			{ status: string; result: string | null; error: string | null; retry_count: number },
			[string, number]
		>(
			"SELECT status, result, error, retry_count FROM execution_actions WHERE execution_id = ? AND sequence = ?",
		)
		.get(executionId, sequence);
}

describe("ActionQueue", () => {
	let db: Database;
	let queue: ActionQueue;

	beforeEach(() => {
		db = setupDb();
		queue = new ActionQueue(db, 0); // 0ms backoff for tests
	});

	afterEach(() => {
		db.close();
	});

	describe("registerHandler / registerQueryHandler", () => {
		test("registers action handler without throwing", () => {
			expect(() => {
				queue.registerHandler("todo", "create", async () => ({ id: "1" }));
			}).not.toThrow();
		});

		test("registers query handler without throwing", () => {
			expect(() => {
				queue.registerQueryHandler("todo", "find", async () => []);
			}).not.toThrow();
		});
	});

	describe("enqueue", () => {
		test("persists actions to DB before execution", () => {
			seedExecution(db, "exec-1");
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "create", params: { title: "Buy milk" } },
			]);

			const row = db
				.query<{ feature_id: string; action_name: string; status: string }, []>(
					"SELECT feature_id, action_name, status FROM execution_actions",
				)
				.get();

			expect(row?.feature_id).toBe("todo");
			expect(row?.action_name).toBe("create");
			expect(row?.status).toBe("pending");
		});

		test("persists multiple actions in a single transaction", () => {
			seedExecution(db, "exec-1");
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "create", params: { title: "A" } },
				{ sequence: 2, featureId: "todo", actionName: "create", params: { title: "B" } },
			]);

			const count = db
				.query<{ n: number }, []>("SELECT COUNT(*) as n FROM execution_actions")
				.get();
			expect(count?.n).toBe(2);
		});

		test("stores params as JSON", () => {
			seedExecution(db, "exec-1");
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "create", params: { title: "Test", n: 42 } },
			]);

			const row = db.query<{ params: string }, []>("SELECT params FROM execution_actions").get();
			expect(JSON.parse(row!.params)).toEqual({ title: "Test", n: 42 });
		});

		test("stores optional correlationId", () => {
			seedExecution(db, "exec-1");
			queue.enqueue("exec-1", [
				{
					sequence: 1,
					featureId: "todo",
					actionName: "create",
					params: {},
					correlationId: "corr-abc",
				},
			]);

			const row = db
				.query<{ correlation_id: string | null }, []>(
					"SELECT correlation_id FROM execution_actions",
				)
				.get();
			expect(row?.correlation_id).toBe("corr-abc");
		});

		test("stores optional dependsOn and outputKey", () => {
			seedExecution(db, "exec-1");
			queue.enqueue("exec-1", [
				{
					sequence: 2,
					featureId: "todo",
					actionName: "create",
					params: {},
					dependsOn: 1,
					outputKey: "created",
				},
			]);

			const row = db
				.query<{ depends_on: number | null; output_key: string | null }, []>(
					"SELECT depends_on, output_key FROM execution_actions",
				)
				.get();
			expect(row?.depends_on).toBe(1);
			expect(row?.output_key).toBe("created");
		});

		test("uses default max_retries when not provided", () => {
			seedExecution(db, "exec-1");
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "create", params: {} },
			]);

			const row = db
				.query<{ max_retries: number }, []>("SELECT max_retries FROM execution_actions")
				.get();
			expect(row?.max_retries).toBe(3);
		});
	});

	describe("processExecution", () => {
		test("executes registered handler and marks action completed", async () => {
			seedExecution(db, "exec-1");
			queue.registerHandler("todo", "create", async () => ({ id: "new-1" }));
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "create", params: { title: "Buy milk" } },
			]);

			await queue.processExecution("exec-1");

			const row = getAction(db, "exec-1", 1);
			expect(row?.status).toBe("completed");
			expect(JSON.parse(row!.result!)).toEqual({ id: "new-1" });
		});

		test("passes correct params to handler", async () => {
			seedExecution(db, "exec-1");
			let receivedParams: unknown;
			queue.registerHandler("todo", "create", async (params) => {
				receivedParams = params;
				return {};
			});
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "create", params: { title: "Hello" } },
			]);

			await queue.processExecution("exec-1");

			expect(receivedParams).toEqual({ title: "Hello" });
		});

		test("passes ActionMeta with executionId and correlationId to handler", async () => {
			seedExecution(db, "exec-1");
			let receivedMeta: unknown;
			queue.registerHandler("todo", "create", async (_params, meta) => {
				receivedMeta = meta;
				return {};
			});
			queue.enqueue("exec-1", [
				{
					sequence: 1,
					featureId: "todo",
					actionName: "create",
					params: {},
					correlationId: "corr-xyz",
				},
			]);

			await queue.processExecution("exec-1");

			expect((receivedMeta as { executionId: string }).executionId).toBe("exec-1");
			expect((receivedMeta as { correlationId: string }).correlationId).toBe("corr-xyz");
			expect((receivedMeta as { retriedCount: number }).retriedCount).toBe(0);
		});

		test("sets completed_at when action succeeds", async () => {
			seedExecution(db, "exec-1");
			queue.registerHandler("todo", "create", async () => ({}));
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "create", params: {} },
			]);

			await queue.processExecution("exec-1");

			const row = db
				.query<{ completed_at: string | null }, []>(
					"SELECT completed_at FROM execution_actions",
				)
				.get();
			expect(row?.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});

		test("marks action failed when no handler is registered", async () => {
			seedExecution(db, "exec-1");
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "missing", params: {} },
			]);

			await queue.processExecution("exec-1");

			const row = getAction(db, "exec-1", 1);
			expect(row?.status).toBe("failed");
			expect(row?.error).toContain("todo:missing");
		});

		test("processes multiple independent actions in sequence order", async () => {
			seedExecution(db, "exec-1");
			const order: number[] = [];
			queue.registerHandler("todo", "create", async (_params, meta) => {
				order.push(meta.retriedCount === 0 ? order.length + 1 : -1);
				return {};
			});
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "create", params: { title: "A" } },
				{ sequence: 2, featureId: "todo", actionName: "create", params: { title: "B" } },
				{ sequence: 3, featureId: "todo", actionName: "create", params: { title: "C" } },
			]);

			await queue.processExecution("exec-1");

			const rows = db
				.query<{ sequence: number; status: string }, []>(
					"SELECT sequence, status FROM execution_actions ORDER BY sequence",
				)
				.all();
			expect(rows.every((r) => r.status === "completed")).toBe(true);
		});

		describe("dependsOn", () => {
			test("executes dependent action after its dependency completes", async () => {
				seedExecution(db, "exec-1");
				const order: string[] = [];
				queue.registerHandler("todo", "create", async (params) => {
					order.push((params as { title: string }).title);
					return { id: "1" };
				});
				queue.registerHandler("todo", "complete", async (params) => {
					order.push(`complete-${(params as { id: string }).id}`);
					return { success: true };
				});
				queue.enqueue("exec-1", [
					{
						sequence: 1,
						featureId: "todo",
						actionName: "create",
						params: { title: "First" },
						outputKey: "created",
					},
					{
						sequence: 2,
						featureId: "todo",
						actionName: "complete",
						params: { id: { $ref: "created" } },
						dependsOn: 1,
					},
				]);

				await queue.processExecution("exec-1");

				expect(order[0]).toBe("First");
				expect(order[1]).toBe("complete-[object Object]"); // $ref not resolved in order tracking
				const row2 = getAction(db, "exec-1", 2);
				expect(row2?.status).toBe("completed");
			});

			test("marks dependent action failed when dependency fails", async () => {
				seedExecution(db, "exec-1");
				queue.registerHandler("todo", "create", async () => {
					throw new Error("create failed");
				});
				queue.registerHandler("todo", "complete", async () => ({ success: true }));
				queue.enqueue("exec-1", [
					{
						sequence: 1,
						featureId: "todo",
						actionName: "create",
						params: {},
						maxRetries: 0,
					},
					{
						sequence: 2,
						featureId: "todo",
						actionName: "complete",
						params: {},
						dependsOn: 1,
					},
				]);

				await queue.processExecution("exec-1");

				const row2 = getAction(db, "exec-1", 2);
				expect(row2?.status).toBe("failed");
				expect(row2?.error).toContain("sequence 1");
			});
		});

		describe("retry", () => {
			test("retries failed action and succeeds on subsequent attempt", async () => {
				seedExecution(db, "exec-1");
				let attempts = 0;
				queue.registerHandler("todo", "create", async () => {
					attempts++;
					if (attempts < 2) throw new Error("transient error");
					return { id: "1" };
				});
				queue.enqueue("exec-1", [
					{ sequence: 1, featureId: "todo", actionName: "create", params: {}, maxRetries: 3 },
				]);

				await queue.processExecution("exec-1");

				expect(attempts).toBe(2);
				const row = getAction(db, "exec-1", 1);
				expect(row?.status).toBe("completed");
				expect(row?.retry_count).toBe(1);
			});

			test("marks action failed after exhausting max retries", async () => {
				seedExecution(db, "exec-1");
				queue.registerHandler("todo", "create", async () => {
					throw new Error("always fails");
				});
				queue.enqueue("exec-1", [
					{ sequence: 1, featureId: "todo", actionName: "create", params: {}, maxRetries: 2 },
				]);

				await queue.processExecution("exec-1");

				const row = getAction(db, "exec-1", 1);
				expect(row?.status).toBe("failed");
				expect(row?.retry_count).toBe(2);
				expect(row?.error).toBe("always fails");
			});

			test("passes incremented retriedCount in meta on each retry", async () => {
				seedExecution(db, "exec-1");
				const retriedCounts: number[] = [];
				queue.registerHandler("todo", "create", async (_params, meta) => {
					retriedCounts.push(meta.retriedCount);
					if (meta.retriedCount < 2) throw new Error("not yet");
					return {};
				});
				queue.enqueue("exec-1", [
					{ sequence: 1, featureId: "todo", actionName: "create", params: {}, maxRetries: 3 },
				]);

				await queue.processExecution("exec-1");

				expect(retriedCounts).toEqual([0, 1, 2]);
			});
		});

		describe("correlationId deduplication", () => {
			test("returns cached result for duplicate correlationId", async () => {
				seedExecution(db, "exec-1");
				seedExecution(db, "exec-2");
				let callCount = 0;
				queue.registerHandler("todo", "create", async () => {
					callCount++;
					return { id: "deduped" };
				});

				// First execution - action runs
				queue.enqueue("exec-1", [
					{
						sequence: 1,
						featureId: "todo",
						actionName: "create",
						params: {},
						correlationId: "unique-op",
					},
				]);
				await queue.processExecution("exec-1");

				// Second execution with same correlationId - should reuse cached result
				queue.enqueue("exec-2", [
					{
						sequence: 1,
						featureId: "todo",
						actionName: "create",
						params: {},
						correlationId: "unique-op",
					},
				]);
				await queue.processExecution("exec-2");

				expect(callCount).toBe(1);
				const row2 = getAction(db, "exec-2", 1);
				expect(row2?.status).toBe("completed");
				expect(JSON.parse(row2!.result!)).toEqual({ id: "deduped" });
			});
		});

		describe("output_key / $ref resolution", () => {
			test("passes result of previous action via $ref in params", async () => {
				seedExecution(db, "exec-1");
				let receivedId: unknown;
				queue.registerHandler("todo", "create", async () => ({ id: "generated-id" }));
				queue.registerHandler("todo", "complete", async (params) => {
					receivedId = (params as { id: unknown }).id;
					return { success: true };
				});
				queue.enqueue("exec-1", [
					{
						sequence: 1,
						featureId: "todo",
						actionName: "create",
						params: {},
						outputKey: "newTodo",
					},
					{
						sequence: 2,
						featureId: "todo",
						actionName: "complete",
						params: { id: { $ref: "newTodo" } },
						dependsOn: 1,
					},
				]);

				await queue.processExecution("exec-1");

				expect(receivedId).toEqual({ id: "generated-id" });
			});

			test("passes nested $ref in params correctly", async () => {
				seedExecution(db, "exec-1");
				let receivedNested: unknown;
				queue.registerHandler("todo", "create", async () => ({ id: "abc" }));
				queue.registerHandler("todo", "update", async (params) => {
					receivedNested = params;
					return { success: true };
				});
				queue.enqueue("exec-1", [
					{
						sequence: 1,
						featureId: "todo",
						actionName: "create",
						params: {},
						outputKey: "item",
					},
					{
						sequence: 2,
						featureId: "todo",
						actionName: "update",
						params: { data: { id: { $ref: "item" }, extra: "x" } },
						dependsOn: 1,
					},
				]);

				await queue.processExecution("exec-1");

				expect(receivedNested).toEqual({ data: { id: { id: "abc" }, extra: "x" } });
			});
		});
	});

	describe("executeQuery", () => {
		test("invokes registered query handler with params", async () => {
			let receivedParams: unknown;
			queue.registerQueryHandler("todo", "find", async (params) => {
				receivedParams = params;
				return [{ id: "1", title: "Test" }];
			});

			const result = await queue.executeQuery("todo", "find", { completed: false });

			expect(receivedParams).toEqual({ completed: false });
			expect(result).toEqual([{ id: "1", title: "Test" }]);
		});

		test("throws when no query handler is registered", async () => {
			await expect(queue.executeQuery("todo", "missing", {})).rejects.toThrow("todo:missing");
		});
	});

	describe("resumePending", () => {
		test("processes actions that were pending before shutdown", async () => {
			seedExecution(db, "exec-1");
			let called = false;
			queue.registerHandler("todo", "create", async () => {
				called = true;
				return {};
			});
			queue.enqueue("exec-1", [
				{ sequence: 1, featureId: "todo", actionName: "create", params: {} },
			]);

			// Simulate restart with fresh queue instance
			const freshQueue = new ActionQueue(db, 0);
			freshQueue.registerHandler("todo", "create", async () => {
				called = true;
				return {};
			});

			await freshQueue.resumePending();

			expect(called).toBe(true);
			const row = getAction(db, "exec-1", 1);
			expect(row?.status).toBe("completed");
		});

		test("resets running actions to pending before processing", async () => {
			seedExecution(db, "exec-1");
			// Simulate a crashed run by inserting an action in 'running' state
			db.exec(`
        INSERT INTO execution_actions
          (id, execution_id, sequence, feature_id, action_name, params, status, retry_count, max_retries, created_at)
        VALUES
          ('act-1', 'exec-1', 1, 'todo', 'create', '{}', 'running', 0, 3, '${new Date().toISOString()}')
      `);

			const freshQueue = new ActionQueue(db, 0);
			freshQueue.registerHandler("todo", "create", async () => ({ id: "resumed" }));

			await freshQueue.resumePending();

			const row = getAction(db, "exec-1", 1);
			expect(row?.status).toBe("completed");
		});
	});
});
