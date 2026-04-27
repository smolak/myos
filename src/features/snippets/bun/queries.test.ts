import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { createSnippet } from "./actions";
import { snippetsMigrations } from "./migrations";
import { expandSnippet, getAllSnippets, getSnippetById } from "./queries";

describe("Snippets queries", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-snippets-queries-"));
    db = new Database(join(tmpDir, "snippets.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "snippets", snippetsMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getAllSnippets", () => {
    test("returns empty array when no snippets", async () => {
      const result = await getAllSnippets(db, {});
      expect(result).toEqual([]);
    });

    test("returns all snippets ordered by name", async () => {
      await createSnippet(db, { name: "Zebra", template: "z" });
      await createSnippet(db, { name: "Alpha", template: "a" });
      const result = await getAllSnippets(db, {});
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe("Alpha");
      expect(result[1]?.name).toBe("Zebra");
    });

    test("maps is_favorite to boolean isFavorite", async () => {
      await createSnippet(db, { name: "Fav", template: "t", isFavorite: true });
      await createSnippet(db, { name: "Not", template: "t", isFavorite: false });
      const result = await getAllSnippets(db, {});
      const fav = result.find((s) => s.name === "Fav");
      const notFav = result.find((s) => s.name === "Not");
      expect(fav?.isFavorite).toBe(true);
      expect(notFav?.isFavorite).toBe(false);
    });

    test("favoritesOnly filters to only favorite snippets", async () => {
      await createSnippet(db, { name: "Fav", template: "t", isFavorite: true });
      await createSnippet(db, { name: "Not", template: "t", isFavorite: false });
      const result = await getAllSnippets(db, { favoritesOnly: true });
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Fav");
    });
  });

  describe("getSnippetById", () => {
    test("returns the snippet for a known id", async () => {
      const { id } = await createSnippet(db, { name: "My snippet", template: "{{date}}" });
      const result = await getSnippetById(db, { id });
      expect(result?.id).toBe(id);
      expect(result?.name).toBe("My snippet");
      expect(result?.template).toBe("{{date}}");
    });

    test("returns null for unknown id", async () => {
      const result = await getSnippetById(db, { id: "ghost" });
      expect(result).toBeNull();
    });
  });

  describe("expandSnippet", () => {
    test("returns expanded text with {{clipboard}} substituted", async () => {
      const { id } = await createSnippet(db, { name: "Clip", template: "Copied: {{clipboard}}" });
      const result = await expandSnippet(db, { id, clipboard: "hello" });
      expect(result.text).toBe("Copied: hello");
    });

    test("{{date}} placeholder is replaced with a date string", async () => {
      const { id } = await createSnippet(db, { name: "D", template: "Date: {{date}}" });
      const result = await expandSnippet(db, { id });
      expect(result.text).toMatch(/^Date: \d{4}-\d{2}-\d{2}$/);
    });

    test("throws when snippet id not found", async () => {
      await expect(expandSnippet(db, { id: "ghost" })).rejects.toThrow("Snippet not found");
    });
  });
});
