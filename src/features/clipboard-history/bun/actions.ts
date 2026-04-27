import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { ClipboardHistoryActions } from "../shared/types";

type AddParams = ClipboardHistoryActions["add"]["params"];
type DeleteParams = ClipboardHistoryActions["delete"]["params"];

const MAX_ENTRIES = 1000;

export function detectContentType(content: string): "text" | "url" {
  try {
    const u = new URL(content.trim());
    if (u.protocol === "http:" || u.protocol === "https:") return "url";
  } catch {}
  return "text";
}

export async function addEntry(db: Database, params: AddParams): Promise<{ id: string }> {
  const id = nanoid();
  const now = new Date().toISOString();
  const contentType = params.contentType ?? detectContentType(params.content);

  db.query("INSERT INTO clipboard_entries (id, content, content_type, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    params.content,
    contentType,
    now,
  );

  // Purge entries beyond the maximum
  db.query(
    `DELETE FROM clipboard_entries WHERE id IN (
      SELECT id FROM clipboard_entries ORDER BY created_at DESC LIMIT -1 OFFSET ?
    )`,
  ).run(MAX_ENTRIES);

  return { id };
}

export async function deleteEntry(db: Database, params: DeleteParams): Promise<{ success: boolean }> {
  db.query("DELETE FROM clipboard_entries WHERE id = ?").run(params.id);
  return { success: true };
}

export async function clearEntries(db: Database): Promise<{ success: boolean }> {
  db.query("DELETE FROM clipboard_entries").run();
  return { success: true };
}
