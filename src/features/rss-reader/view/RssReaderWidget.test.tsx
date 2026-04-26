import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { RssReaderWidget } from "./RssReaderWidget";

vi.mock("./RssReaderContext", () => {
  const markReadMock = vi.fn();
  const addFeedMock = vi.fn();
  const deleteFeedMock = vi.fn();
  const refreshMock = vi.fn();

  let feeds: { id: string; url: string; title: string; fetchIntervalMinutes: number; lastFetchedAt: string | null }[] =
    [];
  let entries: {
    id: string;
    feedId: string;
    guid: string;
    title: string;
    link: string;
    description: string | null;
    publishedAt: string | null;
    isRead: boolean;
    createdAt: string;
  }[] = [];
  let isLoading = false;

  return {
    useRssReaderContext: () => ({
      feeds,
      entries,
      unreadCount: entries.filter((e) => !e.isRead).length,
      isLoading,
      addFeed: addFeedMock,
      deleteFeed: deleteFeedMock,
      markRead: markReadMock,
      markUnread: vi.fn(),
      refresh: refreshMock,
    }),
    __setFeeds: (f: typeof feeds) => {
      feeds = f;
    },
    __setEntries: (e: typeof entries) => {
      entries = e;
    },
    __setIsLoading: (l: boolean) => {
      isLoading = l;
    },
    __getMarkReadMock: () => markReadMock,
    __getAddFeedMock: () => addFeedMock,
  };
});

function makeEntry(
  overrides: Partial<{
    id: string;
    title: string;
    isRead: boolean;
    publishedAt: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "e1",
    feedId: "f1",
    guid: overrides.id ?? "e1",
    title: overrides.title ?? "Test Article",
    link: "https://example.com/1",
    description: null,
    publishedAt: overrides.publishedAt ?? "2024-01-01T10:00:00.000Z",
    isRead: overrides.isRead ?? false,
    createdAt: new Date().toISOString(),
  };
}

function makeFeed() {
  return {
    id: "f1",
    url: "https://example.com/feed",
    title: "Test Feed",
    fetchIntervalMinutes: 30,
    lastFetchedAt: null,
  };
}

describe("RssReaderWidget", () => {
  let setFeeds: (f: ReturnType<typeof makeFeed>[]) => void;
  let setEntries: (e: ReturnType<typeof makeEntry>[]) => void;
  let setIsLoading: (l: boolean) => void;
  let getMarkReadMock: () => ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("./RssReaderContext");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFeeds = (mod as any).__setFeeds;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEntries = (mod as any).__setEntries;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setIsLoading = (mod as any).__setIsLoading;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getMarkReadMock = (mod as any).__getMarkReadMock;

    setFeeds([]);
    setEntries([]);
    setIsLoading(false);
    getMarkReadMock().mockClear();
  });

  test("shows empty state when no feeds configured", () => {
    render(<RssReaderWidget />);
    expect(screen.getByText(/No feeds configured/)).toBeInTheDocument();
  });

  test("shows 'Open' button", () => {
    render(<RssReaderWidget />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  test("calls onOpenFullView when Open button clicked", () => {
    const onOpenFullView = vi.fn();
    render(<RssReaderWidget onOpenFullView={onOpenFullView} />);
    fireEvent.click(screen.getByText("Open"));
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });

  test("calls onOpenFullView when empty state clicked", () => {
    const onOpenFullView = vi.fn();
    render(<RssReaderWidget onOpenFullView={onOpenFullView} />);
    fireEvent.click(screen.getByRole("button", { name: /Open RSS Reader/i }));
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });

  test("shows entries when feeds and entries exist", () => {
    setFeeds([makeFeed()]);
    setEntries([makeEntry({ title: "First Article" })]);
    render(<RssReaderWidget />);
    expect(screen.getByLabelText("First Article")).toBeInTheDocument();
  });

  test("shows unread badge count when there are unread entries", () => {
    setFeeds([makeFeed()]);
    setEntries([makeEntry({ isRead: false }), makeEntry({ id: "e2", isRead: false })]);
    render(<RssReaderWidget />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("does not show unread badge when all entries are read", () => {
    setFeeds([makeFeed()]);
    setEntries([makeEntry({ isRead: true })]);
    render(<RssReaderWidget />);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  test("shows at most 5 entries", () => {
    setFeeds([makeFeed()]);
    setEntries(Array.from({ length: 7 }, (_, i) => makeEntry({ id: `e${i}`, title: `Article ${i}` })));
    render(<RssReaderWidget />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeLessThanOrEqual(5);
  });

  test("shows loading indicator when isLoading=true", () => {
    setFeeds([makeFeed()]);
    setIsLoading(true);
    render(<RssReaderWidget />);
    expect(screen.getByText(/Fetching feeds/)).toBeInTheDocument();
  });

  test("shows 'No entries yet' when feed exists but entries is empty", () => {
    setFeeds([makeFeed()]);
    setEntries([]);
    render(<RssReaderWidget />);
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });

  test("unread entry shows blue dot indicator", () => {
    setFeeds([makeFeed()]);
    setEntries([makeEntry({ isRead: false })]);
    render(<RssReaderWidget />);
    const dot = document.querySelector(".bg-blue-400");
    expect(dot).toBeTruthy();
  });

  test("read entry has muted text class", () => {
    setFeeds([makeFeed()]);
    setEntries([makeEntry({ isRead: true, title: "Read Article" })]);
    render(<RssReaderWidget />);
    const link = screen.getByLabelText("Read Article");
    expect(link.className).toContain("text-zinc-600");
  });
});
