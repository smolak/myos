import { rpc } from "@shell/view/electrobun";
import { useCallback, useEffect, useState } from "react";
import type { CountdownWithTimeLeft } from "../shared/types";

export interface UseCountdownsReturn {
  readonly countdowns: readonly CountdownWithTimeLeft[];
  readonly isLoading: boolean;
  create(name: string, targetDate: string): Promise<void>;
  remove(id: string): Promise<void>;
  archive(id: string): Promise<void>;
}

export function useCountdowns(): UseCountdownsReturn {
  const [countdowns, setCountdowns] = useState<CountdownWithTimeLeft[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const items = await rpc.request["countdowns:get-all"]({});
    setCountdowns(items as CountdownWithTimeLeft[]);
  }, []);

  useEffect(() => {
    void reload().finally(() => setIsLoading(false));
  }, [reload]);

  // Refresh time-left values every minute
  useEffect(() => {
    const id = setInterval(() => {
      void reload();
    }, 60_000);
    return () => clearInterval(id);
  }, [reload]);

  const create = useCallback(
    async (name: string, targetDate: string) => {
      await rpc.request["countdowns:create"]({ name, targetDate });
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await rpc.request["countdowns:delete"]({ id });
      await reload();
    },
    [reload],
  );

  const archive = useCallback(
    async (id: string) => {
      await rpc.request["countdowns:archive"]({ id });
      await reload();
    },
    [reload],
  );

  return { countdowns, isLoading, create, remove, archive };
}
