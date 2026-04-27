import type { ActionMap, EventMap, FeatureSearchResult, QueryMap } from "@core/types";

export interface ClipboardEntry {
  readonly id: string;
  readonly content: string;
  readonly contentType: "text" | "url";
  readonly createdAt: string;
}

export interface ClipboardHistoryEvents extends EventMap {
  "clipboard:copied": { id: string; content: string; contentType: string };
}

export interface ClipboardHistoryActions extends ActionMap {
  add: {
    params: { content: string; contentType?: "text" | "url" };
    result: { id: string };
  };
  delete: {
    params: { id: string };
    result: { success: boolean };
  };
  clear: {
    params: Record<string, never>;
    result: { success: boolean };
  };
}

export interface ClipboardHistoryQueries extends QueryMap {
  "get-all": {
    params: { limit?: number; search?: string };
    result: readonly ClipboardEntry[];
  };
  search: {
    params: { query: string };
    result: readonly FeatureSearchResult[];
  };
}
