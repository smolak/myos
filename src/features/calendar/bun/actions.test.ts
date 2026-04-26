import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { addSource, deleteSource, syncAllSources } from "./actions";
import { calendarMigrations } from "./migrations";

const BASIC_ICS = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Test Calendar
BEGIN:VEVENT
DTSTART:20241001T090000Z
DTEND:20241001T100000Z
SUMMARY:Team Meeting
UID:meeting-001@example.com
END:VEVENT
BEGIN:VEVENT
DTSTART:20241002T140000Z
DTEND:20241002T150000Z
SUMMARY:Code Review
UID:meeting-002@example.com
END:VEVENT
END:VCALENDAR`;

type FetchFn = (url: URL | RequestInfo) => Promise<Response>;

function makeFetchFn(ics: string): FetchFn {
  return async () => new Response(ics, { headers: { "content-type": "text/calendar" } });
}

describe("addSource", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-cal-add-"));
    db = new Database(join(tmpDir, "calendar.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "calendar", calendarMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns a generated id", async () => {
    const result = await addSource(db, { url: "https://example.com/cal.ics" });
    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
  });

  test("stores the source in the database", async () => {
    const { id } = await addSource(db, { url: "https://example.com/cal.ics", title: "My Cal" });
    const row = db
      .query<{ url: string; title: string }, [string]>("SELECT url, title FROM calendar_sources WHERE id = ?")
      .get(id);
    expect(row?.url).toBe("https://example.com/cal.ics");
    expect(row?.title).toBe("My Cal");
  });

  test("falls back to URL as title when title not provided", async () => {
    const { id } = await addSource(db, { url: "https://example.com/cal.ics" });
    const row = db.query<{ title: string }, [string]>("SELECT title FROM calendar_sources WHERE id = ?").get(id);
    expect(row?.title).toBe("https://example.com/cal.ics");
  });

  test("defaults syncIntervalMinutes to 60", async () => {
    const { id } = await addSource(db, { url: "https://example.com/cal.ics" });
    const row = db
      .query<{ sync_interval_minutes: number }, [string]>(
        "SELECT sync_interval_minutes FROM calendar_sources WHERE id = ?",
      )
      .get(id);
    expect(row?.sync_interval_minutes).toBe(60);
  });

  test("is idempotent — adding duplicate URL returns existing id", async () => {
    const first = await addSource(db, { url: "https://example.com/cal.ics" });
    const second = await addSource(db, { url: "https://example.com/cal.ics" });
    expect(second.id).toBe(first.id);
    const count = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM calendar_sources").get();
    expect(count?.n).toBe(1);
  });
});

describe("deleteSource", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-cal-delete-"));
    db = new Database(join(tmpDir, "calendar.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "calendar", calendarMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("removes the source", async () => {
    const { id } = await addSource(db, { url: "https://example.com/cal.ics" });
    await deleteSource(db, { id });
    const row = db.query<{ id: string }, [string]>("SELECT id FROM calendar_sources WHERE id = ?").get(id);
    expect(row).toBeNull();
  });

  test("returns success=true on successful delete", async () => {
    const { id } = await addSource(db, { url: "https://example.com/cal.ics" });
    const result = await deleteSource(db, { id });
    expect(result.success).toBe(true);
  });

  test("returns success=false for non-existent id", async () => {
    const result = await deleteSource(db, { id: "ghost" });
    expect(result.success).toBe(false);
  });
});

describe("syncAllSources", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-cal-sync-"));
    db = new Database(join(tmpDir, "calendar.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "calendar", calendarMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns synced=0 and newEvents=[] when no sources", async () => {
    const result = await syncAllSources(db, makeFetchFn(BASIC_ICS));
    expect(result.synced).toBe(0);
    expect(result.newEvents).toHaveLength(0);
  });

  test("fetches and stores events from source", async () => {
    const { id: sourceId } = await addSource(db, { url: "https://example.com/cal.ics" });
    await syncAllSources(db, makeFetchFn(BASIC_ICS));
    const events = db
      .query<{ id: string }, [string]>("SELECT id FROM calendar_events WHERE source_id = ?")
      .all(sourceId);
    expect(events).toHaveLength(2);
  });

  test("returns new events with id, sourceId, title", async () => {
    await addSource(db, { url: "https://example.com/cal.ics" });
    const { newEvents } = await syncAllSources(db, makeFetchFn(BASIC_ICS));
    expect(newEvents).toHaveLength(2);
    expect(newEvents[0]).toMatchObject({ title: "Team Meeting" });
  });

  test("updates last_synced_at after sync", async () => {
    const { id } = await addSource(db, { url: "https://example.com/cal.ics" });
    await syncAllSources(db, makeFetchFn(BASIC_ICS));
    const row = db
      .query<{ last_synced_at: string | null }, [string]>("SELECT last_synced_at FROM calendar_sources WHERE id = ?")
      .get(id);
    expect(row?.last_synced_at).not.toBeNull();
  });

  test("updates title from X-WR-CALNAME", async () => {
    const { id } = await addSource(db, { url: "https://example.com/cal.ics" });
    await syncAllSources(db, makeFetchFn(BASIC_ICS));
    const row = db.query<{ title: string }, [string]>("SELECT title FROM calendar_sources WHERE id = ?").get(id);
    expect(row?.title).toBe("Test Calendar");
  });

  test("is idempotent — second sync does not duplicate events", async () => {
    await addSource(db, { url: "https://example.com/cal.ics" });
    await syncAllSources(db, makeFetchFn(BASIC_ICS));
    const second = await syncAllSources(db, makeFetchFn(BASIC_ICS));
    expect(second.newEvents).toHaveLength(0);
    const count = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM calendar_events").get();
    expect(count?.n).toBe(2);
  });

  test("continues syncing other sources when one fails", async () => {
    await addSource(db, { url: "https://fails.com/cal.ics" });
    await addSource(db, { url: "https://succeeds.com/cal.ics" });
    const partialFetch: FetchFn = async (url) => {
      const u = typeof url === "string" ? url : (url as Request).url;
      if (u.includes("fails")) throw new Error("Network error");
      return new Response(BASIC_ICS, { headers: { "content-type": "text/calendar" } });
    };
    const result = await syncAllSources(db, partialFetch);
    expect(result.synced).toBe(2);
    expect(result.newEvents).toHaveLength(2);
  });
});
