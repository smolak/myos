import type { Migration } from "@core/types";

export const migration001: Migration = {
  version: "001",
  name: "initial-schema",
  up: `
    CREATE TABLE features (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        version      TEXT NOT NULL,
        description  TEXT,
        author       TEXT,
        enabled      INTEGER NOT NULL DEFAULT 1,
        manifest     TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    );

    CREATE TABLE settings (
        scope      TEXT NOT NULL,
        key        TEXT NOT NULL,
        value      TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (scope, key)
    );
  `,
};
