import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { addEntry, clearEntries, deleteEntry, detectContentType } from "./actions";
import { clipboardHistoryMigrations } from "./migrations";

describe("clipboard-history actions", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-clipboard-actions-"));
    db = new Database(join(tmpDir, "clipboard.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "clipboard-history", clipboardHistoryMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("detectContentType", () => {
    test("returns 'url' for http URLs", () => {
      expect(detectContentType("https://example.com")).toBe("url");
    });

    test("returns 'url' for http:// URLs", () => {
      expect(detectContentType("http://example.com/path?q=1")).toBe("url");
    });

    test("returns 'text' for plain text", () => {
      expect(detectContentType("hello world")).toBe("text");
    });

    test("returns 'text' for ftp URLs", () => {
      expect(detectContentType("ftp://example.com")).toBe("text");
    });
  });

  describe("addEntry", () => {
    test("returns a generated id", async () => {
      const result = await addEntry(db, { content: "hello" });
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
    });

    test("persists content", async () => {
      const { id } = await addEntry(db, { content: "some text" });
      const row = db.query<{ content: string }, [string]>("SELECT content FROM clipboard_entries WHERE id = ?").get(id);
      expect(row?.content).toBe("some text");
    });

    test("auto-detects text content type", async () => {
      const { id } = await addEntry(db, { content: "plain text" });
      const row = db
        .query<{ content_type: string }, [string]>("SELECT content_type FROM clipboard_entries WHERE id = ?")
        .get(id);
      expect(row?.content_type).toBe("text");
    });

    test("auto-detects url content type", async () => {
      const { id } = await addEntry(db, { content: "https://example.com" });
      const row = db
        .query<{ content_type: string }, [string]>("SELECT content_type FROM clipboard_entries WHERE id = ?")
        .get(id);
      expect(row?.content_type).toBe("url");
    });

    test("respects explicit contentType override", async () => {
      const { id } = await addEntry(db, { content: "https://example.com", contentType: "text" });
      const row = db
        .query<{ content_type: string }, [string]>("SELECT content_type FROM clipboard_entries WHERE id = ?")
        .get(id);
      expect(row?.content_type).toBe("text");
    });

    test("two adds produce different ids", async () => {
      const a = await addEntry(db, { content: "a" });
      const b = await addEntry(db, { content: "b" });
      expect(a.id).not.toBe(b.id);
    });

    test("persists created_at timestamp", async () => {
      const before = new Date().toISOString();
      const { id } = await addEntry(db, { content: "x" });
      const after = new Date().toISOString();
      const row = db
        .query<{ created_at: string }, [string]>("SELECT created_at FROM clipboard_entries WHERE id = ?")
        .get(id);
      expect((row?.created_at ?? "") >= before).toBe(true);
      expect((row?.created_at ?? "") <= after).toBe(true);
    });
  });

  describe("deleteEntry", () => {
    test("removes the entry from DB", async () => {
      const { id } = await addEntry(db, { content: "to delete" });
      const result = await deleteEntry(db, { id });
      expect(result.success).toBe(true);
      const row = db.query<{ id: string }, [string]>("SELECT id FROM clipboard_entries WHERE id = ?").get(id);
      expect(row).toBeNull();
    });

    test("is idempotent — deleting non-existent id succeeds", async () => {
      const result = await deleteEntry(db, { id: "ghost" });
      expect(result.success).toBe(true);
    });
  });

  describe("clearEntries", () => {
    test("removes all entries", async () => {
      await addEntry(db, { content: "a" });
      await addEntry(db, { content: "b" });
      await addEntry(db, { content: "c" });
      const result = await clearEntries(db);
      expect(result.success).toBe(true);
      const count = db.query<{ n: number }, []>("SELECT COUNT(*) as n FROM clipboard_entries").get();
      expect(count?.n).toBe(0);
    });

    test("succeeds when table is already empty", async () => {
      const result = await clearEntries(db);
      expect(result.success).toBe(true);
    });
  });
});
