import type { Migration } from "@core/types";

export const habitsMigrations: Migration[] = [
  {
    version: "001",
    name: "create-habits",
    up: `
      CREATE TABLE habits (
        id          TEXT    NOT NULL PRIMARY KEY,
        name        TEXT    NOT NULL,
        description TEXT,
        frequency   TEXT    NOT NULL DEFAULT 'daily',
        created_at  TEXT    NOT NULL,
        updated_at  TEXT    NOT NULL
      )
    `,
  },
  {
    version: "002",
    name: "create-habit-completions",
    up: `
      CREATE TABLE habit_completions (
        id           TEXT NOT NULL PRIMARY KEY,
        habit_id     TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date         TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        UNIQUE(habit_id, date)
      )
    `,
  },
];
