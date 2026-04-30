import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { RssEntry, RssFeed } from "../shared/types";

const mockGetFeeds = vi.fn();
const mockGetEntries = vi.fn();
const mockFetchFeeds = vi.fn();
const mockAddFeed = vi.fn();
const mockDeleteFeed = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkUnread = vi.fn();

vi.mock("@shell/view/electrobun", () => ({
  rpc: {
    request: {
      "rss:get-feeds": (...args: unknown[]) => mockGetFeeds(...args),
      "rss:get-entries": (...args: unknown[]) => mockGetEntries(...args),
      "rss:fetch-feeds": (...args: unknown[]) => mockFetchFeeds(...args),
      "rss:add-feed": (...args: unknown[]) => mockAddFeed(...args),
      "rss:delete-feed": (...args: unknown[]) => mockDeleteFeed(...args),
      "rss:mark-read": (...args: unknown[]) => mockMarkRead(...args),
      "rss:mark-unread": (...args: unknown[]) => mockMarkUnread(...args),
    },
  },
}));

const { useRssReader } = await import("./useRssReader");

const FEED_A: RssFeed = {
  id: "f1",
  url: "https://example.com/feed.xml",
  title: "Example Feed",
  description: null,
  lastFetchedAt: null,
  fetchIntervalMinutes: 30,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const ENTRY_UNREAD: RssEntry = {
  id: "e1",
  feedId: "f1",
  guid: "guid-1",
  title: "Unread Article",
  link: "https://example.com/1",
  description: null,
  publishedAt: "2026-01-01T10:00:00Z",
  isRead: false,
  createdAt: "2026-01-01T10:00:00Z",
};

const ENTRY_READ: RssEntry = {
  id: "e2",
  feedId: "f1",
  guid: "guid-2",
  title: "Read Article",
  link: "https://example.com/2",
  description: null,
  publishedAt: "2026-01-01T09:00:00Z",
  isRead: true,
  createdAt: "2026-01-01T09:00:00Z",
};

const flushAll = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe("useRssReader — mount", () => {
  beforeEach(() => {
    mockGetFeeds.mockResolvedValue([FEED_A]);
    mockGetEntries.mockResolvedValue([ENTRY_UNREAD, ENTRY_READ]);
    mockFetchFeeds.mockResolvedValue({ fetched: 1, newEntries: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("loads feeds and entries from DB on mount", async () => {
    const { result } = renderHook(() => useRssReader());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.feeds).toHaveLength(1);
    expect(result.current.entries).toHaveLength(2);
  });

  test("isLoading is false after initial DB load", async () => {
    const { result } = renderHook(() => useRssReader());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  test("triggers fetch-feeds on mount for fresh entries", async () => {
    renderHook(() => useRssReader());
    await flushAll();
    expect(mockFetchFeeds).toHaveBeenCalledOnce();
  });

  test("reloads data after startup fetch completes", async () => {
    renderHook(() => useRssReader());
    await flushAll();
    // get-feeds: once for initial load, once after startup fetch
    expect(mockGetFeeds).toHaveBeenCalledTimes(2);
    expect(mockGetEntries).toHaveBeenCalledTimes(2);
  });

  test("shows entries that arrived via the startup fetch", async () => {
    const freshEntry: RssEntry = { ...ENTRY_UNREAD, id: "e3", title: "Fresh Article" };
    mockGetEntries.mockResolvedValueOnce([ENTRY_UNREAD]).mockResolvedValueOnce([ENTRY_UNREAD, freshEntry]);

    const { result } = renderHook(() => useRssReader());
    await flushAll();

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries.some((e) => e.id === "e3")).toBe(true);
  });

  test("startup fetch error is swallowed — hook remains usable", async () => {
    mockFetchFeeds.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useRssReader());
    await flushAll();
    expect(result.current.feeds).toHaveLength(1);
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useRssReader — unreadCount", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("counts only unread entries", async () => {
    mockGetFeeds.mockResolvedValue([FEED_A]);
    mockGetEntries.mockResolvedValue([ENTRY_UNREAD, ENTRY_READ]);
    mockFetchFeeds.mockResolvedValue({ fetched: 0, newEntries: 0 });

    const { result } = renderHook(() => useRssReader());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.unreadCount).toBe(1);
  });
});

describe("useRssReader — addFeed", () => {
  beforeEach(() => {
    mockGetFeeds.mockResolvedValue([FEED_A]);
    mockGetEntries.mockResolvedValue([ENTRY_UNREAD]);
    mockFetchFeeds.mockResolvedValue({ fetched: 1, newEntries: 1 });
    mockAddFeed.mockResolvedValue({ id: "f2" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("calls add-feed, fetch-feeds, then reloads", async () => {
    const { result } = renderHook(() => useRssReader());
    await flushAll();
    vi.clearAllMocks();
    mockGetFeeds.mockResolvedValue([FEED_A]);
    mockGetEntries.mockResolvedValue([ENTRY_UNREAD]);
    mockFetchFeeds.mockResolvedValue({ fetched: 1, newEntries: 1 });
    mockAddFeed.mockResolvedValue({ id: "f2" });

    await act(async () => {
      await result.current.addFeed("https://new.example.com/feed.xml");
    });

    expect(mockAddFeed).toHaveBeenCalledWith({ url: "https://new.example.com/feed.xml" });
    expect(mockFetchFeeds).toHaveBeenCalledOnce();
    expect(mockGetFeeds).toHaveBeenCalledOnce();
  });

  test("isLoading is false after addFeed completes", async () => {
    const { result } = renderHook(() => useRssReader());
    await flushAll();

    await act(async () => {
      await result.current.addFeed("https://new.example.com/feed.xml");
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("useRssReader — deleteFeed", () => {
  beforeEach(() => {
    mockGetFeeds.mockResolvedValue([FEED_A]);
    mockGetEntries.mockResolvedValue([ENTRY_UNREAD]);
    mockFetchFeeds.mockResolvedValue({ fetched: 0, newEntries: 0 });
    mockDeleteFeed.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("calls delete-feed and reloads data", async () => {
    const { result } = renderHook(() => useRssReader());
    await flushAll();
    vi.clearAllMocks();
    mockGetFeeds.mockResolvedValue([]);
    mockGetEntries.mockResolvedValue([]);

    await act(async () => {
      await result.current.deleteFeed("f1");
    });

    expect(mockDeleteFeed).toHaveBeenCalledWith({ id: "f1" });
    expect(mockGetFeeds).toHaveBeenCalledOnce();
    expect(result.current.feeds).toHaveLength(0);
  });
});

describe("useRssReader — markRead / markUnread", () => {
  beforeEach(() => {
    mockGetFeeds.mockResolvedValue([FEED_A]);
    mockGetEntries.mockResolvedValue([ENTRY_UNREAD, ENTRY_READ]);
    mockFetchFeeds.mockResolvedValue({ fetched: 0, newEntries: 0 });
    mockMarkRead.mockResolvedValue({ success: true });
    mockMarkUnread.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("markRead calls RPC and optimistically sets entry isRead to true", async () => {
    const { result } = renderHook(() => useRssReader());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markRead("e1");
    });

    expect(mockMarkRead).toHaveBeenCalledWith({ id: "e1" });
    const entry = result.current.entries.find((e) => e.id === "e1");
    expect(entry?.isRead).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  test("markUnread calls RPC and optimistically sets entry isRead to false", async () => {
    const { result } = renderHook(() => useRssReader());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markUnread("e2");
    });

    expect(mockMarkUnread).toHaveBeenCalledWith({ id: "e2" });
    const entry = result.current.entries.find((e) => e.id === "e2");
    expect(entry?.isRead).toBe(false);
    expect(result.current.unreadCount).toBe(2);
  });
});

describe("useRssReader — refresh", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("calls fetch-feeds and reloads when feeds exist", async () => {
    mockGetFeeds.mockResolvedValue([FEED_A]);
    mockGetEntries.mockResolvedValue([ENTRY_UNREAD]);
    mockFetchFeeds.mockResolvedValue({ fetched: 1, newEntries: 0 });

    const { result } = renderHook(() => useRssReader());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.clearAllMocks();
    mockGetFeeds.mockResolvedValue([FEED_A]);
    mockGetEntries.mockResolvedValue([ENTRY_UNREAD]);
    mockFetchFeeds.mockResolvedValue({ fetched: 1, newEntries: 0 });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetchFeeds).toHaveBeenCalledOnce();
    expect(mockGetFeeds).toHaveBeenCalledOnce();
  });

  test("does nothing when no feeds are loaded", async () => {
    mockGetFeeds.mockResolvedValue([]);
    mockGetEntries.mockResolvedValue([]);
    mockFetchFeeds.mockResolvedValue({ fetched: 0, newEntries: 0 });

    const { result } = renderHook(() => useRssReader());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.clearAllMocks();

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFetchFeeds).not.toHaveBeenCalled();
  });

  test("isLoading is false after refresh completes", async () => {
    mockGetFeeds.mockResolvedValue([FEED_A]);
    mockGetEntries.mockResolvedValue([ENTRY_UNREAD]);
    mockFetchFeeds.mockResolvedValue({ fetched: 1, newEntries: 0 });

    const { result } = renderHook(() => useRssReader());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.isLoading).toBe(false);
  });
});
