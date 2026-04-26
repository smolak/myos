import type { Migration } from "@core/types";

export const bookmarksMigrations: Migration[] = [
  {
    version: "001",
    name: "create-bookmarks",
    up: `
      CREATE TABLE bookmarks (
        id          TEXT NOT NULL PRIMARY KEY,
        title       TEXT NOT NULL,
        url         TEXT NOT NULL,
        description TEXT,
        folder      TEXT,
        tags        TEXT NOT NULL DEFAULT '[]',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )
    `,
  },
];
