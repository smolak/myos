import { rpc } from "@shell/view/electrobun";
import { useCallback, useEffect, useState } from "react";
import type { DayData, JournalNote, TimelineEvent } from "../shared/types";

export interface UseDailyJournalReturn {
  readonly notes: readonly JournalNote[];
  readonly isLoading: boolean;
  readonly todayNote: JournalNote | null;
  getDay(date: string): Promise<DayData>;
  addNote(date: string, content: string): Promise<void>;
  updateNote(id: string, content: string): Promise<void>;
  deleteNote(id: string): Promise<void>;
  searchNotes(search: string): Promise<readonly JournalNote[]>;
}

function today(): string {
  return new Date().toISOString().split("T")[0] as string;
}

export function useDailyJournal(): UseDailyJournalReturn {
  const [notes, setNotes] = useState<JournalNote[]>([]);
  const [todayNote, setTodayNote] = useState<JournalNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const [allNotes, dayNote] = await Promise.all([
      rpc.request["journal:get-notes"]({ limit: 30 }),
      rpc.request["journal:get-note-by-date"]({ date: today() }),
    ]);
    setNotes(allNotes as JournalNote[]);
    setTodayNote(dayNote as JournalNote | null);
  }, []);

  useEffect(() => {
    void reload().finally(() => setIsLoading(false));
  }, [reload]);

  const getDay = useCallback(async (date: string): Promise<DayData> => {
    const [note, events] = await Promise.all([
      rpc.request["journal:get-note-by-date"]({ date }),
      rpc.request["journal:get-timeline"]({ date }),
    ]);
    return {
      date,
      note: note as JournalNote | null,
      events: events as readonly TimelineEvent[],
    };
  }, []);

  const addNote = useCallback(
    async (date: string, content: string) => {
      await rpc.request["journal:add-note"]({ date, content });
      await reload();
    },
    [reload],
  );

  const updateNote = useCallback(
    async (id: string, content: string) => {
      await rpc.request["journal:update-note"]({ id, content });
      await reload();
    },
    [reload],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      await rpc.request["journal:delete-note"]({ id });
      await reload();
    },
    [reload],
  );

  const searchNotes = useCallback(async (search: string): Promise<readonly JournalNote[]> => {
    const result = await rpc.request["journal:get-notes"]({ search });
    return result as readonly JournalNote[];
  }, []);

  return { notes, isLoading, todayNote, getDay, addNote, updateNote, deleteNote, searchNotes };
}
