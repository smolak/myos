import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { createBookmark, deleteBookmark, updateBookmark } from "./actions";
import { bookmarksMigrations } from "./migrations";

describe("Bookmarks actions", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-bookmarks-actions-"));
    db = new Database(join(tmpDir, "bookmarks.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "bookmarks", bookmarksMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("createBookmark", () => {
    test("returns a generated id", async () => {
      const result = await createBookmark(db, { title: "Example", url: "https://example.com" });
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
    });

    test("persists title and url", async () => {
      const { id } = await createBookmark(db, { title: "Example", url: "https://example.com" });
      const row = db
        .query<{ title: string; url: string }, [string]>("SELECT title, url FROM bookmarks WHERE id = ?")
        .get(id);
      expect(row?.title).toBe("Example");
      expect(row?.url).toBe("https://example.com");
    });

    test("description defaults to null", async () => {
      const { id } = await createBookmark(db, { title: "Example", url: "https://example.com" });
      const row = db
        .query<{ description: string | null }, [string]>("SELECT description FROM bookmarks WHERE id = ?")
        .get(id);
      expect(row?.description).toBeNull();
    });

    test("saves optional description", async () => {
      const { id } = await createBookmark(db, {
        title: "Example",
        url: "https://example.com",
        description: "A test site",
      });
      const row = db
        .query<{ description: string | null }, [string]>("SELECT description FROM bookmarks WHERE id = ?")
        .get(id);
      expect(row?.description).toBe("A test site");
    });

    test("folder defaults to null", async () => {
      const { id } = await createBookmark(db, { title: "Example", url: "https://example.com" });
      const row = db.query<{ folder: string | null }, [string]>("SELECT folder FROM bookmarks WHERE id = ?").get(id);
      expect(row?.folder).toBeNull();
    });

    test("saves optional folder", async () => {
      const { id } = await createBookmark(db, { title: "Example", url: "https://example.com", folder: "Work" });
      const row = db.query<{ folder: string | null }, [string]>("SELECT folder FROM bookmarks WHERE id = ?").get(id);
      expect(row?.folder).toBe("Work");
    });

    test("tags default to empty array", async () => {
      const { id } = await createBookmark(db, { title: "Example", url: "https://example.com" });
      const row = db.query<{ tags: string }, [string]>("SELECT tags FROM bookmarks WHERE id = ?").get(id);
      expect(JSON.parse(row?.tags ?? "null")).toEqual([]);
    });

    test("saves optional tags as JSON", async () => {
      const { id } = await createBookmark(db, {
        title: "Example",
        url: "https://example.com",
        tags: ["dev", "tools"],
      });
      const row = db.query<{ tags: string }, [string]>("SELECT tags FROM bookmarks WHERE id = ?").get(id);
      expect(JSON.parse(row?.tags ?? "null")).toEqual(["dev", "tools"]);
    });

    test("two creates produce different ids", async () => {
      const a = await createBookmark(db, { title: "A", url: "https://a.com" });
      const b = await createBookmark(db, { title: "B", url: "https://b.com" });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("updateBookmark", () => {
    test("updates the title", async () => {
      const { id } = await createBookmark(db, { title: "Old", url: "https://example.com" });
      const result = await updateBookmark(db, { id, title: "New" });
      expect(result.success).toBe(true);
      const row = db.query<{ title: string }, [string]>("SELECT title FROM bookmarks WHERE id = ?").get(id);
      expect(row?.title).toBe("New");
    });

    test("updates the url", async () => {
      const { id } = await createBookmark(db, { title: "Test", url: "https://old.com" });
      await updateBookmark(db, { id, url: "https://new.com" });
      const row = db.query<{ url: string }, [string]>("SELECT url FROM bookmarks WHERE id = ?").get(id);
      expect(row?.url).toBe("https://new.com");
    });

    test("updates tags", async () => {
      const { id } = await createBookmark(db, { title: "Test", url: "https://example.com", tags: ["old"] });
      await updateBookmark(db, { id, tags: ["new", "updated"] });
      const row = db.query<{ tags: string }, [string]>("SELECT tags FROM bookmarks WHERE id = ?").get(id);
      expect(JSON.parse(row?.tags ?? "null")).toEqual(["new", "updated"]);
    });

    test("returns success=false for non-existent id", async () => {
      const result = await updateBookmark(db, { id: "ghost", title: "X" });
      expect(result.success).toBe(false);
    });

    test("preserves unspecified fields", async () => {
      const { id } = await createBookmark(db, {
        title: "Test",
        url: "https://example.com",
        description: "desc",
        folder: "Work",
      });
      await updateBookmark(db, { id, title: "Updated" });
      const row = db
        .query<{ description: string | null; folder: string | null }, [string]>(
          "SELECT description, folder FROM bookmarks WHERE id = ?",
        )
        .get(id);
      expect(row?.description).toBe("desc");
      expect(row?.folder).toBe("Work");
    });
  });

  describe("deleteBookmark", () => {
    test("removes the bookmark from DB", async () => {
      const { id } = await createBookmark(db, { title: "Example", url: "https://example.com" });
      const result = await deleteBookmark(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ id: string }, [string]>("SELECT id FROM bookmarks WHERE id = ?").get(id);
      expect(row).toBeNull();
    });

    test("is idempotent — deleting a non-existent id succeeds", async () => {
      const result = await deleteBookmark(db, { id: "ghost" });
      expect(result.success).toBe(true);
    });
  });
});
