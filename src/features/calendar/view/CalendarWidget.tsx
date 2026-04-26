import type { CalendarEvent } from "../shared/types";
import { useCalendar } from "./useCalendar";

interface Props {
  onOpenFullView?: () => void;
}

function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return "All day";
  const d = new Date(event.startTime);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className="flex flex-col py-1.5 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-300 truncate">{event.title}</span>
      <span className="text-xs text-zinc-600">{formatEventTime(event)}</span>
    </li>
  );
}

export function CalendarWidget({ onOpenFullView }: Props) {
  const { upcomingEvents, isLoading, sources } = useCalendar();
  const recentEvents = upcomingEvents.slice(0, 5);
  const isEmpty = sources.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-200">Calendar</h2>
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Open
        </button>
      </div>

      {isLoading && <p className="text-xs text-zinc-500 mb-1">Syncing…</p>}

      {isEmpty ? (
        <button
          type="button"
          className="flex flex-1 items-center justify-center cursor-pointer"
          onClick={onOpenFullView}
          aria-label="Open Calendar to add calendars"
        >
          <p className="text-xs text-zinc-600 text-center">
            No calendars configured.
            <br />
            Click to add calendars.
          </p>
        </button>
      ) : recentEvents.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center flex-1 flex items-center justify-center">No upcoming events</p>
      ) : (
        <ul className="flex-1 overflow-hidden">
          {recentEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
}
