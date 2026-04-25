import type { AppNotification } from "@shell/shared/notification-types";
import { useEffect, useRef, useState } from "react";

interface Props {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
}

function BellIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function NotificationCenter({ notifications, unreadCount, onMarkRead, onClearAll }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative text-xs border border-zinc-700 rounded px-2 py-1 hover:border-zinc-500 transition-colors flex items-center gap-1"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-300">Notifications</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Clear all notifications"
              >
                Clear all
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No notifications</div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-zinc-800">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onMarkRead(n.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors ${n.read ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: "var(--accent-color)" }}
                          aria-hidden="true"
                        />
                      )}
                      <div className={!n.read ? "" : "ml-3.5"}>
                        <p className="text-sm font-medium text-zinc-200">{n.title}</p>
                        {n.body && <p className="text-xs text-zinc-500 mt-0.5">{n.body}</p>}
                        <p className="text-[10px] text-zinc-600 mt-1">{formatTime(n.timestamp)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
