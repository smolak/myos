import type { Migration } from "@core/types";

export const migration003: Migration = {
	version: "003",
	name: "action-queue-columns",
	up: `
    ALTER TABLE execution_actions ADD COLUMN correlation_id TEXT;
    ALTER TABLE execution_actions ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3;
  `,
};
