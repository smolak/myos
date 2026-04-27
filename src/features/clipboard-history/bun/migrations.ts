import type { Migration } from "@core/types";

export const clipboardHistoryMigrations: Migration[] = [
  {
    version: "001",
    name: "create-clipboard-entries",
    up: `
      CREATE TABLE clipboard_entries (
        id           TEXT NOT NULL PRIMARY KEY,
        content      TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'text',
        created_at   TEXT NOT NULL
      )
    `,
  },
];
