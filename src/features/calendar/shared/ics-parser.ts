export interface ParsedEvent {
  readonly uid: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly startTime: string;
  readonly endTime: string | null;
  readonly isAllDay: boolean;
}

export interface ParsedCalendar {
  readonly title: string;
  readonly events: ParsedEvent[];
}

function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parsePropertyLine(line: string): { key: string; params: string; value: string } | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;
  const keyPart = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const semicolonIdx = keyPart.indexOf(";");
  if (semicolonIdx === -1) {
    return { key: keyPart.toUpperCase(), params: "", value };
  }
  return { key: keyPart.slice(0, semicolonIdx).toUpperCase(), params: keyPart.slice(semicolonIdx + 1), value };
}

function parseIcsDatetime(value: string, params: string): { iso: string; isAllDay: boolean } {
  const upperParams = params.toUpperCase();
  const isDateOnly = upperParams.includes("VALUE=DATE") || (!value.includes("T") && value.length === 8);

  if (isDateOnly) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { iso: `${y}-${m}-${d}T00:00:00.000Z`, isAllDay: true };
  }

  const y = value.slice(0, 4);
  const mo = value.slice(4, 6);
  const da = value.slice(6, 8);
  const h = value.slice(9, 11);
  const mi = value.slice(11, 13);
  const s = value.slice(13, 15);
  const isUtc = value.endsWith("Z");

  const candidate = `${y}-${mo}-${da}T${h}:${mi}:${s}.000${isUtc ? "Z" : ""}`;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return { iso: candidate, isAllDay: false };
  }
  return { iso: isUtc ? parsed.toISOString() : candidate, isAllDay: false };
}

function extractBlocks(lines: string[], tag: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;
  const beginTag = `BEGIN:${tag}`;
  const endTag = `END:${tag}`;

  for (const line of lines) {
    if (line === beginTag) {
      current = [];
    } else if (line === endTag) {
      if (current) {
        blocks.push(current);
        current = null;
      }
    } else if (current !== null) {
      current.push(line);
    }
  }
  return blocks;
}

function parseVEvent(lines: string[]): ParsedEvent | null {
  let uid = "";
  let title = "";
  let description: string | null = null;
  let location: string | null = null;
  let startTime = "";
  let endTime: string | null = null;
  let isAllDay = false;

  for (const line of lines) {
    const prop = parsePropertyLine(line);
    if (!prop) continue;

    switch (prop.key) {
      case "UID":
        uid = prop.value.trim();
        break;
      case "SUMMARY":
        title = prop.value.trim();
        break;
      case "DESCRIPTION":
        description = prop.value.trim() || null;
        break;
      case "LOCATION":
        location = prop.value.trim() || null;
        break;
      case "DTSTART": {
        const dt = parseIcsDatetime(prop.value.trim(), prop.params);
        startTime = dt.iso;
        isAllDay = dt.isAllDay;
        break;
      }
      case "DTEND": {
        const dt = parseIcsDatetime(prop.value.trim(), prop.params);
        endTime = dt.iso;
        break;
      }
    }
  }

  if (!uid || !startTime) return null;
  return { uid, title: title || "Untitled", description, location, startTime, endTime, isAllDay };
}

export function parseIcs(ics: string): ParsedCalendar {
  const unfolded = unfold(ics);
  const lines = unfolded
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let calendarTitle = "";
  for (const line of lines) {
    const prop = parsePropertyLine(line);
    if (prop?.key === "X-WR-CALNAME") {
      calendarTitle = prop.value.trim();
      break;
    }
  }

  const eventBlocks = extractBlocks(lines, "VEVENT");
  const events: ParsedEvent[] = [];
  for (const block of eventBlocks) {
    const event = parseVEvent(block);
    if (event) events.push(event);
  }

  return { title: calendarTitle, events };
}
