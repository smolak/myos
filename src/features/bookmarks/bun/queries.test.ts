import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { createBookmark } from "./actions";
import { bookmarksMigrations } from "./migrations";
import { getAllBookmarks, getBookmarkById } from "./queries";

describe("Bookmarks queries", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-bookmarks-queries-"));
    db = new Database(join(tmpDir, "bookmarks.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "bookmarks", bookmarksMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getAllBookmarks", () => {
    test("returns empty array when no bookmarks", async () => {
      const result = await getAllBookmarks(db, {});
      expect(result).toEqual([]);
    });

    test("returns all bookmarks ordered newest first", async () => {
      const { id: id1 } = await createBookmark(db, { title: "First", url: "https://first.com" });
      const { id: id2 } = await createBookmark(db, { title: "Second", url: "https://second.com" });
      db.run("UPDATE bookmarks SET created_at = '2025-01-01T00:00:00.000Z' WHERE id = ?", [id1]);
      db.run("UPDATE bookmarks SET created_at = '2025-01-02T00:00:00.000Z' WHERE id = ?", [id2]);
      const result = await getAllBookmarks(db, {});
      expect(result).toHaveLength(2);
      expect(result[0]?.title).toBe("Second");
      expect(result[1]?.title).toBe("First");
    });

    test("parses tags from JSON", async () => {
      await createBookmark(db, { title: "Tagged", url: "https://example.com", tags: ["dev", "tools"] });
      const result = await getAllBookmarks(db, {});
      expect(result[0]?.tags).toEqual(["dev", "tools"]);
    });

    test("filters by folder", async () => {
      await createBookmark(db, { title: "Work item", url: "https://work.com", folder: "Work" });
      await createBookmark(db, { title: "Personal item", url: "https://personal.com", folder: "Personal" });
      const result = await getAllBookmarks(db, { folder: "Work" });
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Work item");
    });

    test("filters by tag", async () => {
      await createBookmark(db, { title: "Dev tool", url: "https://dev.com", tags: ["dev"] });
      await createBookmark(db, { title: "News site", url: "https://news.com", tags: ["news"] });
      const result = await getAllBookmarks(db, { tag: "dev" });
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Dev tool");
    });

    test("returns bookmarks with null description and folder when not set", async () => {
      await createBookmark(db, { title: "Minimal", url: "https://minimal.com" });
      const result = await getAllBookmarks(db, {});
      expect(result[0]?.description).toBeNull();
      expect(result[0]?.folder).toBeNull();
    });
  });

  describe("getBookmarkById", () => {
    test("returns null for non-existent id", async () => {
      const result = await getBookmarkById(db, { id: "ghost" });
      expect(result).toBeNull();
    });

    test("returns the bookmark with all fields", async () => {
      const { id } = await createBookmark(db, {
        title: "Example",
        url: "https://example.com",
        description: "A site",
        folder: "Work",
        tags: ["useful"],
      });
      const result = await getBookmarkById(db, { id });
      expect(result?.id).toBe(id);
      expect(result?.title).toBe("Example");
      expect(result?.url).toBe("https://example.com");
      expect(result?.description).toBe("A site");
      expect(result?.folder).toBe("Work");
      expect(result?.tags).toEqual(["useful"]);
    });
  });
});
