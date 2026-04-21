import type { Migration } from "@core/types";

export const todoMigrations: Migration[] = [
	{
		version: "001",
		name: "create-todos",
		up: `
			CREATE TABLE todos (
				id           TEXT    NOT NULL PRIMARY KEY,
				title        TEXT    NOT NULL,
				description  TEXT,
				completed    INTEGER NOT NULL DEFAULT 0,
				completed_at TEXT,
				created_at   TEXT    NOT NULL,
				updated_at   TEXT    NOT NULL
			)
		`,
	},
];
