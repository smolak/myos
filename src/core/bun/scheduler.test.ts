import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { Scheduler, nextCronDate } from "./scheduler";

function setupDb(): Database {
	const db = new Database(":memory:");
	db.run(`
    CREATE TABLE scheduled_tasks (
      id           TEXT PRIMARY KEY,
      feature_id   TEXT NOT NULL,
      name         TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_value TEXT NOT NULL,
      enabled      INTEGER DEFAULT 1,
      last_run_at  TEXT,
      next_run_at  TEXT NOT NULL,
      last_status  TEXT,
      last_error   TEXT,
      retry_count  INTEGER DEFAULT 0,
      max_retries  INTEGER DEFAULT 3,
      created_at   TEXT NOT NULL
    )
  `);
	return db;
}

function seedTask(
	db: Database,
	overrides: {
		id?: string;
		featureId?: string;
		name?: string;
		scheduleType?: string;
		scheduleValue?: string;
		enabled?: number;
		nextRunAt?: string;
		retryCount?: number;
		maxRetries?: number;
	} = {},
): void {
	const id = overrides.id ?? "task-1";
	const nextRunAt = overrides.nextRunAt ?? new Date(Date.now() - 1000).toISOString(); // 1s ago (due)
	const now = new Date().toISOString();
	db.run(`
    INSERT INTO scheduled_tasks
      (id, feature_id, name, schedule_type, schedule_value, enabled, next_run_at, retry_count, max_retries, created_at)
    VALUES
      ('${id}', '${overrides.featureId ?? "test"}', '${overrides.name ?? "Test Task"}',
       '${overrides.scheduleType ?? "interval"}', '${overrides.scheduleValue ?? "60000"}',
       ${overrides.enabled ?? 1}, '${nextRunAt}',
       ${overrides.retryCount ?? 0}, ${overrides.maxRetries ?? 5}, '${now}')
  `);
}

function getTask(db: Database, id = "task-1") {
	return db
		.query<
			{
				enabled: number;
				last_status: string | null;
				last_error: string | null;
				retry_count: number;
				next_run_at: string;
				last_run_at: string | null;
			},
			[string]
		>(
			"SELECT enabled, last_status, last_error, retry_count, next_run_at, last_run_at FROM scheduled_tasks WHERE id = ?",
		)
		.get(id);
}

describe("nextCronDate", () => {
	test("advances at least one minute from the given time", () => {
		const from = new Date("2025-01-15T10:30:00.000Z");
		const next = nextCronDate("* * * * *", from);
		expect(next.getTime()).toBeGreaterThan(from.getTime());
		expect(next.getTime()).toBeLessThanOrEqual(from.getTime() + 60_000 + 1000);
	});

	test("* * * * * returns exactly one minute later (whole minute)", () => {
		const from = new Date("2025-01-15T10:30:00.000Z");
		const next = nextCronDate("* * * * *", from);
		expect(next.toISOString()).toBe("2025-01-15T10:31:00.000Z");
	});

	test("0 * * * * returns the start of the next hour", () => {
		const from = new Date("2025-01-15T10:30:00.000Z");
		const next = nextCronDate("0 * * * *", from);
		expect(next.toISOString()).toBe("2025-01-15T11:00:00.000Z");
	});

	test("0 0 * * * returns midnight of the next day", () => {
		const from = new Date("2025-01-15T10:30:00.000Z");
		const next = nextCronDate("0 0 * * *", from);
		expect(next.toISOString()).toBe("2025-01-16T00:00:00.000Z");
	});

	test("*/5 * * * * returns the next 5-minute boundary", () => {
		const from = new Date("2025-01-15T10:02:00.000Z");
		const next = nextCronDate("*/5 * * * *", from);
		expect(next.toISOString()).toBe("2025-01-15T10:05:00.000Z");
	});

	test("0 9 * * 1 returns next Monday at 09:00", () => {
		// 2025-01-15 is a Wednesday
		const from = new Date("2025-01-15T10:00:00.000Z");
		const next = nextCronDate("0 9 * * 1", from);
		// Next Monday is 2025-01-20
		expect(next.toISOString()).toBe("2025-01-20T09:00:00.000Z");
	});

	test("0 9 * * 1-5 returns next weekday at 09:00 from a weekend", () => {
		// 2025-01-18 is a Saturday
		const from = new Date("2025-01-18T10:00:00.000Z");
		const next = nextCronDate("0 9 * * 1-5", from);
		// Next Monday is 2025-01-20
		expect(next.toISOString()).toBe("2025-01-20T09:00:00.000Z");
	});

	test("throws for expressions with wrong number of fields", () => {
		expect(() => nextCronDate("* * * *", new Date())).toThrow("Invalid cron expression");
		expect(() => nextCronDate("* * * * * *", new Date())).toThrow("Invalid cron expression");
	});
});

