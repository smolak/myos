import type { RssEntry, RssFeed } from "../shared/types";

export function makeEntry(overrides: Partial<RssEntry> = {}): RssEntry {
  return {
    id: "e1",
    feedId: "f1",
    guid: overrides.id ?? "e1",
    title: "Test Article",
    link: "https://example.com/1",
    description: null,
    publishedAt: "2026-01-01T10:00:00.000Z",
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeFeed(overrides: Partial<RssFeed> = {}): RssFeed {
  return {
    id: "f1",
    url: "https://example.com/feed",
    title: "Test Feed",
    description: null,
    fetchIntervalMinutes: 30,
    lastFetchedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
