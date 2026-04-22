import type { Database } from "bun:sqlite";
import { runMigrations } from "./migration-runner";
import type { DatabaseManager } from "./database-manager";
import type { SettingsManager } from "./settings-manager";
import type { EventBus } from "./event-bus";
import type { ActionQueue } from "./action-queue";
import type { Scheduler } from "./scheduler";
import type {
	ActionMap,
	ActionMeta,
	EventMap,
	FeatureContext,
	FeatureDefinition,
	FeatureLifecycleContext,
	QueryMap,
	ScheduleConfig,
	ScopedLogger,
} from "@core/types";

export class FeatureRegistry {
	private readonly coreDb: Database;
	private readonly dbManager: DatabaseManager;
	private readonly settingsManager: SettingsManager;
	private readonly eventBus: EventBus;
	private readonly actionQueue: ActionQueue;
	private readonly scheduler: Scheduler;

	constructor(
		dbManager: DatabaseManager,
		settingsManager: SettingsManager,
		eventBus: EventBus,
		actionQueue: ActionQueue,
		scheduler: Scheduler,
	) {
		this.coreDb = dbManager.getCoreDatabase();
		this.dbManager = dbManager;
		this.settingsManager = settingsManager;
		this.eventBus = eventBus;
		this.actionQueue = actionQueue;
		this.scheduler = scheduler;
	}

	async startup(features: readonly FeatureDefinition[]): Promise<void> {
		for (const feature of features) {
			await this.register(feature);
		}
		for (const feature of features) {
			await this.activate(feature);
		}
		await this.actionQueue.resumePending();
	}

	private async register(feature: FeatureDefinition): Promise<void> {
		const featureDb = this.dbManager.getFeatureDatabase(feature.id);
		runMigrations(featureDb, feature.id, feature.migrations);

		const now = new Date().toISOString();
		const existing = this.coreDb
			.query<{ id: string; version: string }, [string]>(
				"SELECT id, version FROM features WHERE id = ?",
			)
			.get(feature.id);

		if (existing === null) {
			const ctx = this.buildLifecycleContext(featureDb, feature.id);
			await feature.install(ctx);
			this.coreDb
				.query(
					`INSERT INTO features (id, name, version, enabled, manifest, installed_at, updated_at)
					 VALUES (?, ?, ?, 1, ?, ?, ?)`,
				)
				.run(feature.id, feature.name, feature.version, JSON.stringify(feature.manifest), now, now);
		} else if (existing.version !== feature.version) {
			this.coreDb
				.query("UPDATE features SET version = ?, manifest = ?, updated_at = ? WHERE id = ?")
				.run(feature.version, JSON.stringify(feature.manifest), now, feature.id);
		}
	}

	private async activate(feature: FeatureDefinition): Promise<void> {
		const row = this.coreDb
			.query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?")
			.get(feature.id);

		if (!row || !row.enabled) {
			return;
		}

		try {
			const featureDb = this.dbManager.getFeatureDatabase(feature.id);
			const ctx = this.buildFeatureContext(featureDb, feature.id);
			await feature.activate(ctx);
		} catch (error) {
			const now = new Date().toISOString();
			this.coreDb
				.query("UPDATE features SET enabled = 0, updated_at = ? WHERE id = ?")
				.run(now, feature.id);
			this.buildLogger(feature.id).error("Feature activation failed, auto-disabled:", error);
		}
	}

	private buildLifecycleContext(db: Database, featureId: string): FeatureLifecycleContext {
		return {
			db,
			log: this.buildLogger(featureId),
		};
	}

	private buildFeatureContext(db: Database, featureId: string): FeatureContext {
		const { eventBus, actionQueue, scheduler } = this;
		return {
			db,
			events: {
				emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
					eventBus.emit(event as string, featureId, payload);
				},
			},
			actions: {
				handle<K extends keyof ActionMap>(
					action: K,
					handler: (
						params: ActionMap[K]["params"],
						meta: ActionMeta,
					) => Promise<ActionMap[K]["result"]>,
				): void {
					actionQueue.registerHandler(featureId, action as string, handler as Parameters<typeof actionQueue.registerHandler>[2]);
				},
			},
			queries: {
				handle<K extends keyof QueryMap>(
					query: K,
					handler: (params: QueryMap[K]["params"]) => Promise<QueryMap[K]["result"]>,
				): void {
					actionQueue.registerQueryHandler(featureId, query as string, handler as Parameters<typeof actionQueue.registerQueryHandler>[2]);
				},
			},
			subscribe(event: string, handler: (payload: unknown) => Promise<void>): void {
				eventBus.subscribe(event, handler);
			},
			query: (feature: string, queryName: string, params: unknown) =>
				actionQueue.executeQuery(feature, queryName, params),
			scheduler: {
				register(taskId: string, schedule: ScheduleConfig, handler: () => Promise<void>): void {
					scheduler.registerTask({
						taskId,
						featureId,
						name: taskId,
						scheduleType: schedule.type,
						scheduleValue: schedule.value,
						maxRetries: schedule.maxRetries,
					});
					scheduler.registerHandler(taskId, handler);
				},
			},
			settings: this.settingsManager.forScope(featureId),
			log: this.buildLogger(featureId),
		};
	}

	private buildLogger(featureId: string): ScopedLogger {
		return {
			info: (msg, ...args) => console.log(`[${featureId}] INFO: ${msg}`, ...args),
			warn: (msg, ...args) => console.warn(`[${featureId}] WARN: ${msg}`, ...args),
			error: (msg, ...args) => console.error(`[${featureId}] ERROR: ${msg}`, ...args),
			debug: (msg, ...args) => console.debug(`[${featureId}] DEBUG: ${msg}`, ...args),
		};
	}
}
