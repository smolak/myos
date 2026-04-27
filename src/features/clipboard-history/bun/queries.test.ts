import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { addEntry } from "./actions";
import { clipboardHistoryMigrations } from "./migrations";
import { getAllEntries, getMostRecentContent } from "./queries";

describe("clipboard-history queries", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-clipboard-queries-"));
    db = new Database(join(tmpDir, "clipboard.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "clipboard-history", clipboardHistoryMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("getAllEntries", () => {
    test("returns empty array when no entries", async () => {
      const result = await getAllEntries(db, {});
      expect(result).toEqual([]);
    });

    test("returns entries ordered by created_at descending", async () => {
      await addEntry(db, { content: "first" });
      await addEntry(db, { content: "second" });
      await addEntry(db, { content: "third" });
      const result = await getAllEntries(db, {});
      expect(result[0].content).toBe("third");
      expect(result[1].content).toBe("second");
      expect(result[2].content).toBe("first");
    });

    test("maps rows to ClipboardEntry shape", async () => {
      const { id } = await addEntry(db, { content: "hello" });
      const result = await getAllEntries(db, {});
      expect(result[0].id).toBe(id);
      expect(result[0].content).toBe("hello");
      expect(result[0].contentType).toBe("text");
      expect(typeof result[0].createdAt).toBe("string");
    });

    test("respects limit param", async () => {
      await addEntry(db, { content: "a" });
      await addEntry(db, { content: "b" });
      await addEntry(db, { content: "c" });
      const result = await getAllEntries(db, { limit: 2 });
      expect(result).toHaveLength(2);
    });

    test("filters by search term", async () => {
      await addEntry(db, { content: "foo bar baz" });
      await addEntry(db, { content: "hello world" });
      const result = await getAllEntries(db, { search: "bar" });
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("foo bar baz");
    });

    test("search is case-insensitive via LIKE", async () => {
      await addEntry(db, { content: "Hello World" });
      const result = await getAllEntries(db, { search: "hello" });
      expect(result).toHaveLength(1);
    });

    test("returns all entries when search is empty string", async () => {
      await addEntry(db, { content: "a" });
      await addEntry(db, { content: "b" });
      const result = await getAllEntries(db, { search: "" });
      expect(result).toHaveLength(2);
    });
  });

  describe("getMostRecentContent", () => {
    test("returns null when no entries", async () => {
      const result = await getMostRecentContent(db);
      expect(result).toBeNull();
    });

    test("returns the most recently added content", async () => {
      await addEntry(db, { content: "older" });
      await addEntry(db, { content: "newer" });
      const result = await getMostRecentContent(db);
      expect(result).toBe("newer");
    });
  });
});
