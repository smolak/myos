import { rpc } from "@shell/view/electrobun";
import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent, CalendarSource } from "../shared/types";

export interface UseCalendarReturn {
  readonly sources: readonly CalendarSource[];
  readonly upcomingEvents: readonly CalendarEvent[];
  readonly allEvents: readonly CalendarEvent[];
  readonly isLoading: boolean;
  addSource(url: string, title?: string): Promise<void>;
  deleteSource(id: string): Promise<void>;
  sync(): Promise<void>;
}

export function useCalendar(): UseCalendarReturn {
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reloadAll = useCallback(async () => {
    const [sourceList, upcomingList, allList] = await Promise.all([
      rpc.request["calendar:get-sources"]({}),
      rpc.request["calendar:get-upcoming"]({ limit: 10 }),
      rpc.request["calendar:get-events"]({}),
    ]);
    setSources(sourceList as CalendarSource[]);
    setUpcomingEvents(upcomingList as CalendarEvent[]);
    setAllEvents(allList as CalendarEvent[]);
  }, []);

  useEffect(() => {
    void reloadAll().finally(() => setIsLoading(false));
  }, [reloadAll]);

  const addSource = useCallback(
    async (url: string, title?: string) => {
      setIsLoading(true);
      try {
        await rpc.request["calendar:add-source"]({ url, title });
        await rpc.request["calendar:sync-all"]({});
        await reloadAll();
      } finally {
        setIsLoading(false);
      }
    },
    [reloadAll],
  );

  const deleteSource = useCallback(
    async (id: string) => {
      await rpc.request["calendar:delete-source"]({ id });
      await reloadAll();
    },
    [reloadAll],
  );

  const sync = useCallback(async () => {
    if (sources.length === 0) return;
    setIsLoading(true);
    try {
      await rpc.request["calendar:sync-all"]({});
      await reloadAll();
    } finally {
      setIsLoading(false);
    }
  }, [sources.length, reloadAll]);

  return { sources, upcomingEvents, allEvents, isLoading, addSource, deleteSource, sync };
}
