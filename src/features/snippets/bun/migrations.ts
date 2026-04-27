import type { Migration } from "@core/types";

export const snippetsMigrations: Migration[] = [
  {
    version: "001",
    name: "create-snippets",
    up: `
      CREATE TABLE snippets (
        id          TEXT    NOT NULL PRIMARY KEY,
        name        TEXT    NOT NULL,
        template    TEXT    NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL,
        updated_at  TEXT    NOT NULL
      )
    `,
  },
];
