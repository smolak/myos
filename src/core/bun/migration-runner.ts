import { Database } from "bun:sqlite";
import type { Migration } from "@core/types";

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS migrations (
    feature_id TEXT NOT NULL,
    version    TEXT NOT NULL,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    PRIMARY KEY (feature_id, version)
);
`;

export function bootstrapMigrationsTable(db: Database): void {
	db.exec(BOOTSTRAP_SQL);
}

export function getAppliedMigrations(db: Database, featureId: string): string[] {
	bootstrapMigrationsTable(db);
	const rows = db
		.query("SELECT version FROM migrations WHERE feature_id = ? ORDER BY version ASC")
		.all(featureId) as { version: string }[];
	return rows.map((r) => r.version);
}

export function runMigrations(
	db: Database,
	featureId: string,
	migrations: Migration[],
): { applied: string[]; skipped: string[] } {
	bootstrapMigrationsTable(db);
	const applied: string[] = [];
	const skipped: string[] = [];

	for (const migration of migrations) {
		const exists = db
			.query("SELECT 1 AS ok FROM migrations WHERE feature_id = ? AND version = ?")
			.get(featureId, migration.version) as { ok: number } | null;

		if (exists) {
			skipped.push(migration.version);
			continue;
		}

		const runOne = db.transaction(() => {
			db.exec(migration.up);
			const appliedAt = new Date().toISOString();
			db.run(
				"INSERT INTO migrations (feature_id, version, name, applied_at) VALUES (?, ?, ?, ?)",
				[featureId, migration.version, migration.name, appliedAt],
			);
		});

		runOne();
		applied.push(migration.version);
	}

	return { applied, skipped };
}
