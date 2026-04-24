import type { Migration } from "@core/types";

export const weatherMigrations: Migration[] = [
  {
    version: "001",
    name: "create-weather-cache",
    up: `CREATE TABLE weather_cache (
			id            TEXT NOT NULL PRIMARY KEY,
			location      TEXT NOT NULL,
			temp_celsius  REAL NOT NULL,
			feels_like    REAL NOT NULL,
			humidity      INTEGER NOT NULL,
			condition_id  INTEGER NOT NULL,
			condition_main TEXT NOT NULL,
			condition_desc TEXT NOT NULL,
			condition_icon TEXT NOT NULL,
			fetched_at    TEXT NOT NULL
		)`,
  },
];
