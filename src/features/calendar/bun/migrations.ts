import type { Migration } from "@core/types";

export const calendarMigrations: Migration[] = [
  {
    version: "001",
    name: "create-calendar-sources",
    up: `
			CREATE TABLE calendar_sources (
				id                    TEXT    NOT NULL PRIMARY KEY,
				url                   TEXT    NOT NULL UNIQUE,
				title                 TEXT    NOT NULL,
				last_synced_at        TEXT,
				sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
				created_at            TEXT    NOT NULL,
				updated_at            TEXT    NOT NULL
			)
		`,
  },
  {
    version: "002",
    name: "create-calendar-events",
    up: `
			CREATE TABLE calendar_events (
				id          TEXT    NOT NULL PRIMARY KEY,
				source_id   TEXT    NOT NULL REFERENCES calendar_sources(id) ON DELETE CASCADE,
				uid         TEXT    NOT NULL,
				title       TEXT    NOT NULL,
				description TEXT,
				location    TEXT,
				start_time  TEXT    NOT NULL,
				end_time    TEXT,
				is_all_day  INTEGER NOT NULL DEFAULT 0,
				notified    INTEGER NOT NULL DEFAULT 0,
				created_at  TEXT    NOT NULL,
				updated_at  TEXT    NOT NULL,
				UNIQUE(source_id, uid)
			)
		`,
  },
];
