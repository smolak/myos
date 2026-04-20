import { Database } from "bun:sqlite";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "./migration-runner";
import { coreMigrations } from "./migrations";

const require = createRequire(import.meta.url);

const FEATURE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function assertSafeFeatureId(featureId: string): void {
	if (!FEATURE_ID_PATTERN.test(featureId)) {
		throw new Error(`Invalid feature ID "${featureId}" (expected lowercase kebab-case slug)`);
	}
}

// electrobun/bun is lazy-required (not imported) so `bun test` doesn't need the native host
export function resolveDefaultDataDir(): string {
	const override = process.env.MYOS_DATA_DIR?.trim();
	if (override) {
		return override;
	}

	if (process.env.NODE_ENV === "production") {
		const { Utils } = require("electrobun/bun") as typeof import("electrobun/bun");
		return join(Utils.paths.userData, "data");
	}

	return join(process.cwd(), "data");
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
		db.exec("PRAGMA journal_mode=WAL");
		db.exec("PRAGMA foreign_keys=ON");
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
		db.exec("PRAGMA journal_mode=WAL");
		db.exec("PRAGMA foreign_keys=ON");
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
