import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { RssEntry, RssFeed } from "../shared/types";
import { RssReaderFullView } from "./RssReaderFullView";

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
  markRead: vi.fn(),
  markUnread: vi.fn(),
  state: {
    feeds: [] as RssFeed[],
    entries: [] as RssEntry[],
    favicons: {} as Record<string, string>,
  },
}));

vi.mock("@shell/view/electrobun", () => ({
  rpc: {
    request: new Proxy(
      {},
      {
        get: (_target, prop: string) => (prop === "shell:open-url" ? mocks.openUrl : vi.fn().mockResolvedValue({})),
      },
    ),
  },
}));

vi.mock("./RssReaderContext", () => ({
  useRssReaderContext: () => ({
    feeds: mocks.state.feeds,
    entries: mocks.state.entries,
    favicons: mocks.state.favicons,
    unreadCount: mocks.state.entries.filter((e) => !e.isRead).length,
    isLoading: false,
    addFeed: vi.fn(),
    deleteFeed: vi.fn(),
    markRead: mocks.markRead,
    markUnread: mocks.markUnread,
    refresh: vi.fn(),
  }),
}));

function makeEntry(overrides: Partial<RssEntry> = {}): RssEntry {
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

function makeFeed(): RssFeed {
  return {
    id: "f1",
    url: "https://example.com/feed",
    title: "Test Feed",
    description: null,
    fetchIntervalMinutes: 30,
    lastFetchedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("RssReaderFullView", () => {
  beforeEach(() => {
    mocks.state.feeds = [];
    mocks.state.entries = [];
    mocks.state.favicons = {};
    mocks.openUrl.mockClear();
    mocks.markRead.mockClear();
    mocks.markUnread.mockClear();
  });

  describe("Entries tab icons", () => {
    test("shows the cached favicon for the entry link's hostname", () => {
      mocks.state.entries = [makeEntry({ link: "https://example.com/1" })];
      mocks.state.favicons = { "example.com": "data:image/png;base64,AAAA" };
      const { container } = render(<RssReaderFullView />);
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src", "data:image/png;base64,AAAA");
      expect(img).toHaveAttribute("aria-hidden", "true");
    });

    test("shows a lettered placeholder when no favicon is cached", () => {
      mocks.state.entries = [makeEntry({ link: "https://example.com/1" })];
      const { container } = render(<RssReaderFullView />);
      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByText("E")).toHaveAttribute("aria-hidden", "true");
    });

    test("keeps the entry title as the accessible label when an icon is shown", () => {
      mocks.state.entries = [makeEntry({ title: "Iconed Article" })];
      mocks.state.favicons = { "example.com": "data:image/png;base64,AAAA" };
      render(<RssReaderFullView />);
      expect(screen.getByRole("button", { name: "Iconed Article" })).toBeInTheDocument();
    });
  });

  describe("Manage tab", () => {
    test("keeps feed rows icon-free", () => {
      mocks.state.feeds = [makeFeed()];
      mocks.state.entries = [makeEntry()];
      mocks.state.favicons = { "example.com": "data:image/png;base64,AAAA" };
      const { container } = render(<RssReaderFullView />);
      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
      expect(screen.getByText("Test Feed")).toBeInTheDocument();
      expect(container.querySelector("img")).toBeNull();
    });
  });

  describe("existing behaviors stay unchanged", () => {
    test("opens the link and marks the entry read when its title is clicked", () => {
      mocks.state.entries = [makeEntry({ id: "e1", title: "Clickable Article", link: "https://example.com/1" })];
      render(<RssReaderFullView />);
      fireEvent.click(screen.getByRole("button", { name: "Clickable Article" }));
      expect(mocks.openUrl).toHaveBeenCalledWith({ url: "https://example.com/1" });
      expect(mocks.markRead).toHaveBeenCalledWith("e1");
    });

    test("toggles a read entry back to unread via the mark unread button", () => {
      mocks.state.entries = [makeEntry({ id: "e1", isRead: true })];
      render(<RssReaderFullView />);
      fireEvent.click(screen.getByRole("button", { name: "Mark unread" }));
      expect(mocks.markUnread).toHaveBeenCalledWith("e1");
    });
  });
});
