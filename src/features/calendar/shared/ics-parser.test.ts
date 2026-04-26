import { describe, expect, test } from "bun:test";
import { parseIcs } from "./ics-parser";

const BASIC_ICS = `BEGIN:VCALENDAR
PRODID:-//Test//Test//EN
VERSION:2.0
BEGIN:VEVENT
DTSTART:20241001T090000Z
DTEND:20241001T100000Z
SUMMARY:Team Meeting
UID:meeting-001@example.com
END:VEVENT
END:VCALENDAR`;

const ALL_DAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20241015
DTEND;VALUE=DATE:20241016
SUMMARY:Company Holiday
UID:holiday-001@example.com
END:VEVENT
END:VCALENDAR`;

const MULTI_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:My Calendar
BEGIN:VEVENT
DTSTART:20241001T090000Z
DTEND:20241001T100000Z
SUMMARY:First Event
DESCRIPTION:First event description
LOCATION:Room 101
UID:event-001@example.com
END:VEVENT
BEGIN:VEVENT
DTSTART:20241002T140000Z
DTEND:20241002T150000Z
SUMMARY:Second Event
UID:event-002@example.com
END:VEVENT
END:VCALENDAR`;

const FOLDED_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20241001T090000Z
SUMMARY:A very long event title that gets folded across
  multiple lines in the ICS file
UID:folded-001@example.com
END:VEVENT
END:VCALENDAR`;

const CRLF_ICS = BASIC_ICS.replace(/\n/g, "\r\n");

describe("parseIcs", () => {
  test("parses calendar title from X-WR-CALNAME", () => {
    const result = parseIcs(MULTI_EVENT_ICS);
    expect(result.title).toBe("My Calendar");
  });

  test("uses empty string as calendar title when not present", () => {
    const result = parseIcs(BASIC_ICS);
    expect(result.title).toBe("");
  });

  test("parses single event", () => {
    const result = parseIcs(BASIC_ICS);
    expect(result.events).toHaveLength(1);
  });

  test("parses event UID", () => {
    const result = parseIcs(BASIC_ICS);
    expect(result.events[0]?.uid).toBe("meeting-001@example.com");
  });

  test("parses event title from SUMMARY", () => {
    const result = parseIcs(BASIC_ICS);
    expect(result.events[0]?.title).toBe("Team Meeting");
  });

  test("parses event start time as ISO string", () => {
    const result = parseIcs(BASIC_ICS);
    expect(result.events[0]?.startTime).toBe("2024-10-01T09:00:00.000Z");
  });

  test("parses event end time as ISO string", () => {
    const result = parseIcs(BASIC_ICS);
    expect(result.events[0]?.endTime).toBe("2024-10-01T10:00:00.000Z");
  });

  test("isAllDay=false for timed events", () => {
    const result = parseIcs(BASIC_ICS);
    expect(result.events[0]?.isAllDay).toBe(false);
  });

  test("parses all-day event with VALUE=DATE", () => {
    const result = parseIcs(ALL_DAY_ICS);
    expect(result.events[0]?.isAllDay).toBe(true);
  });

  test("all-day event start time uses date portion", () => {
    const result = parseIcs(ALL_DAY_ICS);
    expect(result.events[0]?.startTime).toMatch(/^2024-10-15/);
  });

  test("parses multiple events", () => {
    const result = parseIcs(MULTI_EVENT_ICS);
    expect(result.events).toHaveLength(2);
  });

  test("parses event description", () => {
    const result = parseIcs(MULTI_EVENT_ICS);
    expect(result.events[0]?.description).toBe("First event description");
  });

  test("sets description=null when not present", () => {
    const result = parseIcs(BASIC_ICS);
    expect(result.events[0]?.description).toBeNull();
  });

  test("parses event location", () => {
    const result = parseIcs(MULTI_EVENT_ICS);
    expect(result.events[0]?.location).toBe("Room 101");
  });

  test("sets location=null when not present", () => {
    const result = parseIcs(BASIC_ICS);
    expect(result.events[0]?.location).toBeNull();
  });

  test("handles folded lines", () => {
    const result = parseIcs(FOLDED_ICS);
    expect(result.events[0]?.title).toBe(
      "A very long event title that gets folded across multiple lines in the ICS file",
    );
  });

  test("handles CRLF line endings", () => {
    const result = parseIcs(CRLF_ICS);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.title).toBe("Team Meeting");
  });

  test("returns empty events array for empty calendar", () => {
    const result = parseIcs("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR");
    expect(result.events).toHaveLength(0);
  });

  test("sets endTime=null when DTEND not present", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20241001T090000Z
SUMMARY:No End
UID:no-end@example.com
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    expect(result.events[0]?.endTime).toBeNull();
  });
});
