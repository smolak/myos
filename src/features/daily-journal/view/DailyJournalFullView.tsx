import { useCallback, useEffect, useRef, useState } from "react";
import type { DayData, TimelineEvent } from "../shared/types";
import { useDailyJournal } from "./useDailyJournal";

interface Props {
  onClose?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function eventLabel(event: TimelineEvent): string {
  const payload = event.payload as Record<string, unknown> | null;
  switch (event.eventName) {
    case "todo:item-completed":
      return `Completed todo: ${payload?.title ?? payload?.id ?? "—"}`;
    case "pomodoro:session-ended":
      return `Pomodoro ${payload?.type === "break" ? "break" : "work"} session ended (${Math.round(((payload?.durationSeconds as number) ?? 0) / 60)} min)`;
    case "rss:new-entry":
      return `New RSS entry: ${payload?.title ?? "—"}`;
    case "rss:entry-read":
      return `Read RSS entry: ${payload?.entryId ?? "—"}`;
    default:
      return event.eventName;
  }
}

export function DailyJournalFullView({ onClose }: Props) {
  const { notes, isLoading, addNote, updateNote, deleteNote, getDay, searchNotes } = useDailyJournal();
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split("T")[0] as string);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<typeof notes | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadDay = useCallback(
    async (date: string) => {
      setDayLoading(true);
      try {
        const data = await getDay(date);
        setDayData(data);
        setEditContent(data.note?.content ?? "");
        setIsEditing(false);
      } finally {
        setDayLoading(false);
      }
    },
    [getDay],
  );

  useEffect(() => {
    void loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  async function handleSave() {
    if (!editContent.trim()) return;
    if (dayData?.note) {
      await updateNote(dayData.note.id, editContent);
    } else {
      await addNote(selectedDate, editContent);
    }
    await loadDay(selectedDate);
  }

  async function handleDelete() {
    if (!dayData?.note) return;
    await deleteNote(dayData.note.id);
    await loadDay(selectedDate);
  }

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    const results = await searchNotes(q);
    setSearchResults(results as typeof notes);
  }

  const listEntries = searchResults ?? notes;

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100">
      {/* Sidebar: note list */}
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="p-3 border-b border-zinc-800">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => void handleSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <ul className="flex-1 overflow-y-auto">
          {isLoading ? (
            <li className="p-3 text-xs text-zinc-500">Loading…</li>
          ) : listEntries.length === 0 ? (
            <li className="p-3 text-xs text-zinc-500">No entries yet</li>
          ) : (
            listEntries.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDate(note.date)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-zinc-800 ${
                    selectedDate === note.date ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
                  }`}
                >
                  <div className="font-medium">{note.date}</div>
                  <div className="truncate text-zinc-500 mt-0.5">{note.content.slice(0, 40)}</div>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
            {dayData && <span className="text-xs text-zinc-500">{formatDate(selectedDate)}</span>}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {dayLoading ? (
            <p className="text-xs text-zinc-500">Loading…</p>
          ) : (
            <>
              {/* Note section */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Note</h3>
                  <div className="flex gap-2">
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        {dayData?.note ? "Edit" : "Add note"}
                      </button>
                    )}
                    {dayData?.note && !isEditing && (
                      <button
                        type="button"
                        onClick={() => void handleDelete()}
                        className="text-xs text-red-500 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      ref={textareaRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={5}
                      placeholder="Write your note for the day…"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded transition-colors"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditContent(dayData?.note?.content ?? "");
                          setIsEditing(false);
                        }}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : dayData?.note ? (
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{dayData.note.content}</p>
                ) : (
                  <p className="text-xs text-zinc-600 italic">No note for this day.</p>
                )}
              </section>

              {/* Timeline section */}
              {dayData && dayData.events.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Activity timeline
                  </h3>
                  <ul className="space-y-1">
                    {dayData.events.map((event) => (
                      <li key={event.id} className="flex items-start gap-3 text-xs text-zinc-400">
                        <span className="shrink-0 text-zinc-600 tabular-nums">{formatTime(event.createdAt)}</span>
                        <span>{eventLabel(event)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {dayData && dayData.events.length === 0 && !dayData.note && (
                <p className="text-xs text-zinc-600 italic">No activity recorded for this day.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
