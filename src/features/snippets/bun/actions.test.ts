import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { createSnippet, deleteSnippet, updateSnippet } from "./actions";
import { snippetsMigrations } from "./migrations";

describe("Snippets actions", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-snippets-actions-"));
    db = new Database(join(tmpDir, "snippets.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "snippets", snippetsMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("createSnippet", () => {
    test("returns a generated id", async () => {
      const result = await createSnippet(db, { name: "Greeting", template: "Hello, {{clipboard}}!" });
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
    });

    test("persists name and template", async () => {
      const { id } = await createSnippet(db, { name: "Date stamp", template: "{{date}}" });
      const row = db
        .query<{ name: string; template: string }, [string]>("SELECT name, template FROM snippets WHERE id = ?")
        .get(id);
      expect(row?.name).toBe("Date stamp");
      expect(row?.template).toBe("{{date}}");
    });

    test("is_favorite defaults to 0", async () => {
      const { id } = await createSnippet(db, { name: "X", template: "x" });
      const row = db.query<{ is_favorite: number }, [string]>("SELECT is_favorite FROM snippets WHERE id = ?").get(id);
      expect(row?.is_favorite).toBe(0);
    });

    test("stores is_favorite=1 when isFavorite is true", async () => {
      const { id } = await createSnippet(db, { name: "Fav", template: "x", isFavorite: true });
      const row = db.query<{ is_favorite: number }, [string]>("SELECT is_favorite FROM snippets WHERE id = ?").get(id);
      expect(row?.is_favorite).toBe(1);
    });

    test("two creates produce different ids", async () => {
      const a = await createSnippet(db, { name: "A", template: "a" });
      const b = await createSnippet(db, { name: "B", template: "b" });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("updateSnippet", () => {
    test("updates name", async () => {
      const { id } = await createSnippet(db, { name: "Old", template: "t" });
      const result = await updateSnippet(db, { id, name: "New" });
      expect(result.success).toBe(true);
      const row = db.query<{ name: string }, [string]>("SELECT name FROM snippets WHERE id = ?").get(id);
      expect(row?.name).toBe("New");
    });

    test("updates template", async () => {
      const { id } = await createSnippet(db, { name: "N", template: "old tmpl" });
      await updateSnippet(db, { id, template: "new tmpl" });
      const row = db.query<{ template: string }, [string]>("SELECT template FROM snippets WHERE id = ?").get(id);
      expect(row?.template).toBe("new tmpl");
    });

    test("updates is_favorite", async () => {
      const { id } = await createSnippet(db, { name: "N", template: "t" });
      await updateSnippet(db, { id, isFavorite: true });
      const row = db.query<{ is_favorite: number }, [string]>("SELECT is_favorite FROM snippets WHERE id = ?").get(id);
      expect(row?.is_favorite).toBe(1);
    });

    test("returns success=false for non-existent id", async () => {
      const result = await updateSnippet(db, { id: "ghost", name: "X" });
      expect(result.success).toBe(false);
    });
  });

  describe("deleteSnippet", () => {
    test("removes the snippet from DB", async () => {
      const { id } = await createSnippet(db, { name: "X", template: "t" });
      const result = await deleteSnippet(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ id: string }, [string]>("SELECT id FROM snippets WHERE id = ?").get(id);
      expect(row).toBeNull();
    });

    test("is idempotent — deleting a non-existent id succeeds", async () => {
      const result = await deleteSnippet(db, { id: "ghost" });
      expect(result.success).toBe(true);
    });
  });
});