describe("Scheduler", () => {
	let db: Database;
	let scheduler: Scheduler;

	beforeEach(() => {
		db = setupDb();
		scheduler = new Scheduler(db, 60_000, 0); // long poll interval, 0ms backoff for tests
	});

	afterEach(() => {
		scheduler.stop();
		db.close();
	});

	describe("registerTask", () => {
		test("creates a row in scheduled_tasks for a new interval task", () => {
			scheduler.registerTask({
				taskId: "my-task",
				featureId: "my-feature",
				name: "My Task",
				scheduleType: "interval",
				scheduleValue: 60_000,
			});

			const row = db
				.query<{ id: string; schedule_type: string; schedule_value: string; enabled: number }, []>(
					"SELECT id, schedule_type, schedule_value, enabled FROM scheduled_tasks",
				)
				.get();

			expect(row?.id).toBe("my-task");
			expect(row?.schedule_type).toBe("interval");
			expect(row?.schedule_value).toBe("60000");
			expect(row?.enabled).toBe(1);
		});

		test("sets next_run_at in the future for interval task", () => {
			const before = Date.now();
			scheduler.registerTask({
				taskId: "my-task",
				featureId: "f",
				name: "T",
				scheduleType: "interval",
				scheduleValue: 60_000,
			});

			const row = db
				.query<{ next_run_at: string }, []>("SELECT next_run_at FROM scheduled_tasks")
				.get();
			const nextRun = new Date(row!.next_run_at).getTime();
			expect(nextRun).toBeGreaterThanOrEqual(before + 60_000);
		});

		test("sets next_run_at based on cron expression", () => {
			// Use cron that runs every minute
			scheduler.registerTask({
				taskId: "cron-task",
				featureId: "f",
				name: "T",
				scheduleType: "cron",
				scheduleValue: "* * * * *",
			});

			const row = db
				.query<{ next_run_at: string }, []>("SELECT next_run_at FROM scheduled_tasks")
				.get();
			const nextRun = new Date(row!.next_run_at).getTime();
			const now = Date.now();
			expect(nextRun).toBeGreaterThan(now);
			expect(nextRun).toBeLessThanOrEqual(now + 60_000 + 1000);
		});

		test("upserts on re-registration, preserving next_run_at", () => {
			seedTask(db, { id: "existing", nextRunAt: "2025-01-01T00:00:00.000Z" });
			const originalNextRun = "2025-01-01T00:00:00.000Z";

			scheduler.registerTask({
				taskId: "existing",
				featureId: "f",
				name: "Updated Name",
				scheduleType: "interval",
				scheduleValue: 120_000,
			});

			const row = db
				.query<{ name: string; schedule_value: string; next_run_at: string }, []>(
					"SELECT name, schedule_value, next_run_at FROM scheduled_tasks WHERE id = 'existing'",
				)
				.get();

			expect(row?.name).toBe("Updated Name");
			expect(row?.schedule_value).toBe("120000");
			expect(row?.next_run_at).toBe(originalNextRun); // preserved
		});

		test("uses DEFAULT_MAX_RETRIES = 5 when not specified", () => {
			scheduler.registerTask({
				taskId: "t",
				featureId: "f",
				name: "T",
				scheduleType: "interval",
				scheduleValue: 1000,
			});

			const row = db.query<{ max_retries: number }, []>("SELECT max_retries FROM scheduled_tasks").get();
			expect(row?.max_retries).toBe(5);
		});

		test("uses custom maxRetries when provided", () => {
			scheduler.registerTask({
				taskId: "t",
				featureId: "f",
				name: "T",
				scheduleType: "interval",
				scheduleValue: 1000,
				maxRetries: 2,
			});

			const row = db.query<{ max_retries: number }, []>("SELECT max_retries FROM scheduled_tasks").get();
			expect(row?.max_retries).toBe(2);
		});
	});

	describe("processNow", () => {
		test("executes handler for a due task", async () => {
			let called = false;
			seedTask(db, { nextRunAt: new Date(Date.now() - 1000).toISOString() });
			scheduler.registerHandler("task-1", async () => {
				called = true;
			});

			await scheduler.processNow();

			expect(called).toBe(true);
		});

		test("does not execute handler for a future task", async () => {
			let called = false;
			seedTask(db, { nextRunAt: new Date(Date.now() + 60_000).toISOString() });
			scheduler.registerHandler("task-1", async () => {
				called = true;
			});

			await scheduler.processNow();

			expect(called).toBe(false);
		});

		test("skips disabled tasks even when due", async () => {
			let called = false;
			seedTask(db, { enabled: 0, nextRunAt: new Date(Date.now() - 1000).toISOString() });
			scheduler.registerHandler("task-1", async () => {
				called = true;
			});

			await scheduler.processNow();

			expect(called).toBe(false);
		});

		test("skips due tasks with no registered handler", async () => {
			seedTask(db);
			// No registerHandler call

			await expect(scheduler.processNow()).resolves.toBeUndefined();
		});

		test("sets last_run_at when task executes", async () => {
			seedTask(db);
			scheduler.registerHandler("task-1", async () => {});

			const before = Date.now();
			await scheduler.processNow();

			const row = getTask(db);
			expect(row?.last_run_at).toBeDefined();
			expect(new Date(row!.last_run_at!).getTime()).toBeGreaterThanOrEqual(before);
		});

		test("processes multiple due tasks in order", async () => {
			const called: string[] = [];
			seedTask(db, { id: "task-a", nextRunAt: new Date(Date.now() - 2000).toISOString() });
			seedTask(db, { id: "task-b", nextRunAt: new Date(Date.now() - 1000).toISOString() });

			scheduler.registerHandler("task-a", async () => { called.push("a"); });
			scheduler.registerHandler("task-b", async () => { called.push("b"); });

			await scheduler.processNow();

			expect(called).toEqual(["a", "b"]);
		});
	});

	describe("on success", () => {
		test("sets last_status to 'success'", async () => {
			seedTask(db);
			scheduler.registerHandler("task-1", async () => {});

			await scheduler.processNow();

			expect(getTask(db)?.last_status).toBe("success");
		});

		test("resets retry_count to 0", async () => {
			seedTask(db, { retryCount: 3 });
			scheduler.registerHandler("task-1", async () => {});

			await scheduler.processNow();

			expect(getTask(db)?.retry_count).toBe(0);
		});

		test("clears last_error", async () => {
			seedTask(db);
			db.run("UPDATE scheduled_tasks SET last_error = 'previous error' WHERE id = 'task-1'");
			scheduler.registerHandler("task-1", async () => {});

			await scheduler.processNow();

			expect(getTask(db)?.last_error).toBeNull();
		});

		test("recalculates next_run_at for interval task", async () => {
			const intervalMs = 60_000;
			seedTask(db, { scheduleType: "interval", scheduleValue: String(intervalMs) });
			scheduler.registerHandler("task-1", async () => {});

			const before = Date.now();
			await scheduler.processNow();

			const nextRun = new Date(getTask(db)!.next_run_at).getTime();
			expect(nextRun).toBeGreaterThanOrEqual(before + intervalMs);
		});

		test("recalculates next_run_at for cron task", async () => {
			seedTask(db, { scheduleType: "cron", scheduleValue: "* * * * *" });
			scheduler.registerHandler("task-1", async () => {});

			await scheduler.processNow();

			const nextRun = new Date(getTask(db)!.next_run_at).getTime();
			expect(nextRun).toBeGreaterThan(Date.now());
			expect(nextRun).toBeLessThanOrEqual(Date.now() + 60_000 + 1000);
		});
	});

	describe("on failure (retry with backoff)", () => {
		test("increments retry_count after failure", async () => {
			seedTask(db, { retryCount: 0, maxRetries: 5 });
			scheduler.registerHandler("task-1", async () => {
				throw new Error("transient error");
			});

			await scheduler.processNow();

			expect(getTask(db)?.retry_count).toBe(1);
		});

		test("sets last_status to 'failed'", async () => {
			seedTask(db, { maxRetries: 5 });
			scheduler.registerHandler("task-1", async () => {
				throw new Error("oops");
			});

			await scheduler.processNow();

			expect(getTask(db)?.last_status).toBe("failed");
		});

		test("stores error message in last_error", async () => {
			seedTask(db, { maxRetries: 5 });
			scheduler.registerHandler("task-1", async () => {
				throw new Error("something broke");
			});

			await scheduler.processNow();

			expect(getTask(db)?.last_error).toBe("something broke");
		});

		test("schedules retry with backoff in next_run_at (before max_retries)", async () => {
			const schedulerWithBackoff = new Scheduler(db, 60_000, 1000); // 1s base backoff
			seedTask(db, { retryCount: 0, maxRetries: 5 });
			schedulerWithBackoff.registerHandler("task-1", async () => {
				throw new Error("fail");
			});

			const before = Date.now();
			await schedulerWithBackoff.processNow();

			const nextRun = new Date(getTask(db)!.next_run_at).getTime();
			// backoff = 1000 * 2^(1-1) = 1000ms
			expect(nextRun).toBeGreaterThanOrEqual(before + 1000 - 50);
			schedulerWithBackoff.stop();
		});

		test("does NOT disable task before max_retries is reached", async () => {
			seedTask(db, { retryCount: 0, maxRetries: 5 });
			scheduler.registerHandler("task-1", async () => {
				throw new Error("fail");
			});

			await scheduler.processNow();

			expect(getTask(db)?.enabled).toBe(1);
		});
	});

	describe("auto-disable after max_retries", () => {
		test("disables task when retry_count reaches max_retries", async () => {
			seedTask(db, { retryCount: 4, maxRetries: 5 }); // one failure away from limit
			scheduler.registerHandler("task-1", async () => {
				throw new Error("final failure");
			});

			await scheduler.processNow();

			const row = getTask(db);
			expect(row?.enabled).toBe(0);
			expect(row?.retry_count).toBe(5);
		});

		test("disabled task is not executed on subsequent processNow calls", async () => {
			let callCount = 0;
			seedTask(db, { retryCount: 4, maxRetries: 5 });
			scheduler.registerHandler("task-1", async () => {
				callCount++;
				throw new Error("fail");
			});

			await scheduler.processNow(); // this disables the task
			await scheduler.processNow(); // this should not call the handler

			expect(callCount).toBe(1);
		});
	});

	describe("interval scheduling", () => {
		test("schedules next run at now + interval after success", async () => {
			const intervalMs = 30_000;
			seedTask(db, { scheduleType: "interval", scheduleValue: String(intervalMs) });
			scheduler.registerHandler("task-1", async () => {});

			const before = Date.now();
			await scheduler.processNow();

			const nextRun = new Date(getTask(db)!.next_run_at).getTime();
			expect(nextRun).toBeGreaterThanOrEqual(before + intervalMs);
			expect(nextRun).toBeLessThan(before + intervalMs + 2000);
		});

		test("interval task with string scheduleValue works correctly", async () => {
			seedTask(db, { scheduleType: "interval", scheduleValue: "5000" });
			scheduler.registerHandler("task-1", async () => {});

			const before = Date.now();
			await scheduler.processNow();

			const nextRun = new Date(getTask(db)!.next_run_at).getTime();
			expect(nextRun).toBeGreaterThanOrEqual(before + 5000);
		});
	});

	describe("crash resilience", () => {
		test("tasks with next_run_at in the past are executed on processNow", async () => {
			let called = false;
			// Simulate a task that was due an hour ago (missed due to crash/downtime)
			seedTask(db, { nextRunAt: new Date(Date.now() - 3_600_000).toISOString() });
			scheduler.registerHandler("task-1", async () => {
				called = true;
			});

			await scheduler.processNow();

			expect(called).toBe(true);
		});

		test("overdue task runs and gets rescheduled for the future", async () => {
			seedTask(db, {
				scheduleType: "interval",
				scheduleValue: "60000",
				nextRunAt: new Date(Date.now() - 3_600_000).toISOString(),
			});
			scheduler.registerHandler("task-1", async () => {});

			await scheduler.processNow();

			const nextRun = new Date(getTask(db)!.next_run_at).getTime();
			expect(nextRun).toBeGreaterThan(Date.now());
		});
	});

	describe("start / stop", () => {
		test("start does not throw", () => {
			expect(() => scheduler.start()).not.toThrow();
		});

		test("calling start twice does not create multiple poll loops", () => {
			scheduler.start();
			expect(() => scheduler.start()).not.toThrow();
		});

		test("stop clears the poll interval", () => {
			scheduler.start();
			expect(() => scheduler.stop()).not.toThrow();
		});
	});
});
