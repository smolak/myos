import type { Database } from "bun:sqlite";
import { runMigrations } from "./migration-runner";
import type { DatabaseManager } from "./database-manager";
import type { SettingsManager } from "./settings-manager";
import type {
	ActionMap,
	ActionMeta,
	EventMap,
	FeatureContext,
	FeatureDefinition,
	FeatureLifecycleContext,
	QueryMap,
	ScopedLogger,
} from "@core/types";

export class FeatureRegistry {
	private readonly coreDb: Database;
	private readonly dbManager: DatabaseManager;
	private readonly settingsManager: SettingsManager;

	constructor(dbManager: DatabaseManager, settingsManager: SettingsManager) {
		this.coreDb = dbManager.getCoreDatabase();
		this.dbManager = dbManager;
		this.settingsManager = settingsManager;
	}

	async startup(features: readonly FeatureDefinition[]): Promise<void> {
		for (const feature of features) {
			await this.register(feature);
		}
		for (const feature of features) {
			await this.activate(feature);
		}
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
		return {
			db,
			events: {
				emit<K extends keyof EventMap>(_event: K, _payload: EventMap[K]): void {},
			},
			actions: {
				handle<K extends keyof ActionMap>(
					_action: K,
					_handler: (
						params: ActionMap[K]["params"],
						meta: ActionMeta,
					) => Promise<ActionMap[K]["result"]>,
				): void {},
			},
			queries: {
				handle<K extends keyof QueryMap>(
					_query: K,
					_handler: (params: QueryMap[K]["params"]) => Promise<QueryMap[K]["result"]>,
				): void {},
			},
			subscribe(_event: string, _handler: (payload: unknown) => Promise<void>): void {},
			query: async (_feature: string, _queryName: string, _params: unknown) => undefined,
			scheduler: {
				register(_taskId: string, _handler: () => Promise<void>): void {},
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
