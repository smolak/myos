import { rpc } from "@shell/view/electrobun";
import { useCallback, useEffect, useState } from "react";
import type { ClipboardEntry } from "../shared/types";

export interface UseClipboardHistoryReturn {
  readonly entries: readonly ClipboardEntry[];
  readonly isLoading: boolean;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  reload(): Promise<void>;
}

export function useClipboardHistory(): UseClipboardHistoryReturn {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const items = await rpc.request["clipboard-history:get-all"]({});
    setEntries(items as ClipboardEntry[]);
  }, []);

  useEffect(() => {
    void reload().finally(() => setIsLoading(false));
  }, [reload]);

  // React to clipboard changes pushed from the bun-side watcher
  useEffect(() => {
    const handler = () => void reload();
    rpc.addMessageListener("clipboard:new-entry", handler);
    return () => rpc.removeMessageListener("clipboard:new-entry", handler);
  }, [reload]);

  const remove = useCallback(
    async (id: string) => {
      await rpc.request["clipboard-history:delete"]({ id });
      await reload();
    },
    [reload],
  );

  const clearAll = useCallback(async () => {
    await rpc.request["clipboard-history:clear"]({});
    await reload();
  }, [reload]);

  return { entries, isLoading, remove, clearAll, reload };
}
