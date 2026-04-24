import type { Database } from "bun:sqlite";

export interface ScopedSettings {
  get<T>(key: string, defaultValue: T): T;
  set(key: string, value: unknown): Promise<void>;
}

export class SettingsManager {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  get<T>(scope: string, key: string, defaultValue: T): T {
    const row = this.db
      .query<{ value: string | null }, [string, string]>("SELECT value FROM settings WHERE scope = ? AND key = ?")
      .get(scope, key);

    if (row === null || row.value === null) {
      return defaultValue;
    }

    return JSON.parse(row.value) as T;
  }

  set(scope: string, key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    const now = new Date().toISOString();
    this.db
      .query(
        `INSERT INTO settings (scope, key, value, updated_at)
				 VALUES (?, ?, ?, ?)
				 ON CONFLICT (scope, key) DO UPDATE SET
				     value = excluded.value,
				     updated_at = excluded.updated_at`,
      )
      .run(scope, key, serialized, now);
    return Promise.resolve();
  }

  forScope(scope: string): ScopedSettings {
    return {
      get: <T>(key: string, defaultValue: T) => this.get(scope, key, defaultValue),
      set: (key: string, value: unknown) => this.set(scope, key, value),
    };
  }
}
