import type { Migration } from "@core/types";

export const migration002: Migration = {
	version: "002",
	name: "remaining-core-schema",
	up: `
    CREATE TABLE scheduled_tasks (
        id              TEXT PRIMARY KEY,
        feature_id      TEXT NOT NULL REFERENCES features(id),
        name            TEXT NOT NULL,
        schedule_type   TEXT NOT NULL,
        schedule_value  TEXT NOT NULL,
        enabled         INTEGER NOT NULL DEFAULT 1,
        last_run_at     TEXT,
        next_run_at     TEXT NOT NULL,
        last_status     TEXT,
        last_error      TEXT,
        retry_count     INTEGER NOT NULL DEFAULT 0,
        max_retries     INTEGER NOT NULL DEFAULT 3,
        created_at      TEXT NOT NULL
    );
    CREATE INDEX idx_tasks_next_run ON scheduled_tasks(next_run_at) WHERE enabled = 1;

    CREATE TABLE scripts (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        code        TEXT NOT NULL,
        enabled     INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE script_executions (
        id              TEXT PRIMARY KEY,
        script_id       TEXT NOT NULL REFERENCES scripts(id),
        triggered_by    TEXT NOT NULL,
        trigger_payload TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        created_at      TEXT NOT NULL,
        completed_at    TEXT
    );

    CREATE TABLE execution_actions (
        id            TEXT PRIMARY KEY,
        execution_id  TEXT NOT NULL REFERENCES script_executions(id),
        sequence      INTEGER NOT NULL,
        feature_id    TEXT NOT NULL,
        action_name   TEXT NOT NULL,
        params        TEXT NOT NULL,
        depends_on    INTEGER,
        output_key    TEXT,
        status        TEXT NOT NULL DEFAULT 'pending',
        result        TEXT,
        error         TEXT,
        retry_count   INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        completed_at  TEXT
    );
    CREATE INDEX idx_exec_actions_pending ON execution_actions(execution_id, sequence) WHERE status = 'pending';

    CREATE TABLE script_subscriptions (
        script_id  TEXT NOT NULL REFERENCES scripts(id),
        event_name TEXT NOT NULL,
        PRIMARY KEY (script_id, event_name)
    );

    CREATE TABLE script_store (
        script_id  TEXT NOT NULL REFERENCES scripts(id),
        key        TEXT NOT NULL,
        value      TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (script_id, key)
    );

    CREATE TABLE event_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        feature_id TEXT NOT NULL,
        payload    TEXT,
        created_at TEXT NOT NULL
    );
    CREATE INDEX idx_events_name_time ON event_log(event_name, created_at);

    CREATE TABLE credentials (
        id              TEXT PRIMARY KEY,
        feature_id      TEXT NOT NULL REFERENCES features(id),
        service_name    TEXT NOT NULL,
        credential_type TEXT NOT NULL,
        encrypted_value TEXT NOT NULL,
        metadata        TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
    );
  `,
};
