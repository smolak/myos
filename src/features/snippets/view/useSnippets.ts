import { rpc } from "@shell/view/electrobun";
import { useCallback, useEffect, useState } from "react";
import type { Snippet } from "../shared/types";

export interface UseSnippetsReturn {
  readonly snippets: readonly Snippet[];
  readonly favorites: readonly Snippet[];
  readonly isLoading: boolean;
  create(name: string, template: string, isFavorite?: boolean): Promise<void>;
  update(id: string, params: { name?: string; template?: string; isFavorite?: boolean }): Promise<void>;
  remove(id: string): Promise<void>;
  expand(id: string): Promise<string>;
}

export function useSnippets(): UseSnippetsReturn {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const items = await rpc.request["snippets:get-all"]({});
    setSnippets(items as Snippet[]);
  }, []);

  useEffect(() => {
    void reload().finally(() => setIsLoading(false));
  }, [reload]);

  const favorites = snippets.filter((s) => s.isFavorite);

  const create = useCallback(
    async (name: string, template: string, isFavorite = false) => {
      await rpc.request["snippets:create"]({ name, template, isFavorite });
      await reload();
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, params: { name?: string; template?: string; isFavorite?: boolean }) => {
      await rpc.request["snippets:update"]({ id, ...params });
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await rpc.request["snippets:delete"]({ id });
      await reload();
    },
    [reload],
  );

  const expand = useCallback(async (id: string): Promise<string> => {
    let clipboard = "";
    try {
      clipboard = await navigator.clipboard.readText();
    } catch {
      // Clipboard read may require permission; fall back to empty string
    }
    const result = await rpc.request["snippets:expand"]({ id, clipboard });
    return (result as { text: string }).text;
  }, []);

  return { snippets, favorites, isLoading, create, update, remove, expand };
}
