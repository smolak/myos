# Core Services Rules

Core services are the foundation of the app. Bugs here cascade everywhere.

## Expectations

- **High test coverage.** Every public method tested, including error paths.
- **Descriptive errors.** `throw new Error(\`Feature "${featureId}" not found\`)` — not `throw new Error("not found")`.
- **WAL mode** on all SQLite databases.
- **nanoid** for generated IDs (21 chars, URL-safe). `INTEGER AUTOINCREMENT` only for `event_log`.

## Core Services (defined in specs/ARCHITECTURE.md)

Feature Registry, Scheduler, Event Bus, Action Queue, Script Engine, Database Manager, Settings Manager, Credential Store, Notification Service, Backup Service, Command Palette, Theming.
