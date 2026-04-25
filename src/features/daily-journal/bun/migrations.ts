import type { Migration } from "@core/types";

export const dailyJournalMigrations: Migration[] = [
  {
    version: "001",
    name: "create-journal-notes",
    up: `
      CREATE TABLE journal_notes (
        id         TEXT NOT NULL PRIMARY KEY,
        date       TEXT NOT NULL UNIQUE,
        content    TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_notes_date ON journal_notes(date DESC);
    `,
  },
];
