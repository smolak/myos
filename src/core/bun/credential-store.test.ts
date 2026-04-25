import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CredentialStore } from "./credential-store";
import { DatabaseManager } from "./database-manager";

describe("CredentialStore", () => {
  let dbManager: DatabaseManager;
  let store: CredentialStore;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-creds-"));
    dbManager = new DatabaseManager(tmpDir);
    const coreDb = dbManager.getCoreDatabase();
    coreDb
      .query(
        "INSERT INTO features (id, name, version, enabled, manifest, installed_at, updated_at) VALUES ('weather', 'Weather', '1.0.0', 1, '{}', datetime('now'), datetime('now'))",
      )
      .run();
    store = new CredentialStore(coreDb);
  });

  afterEach(async () => {
    dbManager.closeAll();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("store and retrieve", () => {
    test("returns null when credential not set", async () => {
      const val = await store.retrieve("weather", "openweathermap", "api-key");
      expect(val).toBeNull();
    });

    test("stores and retrieves a credential", async () => {
      await store.store("weather", "openweathermap", "api-key", "secret123");
      const val = await store.retrieve("weather", "openweathermap", "api-key");
      expect(val).toBe("secret123");
    });

    test("stored value is encrypted at rest", async () => {
      await store.store("weather", "openweathermap", "api-key", "secret123");
      const row = dbManager
        .getCoreDatabase()
        .query<{ encrypted_value: string }, []>("SELECT encrypted_value FROM credentials")
        .get();
      expect(row).not.toBeNull();
      expect(row?.encrypted_value).not.toBe("secret123");
    });

    test("overwrites existing credential on store", async () => {
      await store.store("weather", "openweathermap", "api-key", "old-key");
      await store.store("weather", "openweathermap", "api-key", "new-key");
      const val = await store.retrieve("weather", "openweathermap", "api-key");
      expect(val).toBe("new-key");
      const count = dbManager.getCoreDatabase().query<{ c: number }, []>("SELECT COUNT(*) as c FROM credentials").get();
      expect(count?.c).toBe(1);
    });

    test("different credential types are independent", async () => {
      await store.store("weather", "openweathermap", "api-key", "keyA");
      await store.store("weather", "openweathermap", "refresh-token", "tokenB");
      expect(await store.retrieve("weather", "openweathermap", "api-key")).toBe("keyA");
      expect(await store.retrieve("weather", "openweathermap", "refresh-token")).toBe("tokenB");
    });
  });

  describe("delete", () => {
    test("deletes a specific credential type", async () => {
      await store.store("weather", "openweathermap", "api-key", "key1");
      await store.delete("weather", "openweathermap", "api-key");
      expect(await store.retrieve("weather", "openweathermap", "api-key")).toBeNull();
    });

    test("deletes all credentials for a service when type omitted", async () => {
      await store.store("weather", "openweathermap", "api-key", "key1");
      await store.store("weather", "openweathermap", "refresh-token", "tok1");
      await store.delete("weather", "openweathermap");
      expect(await store.retrieve("weather", "openweathermap", "api-key")).toBeNull();
      expect(await store.retrieve("weather", "openweathermap", "refresh-token")).toBeNull();
    });

    test("delete of non-existent credential is a no-op", async () => {
      await expect(store.delete("weather", "openweathermap", "api-key")).resolves.toBeUndefined();
    });
  });

  describe("forScope", () => {
    test("scoped accessor stores and retrieves correctly", async () => {
      const scoped = store.forScope("weather");
      await scoped.store("openweathermap", "api-key", "scoped-key");
      expect(await scoped.retrieve("openweathermap", "api-key")).toBe("scoped-key");
    });

    test("scoped accessor is isolated from other feature scopes", async () => {
      const coreDb = dbManager.getCoreDatabase();
      coreDb
        .query(
          "INSERT INTO features (id, name, version, enabled, manifest, installed_at, updated_at) VALUES ('todo', 'Todo', '1.0.0', 1, '{}', datetime('now'), datetime('now'))",
        )
        .run();
      const weatherScoped = store.forScope("weather");
      const todoScoped = store.forScope("todo");
      await weatherScoped.store("openweathermap", "api-key", "weather-key");
      expect(await todoScoped.retrieve("openweathermap", "api-key")).toBeNull();
    });
  });
});
