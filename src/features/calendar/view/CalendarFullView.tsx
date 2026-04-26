import { useState } from "react";
import type { CalendarEvent, CalendarSource } from "../shared/types";
import { useCalendar } from "./useCalendar";

interface Props {
  onClose?: () => void;
}

function formatEventDate(event: CalendarEvent): string {
  if (event.isAllDay) {
    return new Date(event.startTime).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const start = new Date(event.startTime);
  const time = start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (event.endTime) {
    const end = new Date(event.endTime);
    return `${time} – ${end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }
  return time;
}

function EventItem({ event }: { event: CalendarEvent }) {
  return (
    <li className="flex flex-col py-3 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-200 leading-snug">{event.title}</span>
      <span className="text-xs text-zinc-500 mt-0.5">{formatEventDate(event)}</span>
      {event.location && <span className="text-xs text-zinc-600 mt-0.5">{event.location}</span>}
      {event.description && <span className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{event.description}</span>}
    </li>
  );
}

function UpcomingTab() {
  const { upcomingEvents } = useCalendar();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-500">{upcomingEvents.length} upcoming events</span>
      </div>

      {upcomingEvents.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-8">No upcoming events. Add a calendar and sync.</p>
      ) : (
        <ul>
          {upcomingEvents.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceRow({ source, onDelete }: { source: CalendarSource; onDelete: (id: string) => void }) {
  return (
    <li className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm text-zinc-200 truncate">{source.title}</p>
        <p className="text-xs text-zinc-600 truncate mt-0.5">{source.url}</p>
        {source.lastSyncedAt && (
          <p className="text-xs text-zinc-600 mt-0.5">
            Last synced:{" "}
            {new Date(source.lastSyncedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(source.id)}
        className="shrink-0 text-xs text-zinc-600 hover:text-red-400 transition-colors"
        aria-label={`Remove ${source.title}`}
      >
        Remove
      </button>
    </li>
  );
}

function ManageTab() {
  const { sources, addSource, deleteSource, sync, isLoading } = useCalendar();
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const url = urlInput.trim();
    if (!url) return;
    setError(null);
    try {
      await addSource(url, titleInput.trim() || undefined);
      setUrlInput("");
      setTitleInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to add calendar: ${msg}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void handleAdd();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Add Calendar (ICS URL)</h3>
        <div className="space-y-2">
          <input
            type="url"
            placeholder="https://example.com/calendar.ics"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
            aria-label="Calendar URL"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Name (optional)"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
              aria-label="Calendar name"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={!urlInput.trim() || isLoading}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded text-sm transition-colors text-zinc-200"
            >
              Add
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Calendars ({sources.length})</h3>
        {sources.length > 0 && (
          <button
            type="button"
            onClick={() => void sync()}
            disabled={isLoading}
            className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Syncing…" : "Sync all"}
          </button>
        )}
      </div>

      {sources.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-4">No calendars added yet.</p>
      ) : (
        <ul>
          {sources.map((source) => (
            <SourceRow key={source.id} source={source} onDelete={deleteSource} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function CalendarFullView({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "manage">("upcoming");

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold">Calendar</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm"
            aria-label="Close"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex border-b border-zinc-800 px-6">
        {(["upcoming", "manage"] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 mr-4 text-sm border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-zinc-400 text-zinc-200"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "upcoming" ? "Upcoming" : "Manage"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === "upcoming" && <UpcomingTab />}
        {activeTab === "manage" && <ManageTab />}
      </div>
    </div>
  );
}
