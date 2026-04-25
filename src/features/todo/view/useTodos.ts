import { rpc } from "@shell/view/electrobun";
import { useCallback, useEffect, useState } from "react";
import type { TodoItem } from "../shared/types";

export interface UseTodosReturn {
  readonly todos: readonly TodoItem[];
  readonly isLoading: boolean;
  create(title: string, description?: string): Promise<void>;
  update(id: string, changes: { title?: string; description?: string }): Promise<void>;
  complete(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export function useTodos(): UseTodosReturn {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const items = await rpc.request["todo:find"]({});
    setTodos(items as TodoItem[]);
  }, []);

  useEffect(() => {
    void reload().finally(() => setIsLoading(false));
  }, [reload]);

  const create = useCallback(
    async (title: string, description?: string) => {
      await rpc.request["todo:create"]({ title, description });
      await reload();
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, changes: { title?: string; description?: string }) => {
      await rpc.request["todo:update"]({ id, ...changes });
      await reload();
    },
    [reload],
  );

  const complete = useCallback(
    async (id: string) => {
      await rpc.request["todo:complete"]({ id });
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await rpc.request["todo:delete"]({ id });
      await reload();
    },
    [reload],
  );

  return { todos, isLoading, create, update, complete, remove };
}
