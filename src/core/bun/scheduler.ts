import type { Database } from "bun:sqlite";

export interface RegisterTaskInput {
	taskId: string;
	featureId: string;
	name: string;
	scheduleType: "cron" | "interval";
	scheduleValue: string | number;
	maxRetries?: number;
}

interface ScheduledTaskRow {
	id: string;
	feature_id: string;
	name: string;
	schedule_type: string;
	schedule_value: string;
	enabled: number;
	last_run_at: string | null;
	next_run_at: string;
	last_status: string | null;
	last_error: string | null;
	retry_count: number;
	max_retries: number;
	created_at: string;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_BACKOFF_MS = 1000;
const DEFAULT_POLL_INTERVAL_MS = 10_000;

export class Scheduler {
	private readonly handlers = new Map<string, () => Promise<void>>();
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private isRunning = false;

	constructor(
		private readonly db: Database,
		private readonly pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
		private readonly baseBackoffMs = DEFAULT_BASE_BACKOFF_MS,
	) {}

	registerTask(input: RegisterTaskInput): void {
		const { taskId, featureId, name, scheduleType, scheduleValue, maxRetries = DEFAULT_MAX_RETRIES } =
			input;
		const now = new Date().toISOString();
		const nextRunAt = this.calculateNextRun(scheduleType, scheduleValue).toISOString();

		this.db
			.query(
				`INSERT INTO scheduled_tasks
          (id, feature_id, name, schedule_type, schedule_value, enabled, next_run_at, retry_count, max_retries, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          schedule_type = excluded.schedule_type,
          schedule_value = excluded.schedule_value,
          max_retries = excluded.max_retries`,
			)
			.run(taskId, featureId, name, scheduleType, String(scheduleValue), nextRunAt, maxRetries, now);
	}

	registerHandler(taskId: string, handler: () => Promise<void>): void {
		this.handlers.set(taskId, handler);
	}

	start(): void {
		if (this.isRunning) return;
		this.isRunning = true;
		this.processNow().catch((err) => console.error("[scheduler] Poll error:", err));
		this.pollTimer = setInterval(() => {
			this.processNow().catch((err) => console.error("[scheduler] Poll error:", err));
		}, this.pollIntervalMs);
	}

	stop(): void {
		this.isRunning = false;
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	async processNow(): Promise<void> {
		const now = new Date().toISOString();
		const dueTasks = this.db
			.query<ScheduledTaskRow, [string]>(
				"SELECT * FROM scheduled_tasks WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at",
			)
			.all(now);

		for (const task of dueTasks) {
			await this.executeTask(task);
		}
	}

	private async executeTask(task: ScheduledTaskRow): Promise<void> {
		const handler = this.handlers.get(task.id);
		if (!handler) return;

		const now = new Date().toISOString();
		this.db.query("UPDATE scheduled_tasks SET last_run_at = ? WHERE id = ?").run(now, task.id);

		try {
			await handler();

			const nextRunAt = this.calculateNextRun(
				task.schedule_type as "cron" | "interval",
				task.schedule_value,
			).toISOString();

			this.db
				.query(
					"UPDATE scheduled_tasks SET last_status = 'success', last_error = NULL, retry_count = 0, next_run_at = ? WHERE id = ?",
				)
				.run(nextRunAt, task.id);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			const newRetryCount = task.retry_count + 1;

			if (newRetryCount >= task.max_retries) {
				this.db
					.query(
						"UPDATE scheduled_tasks SET last_status = 'failed', last_error = ?, retry_count = ?, enabled = 0 WHERE id = ?",
					)
					.run(error.message, newRetryCount, task.id);
			} else {
				const backoffMs = this.baseBackoffMs * Math.pow(2, newRetryCount - 1);
				const retryAt = new Date(Date.now() + backoffMs).toISOString();
				this.db
					.query(
						"UPDATE scheduled_tasks SET last_status = 'failed', last_error = ?, retry_count = ?, next_run_at = ? WHERE id = ?",
					)
					.run(error.message, newRetryCount, retryAt, task.id);
			}
		}
	}

	private calculateNextRun(scheduleType: "cron" | "interval", scheduleValue: string | number): Date {
		if (scheduleType === "interval") {
			const ms =
				typeof scheduleValue === "number" ? scheduleValue : parseInt(String(scheduleValue), 10);
			return new Date(Date.now() + ms);
		}
		return nextCronDate(String(scheduleValue), new Date());
	}
}

export function nextCronDate(expression: string, from: Date): Date {
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5) {
		throw new Error(`Invalid cron expression: "${expression}" (expected 5 fields, got ${parts.length})`);
	}

	const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts;

	// Start searching from the next minute
	const candidate = new Date(from);
	candidate.setSeconds(0, 0);
	candidate.setMinutes(candidate.getMinutes() + 1);

	const limit = new Date(candidate.getTime() + 366 * 24 * 60 * 60 * 1000);

	while (candidate < limit) {
		if (!matches(candidate.getMonth() + 1, monthExpr, 1, 12)) {
			candidate.setMonth(candidate.getMonth() + 1, 1);
			candidate.setHours(0, 0, 0, 0);
			continue;
		}

		const domMatch = domExpr === "*" || matches(candidate.getDate(), domExpr, 1, 31);
		const dowMatch = dowExpr === "*" || matches(candidate.getDay(), dowExpr, 0, 6);
		if (!domMatch || !dowMatch) {
			candidate.setDate(candidate.getDate() + 1);
			candidate.setHours(0, 0, 0, 0);
			continue;
		}

		if (!matches(candidate.getHours(), hourExpr, 0, 23)) {
			candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
			continue;
		}

		if (!matches(candidate.getMinutes(), minuteExpr, 0, 59)) {
			candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
			continue;
		}

		return new Date(candidate);
	}

	throw new Error(`Could not find next run date within 366 days for: "${expression}"`);
}

function matches(value: number, expr: string, min: number, max: number): boolean {
	return expandField(expr, min, max).has(value);
}

function expandField(expr: string, min: number, max: number): Set<number> {
	const result = new Set<number>();

	for (const part of expr.split(",")) {
		if (part === "*") {
			for (let i = min; i <= max; i++) result.add(i);
		} else if (part.includes("/")) {
			const [rangeStr, stepStr] = part.split("/");
			const step = parseInt(stepStr, 10);
			let start = min;
			let end = max;

			if (rangeStr !== "*") {
				if (rangeStr.includes("-")) {
					const [s, e] = rangeStr.split("-").map(Number);
					start = s;
					end = e;
				} else {
					start = parseInt(rangeStr, 10);
				}
			}

			for (let i = start; i <= end; i += step) result.add(i);
		} else if (part.includes("-")) {
			const [start, end] = part.split("-").map(Number);
			for (let i = start; i <= end; i++) result.add(i);
		} else {
			result.add(parseInt(part, 10));
		}
	}

	return result;
}
