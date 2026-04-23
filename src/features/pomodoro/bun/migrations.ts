import type { Migration } from "@core/types";

export const pomodoroMigrations: Migration[] = [
	{
		version: "001",
		name: "create-pomodoro-sessions",
		up: `
			CREATE TABLE pomodoro_sessions (
				id               TEXT    NOT NULL PRIMARY KEY,
				type             TEXT    NOT NULL DEFAULT 'work',
				duration_seconds INTEGER NOT NULL,
				elapsed_seconds  INTEGER NOT NULL DEFAULT 0,
				status           TEXT    NOT NULL DEFAULT 'running',
				started_at       TEXT    NOT NULL,
				ended_at         TEXT,
				created_at       TEXT    NOT NULL,
				updated_at       TEXT    NOT NULL
			)
		`,
	},
];
