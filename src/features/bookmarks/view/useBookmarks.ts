import { rpc } from "@shell/view/electrobun";
import { useCallback, useEffect, useState } from "react";
import type { Bookmark } from "../shared/types";

export interface UseBookmarksReturn {
  readonly bookmarks: readonly Bookmark[];
  readonly isLoading: boolean;
  create(title: string, url: string, description?: string, folder?: string, tags?: string[]): Promise<void>;
  update(
    id: string,
    fields: { title?: string; url?: string; description?: string; folder?: string; tags?: string[] },
  ): Promise<void>;
  remove(id: string): Promise<void>;
}

export function useBookmarks(): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const items = await rpc.request["bookmarks:get-all"]({});
    setBookmarks(items as Bookmark[]);
  }, []);

  useEffect(() => {
    void reload().finally(() => setIsLoading(false));
  }, [reload]);

  const create = useCallback(
    async (title: string, url: string, description?: string, folder?: string, tags?: string[]) => {
      await rpc.request["bookmarks:create"]({ title, url, description, folder, tags });
      await reload();
    },
    [reload],
  );

  const update = useCallback(
    async (
      id: string,
      fields: { title?: string; url?: string; description?: string; folder?: string; tags?: string[] },
    ) => {
      await rpc.request["bookmarks:update"]({ id, ...fields });
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await rpc.request["bookmarks:delete"]({ id });
      await reload();
    },
    [reload],
  );

  return { bookmarks, isLoading, create, update, remove };
}
