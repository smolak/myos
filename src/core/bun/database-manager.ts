import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "./migration-runner";
import { coreMigrations } from "./migrations";

const FEATURE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function assertSafeFeatureId(featureId: string): void {
	if (!FEATURE_ID_PATTERN.test(featureId)) {
		throw new Error(`Invalid feature ID "${featureId}" (expected lowercase kebab-case slug)`);
	}
}

export class DatabaseManager {
	private readonly dataDir: string;
	private readonly databases = new Map<string, Database>();
	private coreDb: Database | null = null;

	constructor(dataDir: string) {
		this.dataDir = dataDir;
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(join(dataDir, "features"), { recursive: true });
	}

	getCoreDatabase(): Database {
		if (this.coreDb) {
			return this.coreDb;
		}

		const path = join(this.dataDir, "core.db");
		const db = new Database(path);
		db.run("PRAGMA journal_mode=WAL");
		db.run("PRAGMA foreign_keys=ON");
		bootstrapMigrationsTable(db);
		runMigrations(db, "core", coreMigrations);
		this.coreDb = db;
		return db;
	}

	getFeatureDatabase(featureId: string): Database {
		assertSafeFeatureId(featureId);

		const cacheKey = `feature:${featureId}`;
		const existing = this.databases.get(cacheKey);
		if (existing) {
			return existing;
		}

		const path = join(this.dataDir, "features", `${featureId}.db`);
		const db = new Database(path);
		db.run("PRAGMA journal_mode=WAL");
		db.run("PRAGMA foreign_keys=ON");
		bootstrapMigrationsTable(db);
		this.databases.set(cacheKey, db);
		return db;
	}

	closeAll(): void {
		for (const db of this.databases.values()) {
			db.close();
		}
		this.databases.clear();
		if (this.coreDb) {
			this.coreDb.close();
			this.coreDb = null;
		}
	}
}
