export type ScheduleType = "cron" | "interval";

export type TaskStatus = "success" | "failed";

export interface ScheduledTask {
	readonly id: string;
	readonly featureId: string;
	readonly name: string;
	readonly scheduleType: ScheduleType;
	readonly scheduleValue: string | number;
	readonly enabled: boolean;
	readonly lastRunAt: string | null;
	readonly nextRunAt: string;
	readonly lastStatus: TaskStatus | null;
	readonly lastError: string | null;
	readonly retryCount: number;
	readonly maxRetries: number;
	readonly createdAt: string;
}
