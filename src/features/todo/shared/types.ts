import type { ActionMap, EventMap, QueryMap } from "@core/types";

export interface TodoItem {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly completed: boolean;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TodoEvents extends EventMap {
  "todo:item-created": { id: string; title: string };
  "todo:item-updated": { id: string; title: string };
  "todo:item-completed": { id: string; completedAt: string };
  "todo:item-deleted": { id: string };
}

export interface TodoActions extends ActionMap {
  create: { params: { title: string; description?: string }; result: { id: string } };
  update: { params: { id: string; title?: string; description?: string }; result: { success: boolean } };
  complete: { params: { id: string }; result: { success: boolean } };
  delete: { params: { id: string }; result: { success: boolean } };
}

export interface TodoQueries extends QueryMap {
  find: { params: { completed?: boolean; limit?: number }; result: readonly TodoItem[] };
  "get-by-id": { params: { id: string }; result: TodoItem | null };
}
