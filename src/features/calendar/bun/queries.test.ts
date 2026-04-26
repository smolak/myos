import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { addSource, syncAllSources } from "./actions";
import { calendarMigrations } from "./migrations";
import { getEvents, getSources, getUpcoming } from "./queries";

const ICS_WITH_EVENTS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20241001T090000Z
DTEND:20241001T100000Z
SUMMARY:Past Event
UID:event-past@example.com
END:VEVENT
BEGIN:VEVENT
DTSTART:20501001T090000Z
DTEND:20501001T100000Z
SUMMARY:Future Event
UID:event-future@example.com
END:VEVENT
END:VCALENDAR`;

describe("getSources", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-cal-q-sources-"));
    db = new Database(join(tmpDir, "calendar.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "calendar", calendarMigrations);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns empty array when no sources", async () => {
    const result = await getSources(db, {});
    expect(result).toHaveLength(0);
  });

  test("returns all sources ordered by created_at", async () => {
    await addSource(db, { url: "https://a.com/cal.ics", title: "A" });
    await addSource(db, { url: "https://b.com/cal.ics", title: "B" });
    const result = await getSources(db, {});
    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe("A");
    expect(result[1]?.title).toBe("B");
  });

  test("returns source with correct shape", async () => {
    const { id } = await addSource(db, { url: "https://example.com/cal.ics", title: "Test" });
    const result = await getSources(db, {});
    expect(result[0]?.id).toBe(id);
    expect(result[0]?.url).toBe("https://example.com/cal.ics");
    expect(result[0]?.title).toBe("Test");
    expect(result[0]?.lastSyncedAt).toBeNull();
  });
});

describe("getEvents", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-cal-q-events-"));
    db = new Database(join(tmpDir, "calendar.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "calendar", calendarMigrations);
    await addSource(db, { url: "https://example.com/cal.ics" });
    await syncAllSources(db, async () => new Response(ICS_WITH_EVENTS));
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns all events when no filter", async () => {
    const result = await getEvents(db, {});
    expect(result).toHaveLength(2);
  });

  test("filters by sourceId", async () => {
    const sources = await getSources(db, {});
    const result = await getEvents(db, { sourceId: sources[0]?.id });
    expect(result).toHaveLength(2);
  });

  test("filters by from date", async () => {
    const result = await getEvents(db, { from: "2045-01-01T00:00:00.000Z" });
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Future Event");
  });

  test("filters by to date", async () => {
    const result = await getEvents(db, { to: "2045-01-01T00:00:00.000Z" });
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Past Event");
  });

  test("respects limit", async () => {
    const result = await getEvents(db, { limit: 1 });
    expect(result).toHaveLength(1);
  });

  test("returns events with correct shape", async () => {
    const result = await getEvents(db, {});
    const event = result.find((e) => e.title === "Past Event");
    expect(event?.startTime).toBe("2024-10-01T09:00:00.000Z");
    expect(event?.endTime).toBe("2024-10-01T10:00:00.000Z");
    expect(event?.isAllDay).toBe(false);
  });
});

describe("getUpcoming", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-cal-q-upcoming-"));
    db = new Database(join(tmpDir, "calendar.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "calendar", calendarMigrations);
    await addSource(db, { url: "https://example.com/cal.ics" });
    await syncAllSources(db, async () => new Response(ICS_WITH_EVENTS));
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("only returns future events", async () => {
    const result = await getUpcoming(db, {});
    expect(result.every((e) => e.title === "Future Event")).toBe(true);
  });

  test("orders by start_time ascending", async () => {
    const result = await getUpcoming(db, {});
    expect(result[0]?.startTime).toBe("2050-10-01T09:00:00.000Z");
  });

  test("defaults to limit 10", async () => {
    const result = await getUpcoming(db, {});
    expect(result.length).toBeLessThanOrEqual(10);
  });

  test("respects custom limit", async () => {
    const result = await getUpcoming(db, { limit: 1 });
    expect(result).toHaveLength(1);
  });
});
