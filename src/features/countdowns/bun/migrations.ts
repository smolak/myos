import type { Migration } from "@core/types";

export const countdownsMigrations: Migration[] = [
  {
    version: "001",
    name: "create-countdowns",
    up: `
      CREATE TABLE countdowns (
        id                   TEXT NOT NULL PRIMARY KEY,
        name                 TEXT NOT NULL,
        target_date          TEXT NOT NULL,
        archived_at          TEXT,
        reached_notified_at  TEXT,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL
      )
    `,
  },
];
