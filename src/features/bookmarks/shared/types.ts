import type { ActionMap, EventMap, FeatureSearchResult, QueryMap } from "@core/types";

export interface Bookmark {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly description: string | null;
  readonly folder: string | null;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BookmarksEvents extends EventMap {
  "bookmarks:added": { id: string; title: string; url: string };
}

export interface BookmarksActions extends ActionMap {
  create: {
    params: { title: string; url: string; description?: string; folder?: string; tags?: string[] };
    result: { id: string };
  };
  update: {
    params: { id: string; title?: string; url?: string; description?: string; folder?: string; tags?: string[] };
    result: { success: boolean };
  };
  delete: { params: { id: string }; result: { success: boolean } };
}

export interface BookmarksQueries extends QueryMap {
  "get-all": { params: { folder?: string; tag?: string }; result: readonly Bookmark[] };
  "get-by-id": { params: { id: string }; result: Bookmark | null };
  search: { params: { query: string }; result: readonly FeatureSearchResult[] };
}
