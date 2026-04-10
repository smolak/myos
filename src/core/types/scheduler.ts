export type ScheduleType = "cron" | "interval";

export type TaskStatus = "success" | "failed";

export interface ScheduledTask {
	id: string;
	featureId: string;
	name: string;
	scheduleType: ScheduleType;
	scheduleValue: string | number;
	enabled: boolean;
	lastRunAt: string | null;
	nextRunAt: string;
	lastStatus: TaskStatus | null;
	lastError: string | null;
	retryCount: number;
	maxRetries: number;
	createdAt: string;
}
