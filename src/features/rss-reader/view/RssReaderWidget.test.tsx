import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FaviconMap, RssEntry, RssFeed } from "../shared/types";
import { RssReaderWidget } from "./RssReaderWidget";
import { makeEntry, makeFeed } from "./test-fixtures";

const mocks = vi.hoisted(() => {
  const state: { feeds: RssFeed[]; entries: RssEntry[]; favicons: FaviconMap; isLoading: boolean } = {
    feeds: [],
    entries: [],
    favicons: {},
    isLoading: false,
  };
  return { state, markRead: vi.fn() };
});

vi.mock("./RssReaderContext", () => ({
  useRssReaderContext: () => ({
    feeds: mocks.state.feeds,
    entries: mocks.state.entries,
    favicons: mocks.state.favicons,
    unreadCount: mocks.state.entries.filter((e) => !e.isRead).length,
    isLoading: mocks.state.isLoading,
    addFeed: vi.fn(),
    deleteFeed: vi.fn(),
    markRead: mocks.markRead,
    markUnread: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("RssReaderWidget", () => {
  beforeEach(() => {
    mocks.state.feeds = [];
    mocks.state.entries = [];
    mocks.state.favicons = {};
    mocks.state.isLoading = false;
    mocks.markRead.mockClear();
  });

  test("shows empty state when no feeds configured", () => {
    render(<RssReaderWidget />);
    expect(screen.getByText(/No feeds configured/)).toBeInTheDocument();
  });

  test("calls onOpenFullView when empty state clicked", () => {
    const onOpenFullView = vi.fn();
    render(<RssReaderWidget onOpenFullView={onOpenFullView} />);
    fireEvent.click(screen.getByRole("button", { name: /Open RSS Reader/i }));
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });

  test("shows entries when feeds and entries exist", () => {
    mocks.state.feeds = [makeFeed()];
    mocks.state.entries = [makeEntry({ title: "First Article" })];
    render(<RssReaderWidget />);
    expect(screen.getByLabelText("First Article")).toBeInTheDocument();
  });

  test("shows unread badge count when there are unread entries", () => {
    mocks.state.feeds = [makeFeed()];
    mocks.state.entries = [makeEntry({ isRead: false }), makeEntry({ id: "e2", isRead: false })];
    render(<RssReaderWidget />);
    expect(screen.getByText("2 unread")).toBeInTheDocument();
  });

  test("does not show unread badge when all entries are read", () => {
    mocks.state.feeds = [makeFeed()];
    mocks.state.entries = [makeEntry({ isRead: true })];
    render(<RssReaderWidget />);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  test("shows at most 5 entries", () => {
    mocks.state.feeds = [makeFeed()];
    mocks.state.entries = Array.from({ length: 7 }, (_, i) => makeEntry({ id: `e${i}`, title: `Article ${i}` }));
    render(<RssReaderWidget />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeLessThanOrEqual(5);
  });

  test("shows loading indicator when isLoading=true", () => {
    mocks.state.feeds = [makeFeed()];
    mocks.state.isLoading = true;
    render(<RssReaderWidget />);
    expect(screen.getByText(/Fetching feeds/)).toBeInTheDocument();
  });

  test("shows 'No entries yet' when feed exists but entries is empty", () => {
    mocks.state.feeds = [makeFeed()];
    render(<RssReaderWidget />);
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
  });

  test("unread entry shows blue dot indicator", () => {
    mocks.state.feeds = [makeFeed()];
    mocks.state.entries = [makeEntry({ isRead: false })];
    render(<RssReaderWidget />);
    const dot = document.querySelector(".bg-blue-400");
    expect(dot).toBeTruthy();
  });

  test("shows the cached favicon for the entry link's hostname", () => {
    mocks.state.feeds = [makeFeed()];
    mocks.state.entries = [makeEntry({ link: "https://example.com/1" })];
    mocks.state.favicons = { "example.com": "data:image/png;base64,AAAA" };
    const { container } = render(<RssReaderWidget />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  test("read entry has muted text class", () => {
    mocks.state.feeds = [makeFeed()];
    mocks.state.entries = [makeEntry({ isRead: true, title: "Read Article" })];
    render(<RssReaderWidget />);
    const link = screen.getByLabelText("Read Article");
    expect(link.className).toContain("text-zinc-600");
  });
});
