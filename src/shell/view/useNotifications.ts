import type { AppNotification } from "@shell/shared/notification-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "./electrobun";

const POLL_INTERVAL_MS = 5_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHistory = useCallback(async () => {
    const history = await rpc.request["notification:get-history"]({});
    setNotifications(history);
  }, []);

  useEffect(() => {
    void fetchHistory();
    intervalRef.current = setInterval(() => {
      void fetchHistory();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchHistory]);

  const markRead = useCallback(async (id: string) => {
    await rpc.request["notification:mark-read"]({ id });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clearAll = useCallback(async () => {
    await rpc.request["notification:clear"]({});
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markRead, clearAll, refresh: fetchHistory };
}
