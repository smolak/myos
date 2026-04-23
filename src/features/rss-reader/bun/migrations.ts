import type { Migration } from "@core/types";

export const rssReaderMigrations: Migration[] = [
	{
		version: "001",
		name: "create-rss-feeds",
		up: `
			CREATE TABLE rss_feeds (
				id                     TEXT    NOT NULL PRIMARY KEY,
				url                    TEXT    NOT NULL UNIQUE,
				title                  TEXT    NOT NULL,
				description            TEXT,
				last_fetched_at        TEXT,
				fetch_interval_minutes INTEGER NOT NULL DEFAULT 30,
				created_at             TEXT    NOT NULL,
				updated_at             TEXT    NOT NULL
			)
		`,
	},
	{
		version: "002",
		name: "create-rss-entries",
		up: `
			CREATE TABLE rss_entries (
				id           TEXT    NOT NULL PRIMARY KEY,
				feed_id      TEXT    NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
				guid         TEXT    NOT NULL,
				title        TEXT    NOT NULL,
				link         TEXT    NOT NULL,
				description  TEXT,
				published_at TEXT,
				is_read      INTEGER NOT NULL DEFAULT 0,
				created_at   TEXT    NOT NULL,
				UNIQUE(feed_id, guid)
			)
		`,
	},
];
