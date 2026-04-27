import type { ActionMap, EventMap, FeatureSearchResult, QueryMap } from "@core/types";

export interface Snippet {
  readonly id: string;
  readonly name: string;
  readonly template: string;
  readonly isFavorite: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SnippetsEvents extends EventMap {
  "snippet:expanded": { id: string; name: string };
}

export interface SnippetsActions extends ActionMap {
  create: { params: { name: string; template: string; isFavorite?: boolean }; result: { id: string } };
  update: {
    params: { id: string; name?: string; template?: string; isFavorite?: boolean };
    result: { success: boolean };
  };
  delete: { params: { id: string }; result: { success: boolean } };
}

export interface SnippetsQueries extends QueryMap {
  "get-all": { params: { favoritesOnly?: boolean }; result: readonly Snippet[] };
  "get-by-id": { params: { id: string }; result: Snippet | null };
  expand: { params: { id: string; clipboard?: string }; result: { text: string } };
  search: { params: { query: string }; result: readonly FeatureSearchResult[] };
}
