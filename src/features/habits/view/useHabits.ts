import { rpc } from "@shell/view/electrobun";
import { useCallback, useEffect, useState } from "react";
import type { HabitCompletion, HabitWithStats } from "../shared/types";

export interface UseHabitsReturn {
  readonly habits: readonly HabitWithStats[];
  readonly isLoading: boolean;
  create(name: string, description?: string, frequency?: "daily" | "weekly"): Promise<void>;
  remove(id: string): Promise<void>;
  complete(id: string, date: string): Promise<void>;
  uncomplete(id: string, date: string): Promise<void>;
  getHistory(id: string): Promise<readonly HabitCompletion[]>;
}

export function useHabits(): UseHabitsReturn {
  const [habits, setHabits] = useState<HabitWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const items = await rpc.request["habits:get-all"]({});
    setHabits(items as HabitWithStats[]);
  }, []);

  useEffect(() => {
    void reload().finally(() => setIsLoading(false));
  }, [reload]);

  const create = useCallback(
    async (name: string, description?: string, frequency?: "daily" | "weekly") => {
      await rpc.request["habits:create"]({ name, description, frequency });
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await rpc.request["habits:delete"]({ id });
      await reload();
    },
    [reload],
  );

  const complete = useCallback(
    async (id: string, date: string) => {
      await rpc.request["habits:complete"]({ id, date });
      await reload();
    },
    [reload],
  );

  const uncomplete = useCallback(
    async (id: string, date: string) => {
      await rpc.request["habits:uncomplete"]({ id, date });
      await reload();
    },
    [reload],
  );

  const getHistory = useCallback(async (id: string): Promise<readonly HabitCompletion[]> => {
    const history = await rpc.request["habits:get-history"]({ id });
    return history as HabitCompletion[];
  }, []);

  return { habits, isLoading, create, remove, complete, uncomplete, getHistory };
}
