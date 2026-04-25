import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import { decrypt, encrypt } from "./crypto";

export interface ScopedCredentials {
  store(serviceName: string, credentialType: string, value: string): Promise<void>;
  retrieve(serviceName: string, credentialType: string): Promise<string | null>;
  delete(serviceName: string, credentialType?: string): Promise<void>;
}

export class CredentialStore {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async store(featureId: string, serviceName: string, credentialType: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    const encrypted = await encrypt(value);
    const existing = this.db
      .query<{ id: string }, [string, string, string]>(
        "SELECT id FROM credentials WHERE feature_id = ? AND service_name = ? AND credential_type = ?",
      )
      .get(featureId, serviceName, credentialType);

    if (existing) {
      this.db
        .query("UPDATE credentials SET encrypted_value = ?, updated_at = ? WHERE id = ?")
        .run(encrypted, now, existing.id);
    } else {
      this.db
        .query(
          `INSERT INTO credentials (id, feature_id, service_name, credential_type, encrypted_value, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(nanoid(), featureId, serviceName, credentialType, encrypted, now, now);
    }
    return Promise.resolve();
  }

  async retrieve(featureId: string, serviceName: string, credentialType: string): Promise<string | null> {
    const row = this.db
      .query<{ encrypted_value: string }, [string, string, string]>(
        "SELECT encrypted_value FROM credentials WHERE feature_id = ? AND service_name = ? AND credential_type = ?",
      )
      .get(featureId, serviceName, credentialType);

    if (!row) return null;
    return decrypt(row.encrypted_value);
  }

  async delete(featureId: string, serviceName: string, credentialType?: string): Promise<void> {
    if (credentialType !== undefined) {
      this.db
        .query("DELETE FROM credentials WHERE feature_id = ? AND service_name = ? AND credential_type = ?")
        .run(featureId, serviceName, credentialType);
    } else {
      this.db.query("DELETE FROM credentials WHERE feature_id = ? AND service_name = ?").run(featureId, serviceName);
    }
  }

  forScope(featureId: string): ScopedCredentials {
    return {
      store: (serviceName, credentialType, value) => this.store(featureId, serviceName, credentialType, value),
      retrieve: (serviceName, credentialType) => this.retrieve(featureId, serviceName, credentialType),
      delete: (serviceName, credentialType) => this.delete(featureId, serviceName, credentialType),
    };
  }
}
