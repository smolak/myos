import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { RssReaderFullView } from "./RssReaderFullView";

const openUrlMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@shell/view/electrobun", () => ({
  rpc: {
    request: new Proxy(
      {},
      {
        get: (_target, prop: string) => (prop === "shell:open-url" ? openUrlMock : vi.fn().mockResolvedValue({})),
      },
    ),
  },
}));

vi.mock("./RssReaderContext", () => {
  const markReadMock = vi.fn();
  const markUnreadMock = vi.fn();

  let feeds: {
    id: string;
    url: string;
    title: string;
    fetchIntervalMinutes: number;
    lastFetchedAt: string | null;
  }[] = [];
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
  let favicons: Record<string, string> = {};

  return {
    useRssReaderContext: () => ({
      feeds,
      entries,
      favicons,
      unreadCount: entries.filter((e) => !e.isRead).length,
      isLoading: false,
      addFeed: vi.fn(),
      deleteFeed: vi.fn(),
      markRead: markReadMock,
      markUnread: markUnreadMock,
      refresh: vi.fn(),
    }),
    __setFeeds: (f: typeof feeds) => {
      feeds = f;
    },
    __setEntries: (e: typeof entries) => {
      entries = e;
    },
    __setFavicons: (f: Record<string, string>) => {
      favicons = f;
    },
    __getMarkReadMock: () => markReadMock,
    __getMarkUnreadMock: () => markUnreadMock,
  };
});

function makeEntry(
  overrides: Partial<{
    id: string;
    title: string;
    link: string;
    isRead: boolean;
  }> = {},
) {
  return {
    id: overrides.id ?? "e1",
    feedId: "f1",
    guid: overrides.id ?? "e1",
    title: overrides.title ?? "Test Article",
    link: overrides.link ?? "https://example.com/1",
    description: null,
    publishedAt: "2026-01-01T10:00:00.000Z",
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

describe("RssReaderFullView", () => {
  let setFeeds: (f: ReturnType<typeof makeFeed>[]) => void;
  let setEntries: (e: ReturnType<typeof makeEntry>[]) => void;
  let setFavicons: (f: Record<string, string>) => void;
  let getMarkReadMock: () => ReturnType<typeof vi.fn>;
  let getMarkUnreadMock: () => ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("./RssReaderContext");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFeeds = (mod as any).__setFeeds;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEntries = (mod as any).__setEntries;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFavicons = (mod as any).__setFavicons;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getMarkReadMock = (mod as any).__getMarkReadMock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getMarkUnreadMock = (mod as any).__getMarkUnreadMock;

    setFeeds([]);
    setEntries([]);
    setFavicons({});
    getMarkReadMock().mockClear();
    getMarkUnreadMock().mockClear();
    openUrlMock.mockClear();
  });

  describe("Entries tab icons", () => {
    test("entry row shows the cached favicon for the link's hostname", () => {
      setEntries([makeEntry({ link: "https://example.com/1" })]);
      setFavicons({ "example.com": "data:image/png;base64,AAAA" });
      const { container } = render(<RssReaderFullView />);
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("src", "data:image/png;base64,AAAA");
      expect(img).toHaveAttribute("aria-hidden", "true");
    });

    test("entry row shows a lettered placeholder when no favicon is cached", () => {
      setEntries([makeEntry({ link: "https://example.com/1" })]);
      const { container } = render(<RssReaderFullView />);
      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByText("E")).toHaveAttribute("aria-hidden", "true");
    });

    test("entry title remains the accessible label when an icon is shown", () => {
      setEntries([makeEntry({ title: "Iconed Article" })]);
      setFavicons({ "example.com": "data:image/png;base64,AAAA" });
      render(<RssReaderFullView />);
      expect(screen.getByRole("button", { name: "Iconed Article" })).toBeInTheDocument();
    });
  });

  describe("Manage tab", () => {
    test("feed rows remain icon-free", () => {
      setFeeds([makeFeed()]);
      setEntries([makeEntry()]);
      setFavicons({ "example.com": "data:image/png;base64,AAAA" });
      const { container } = render(<RssReaderFullView />);
      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
      expect(screen.getByText("Test Feed")).toBeInTheDocument();
      expect(container.querySelector("img")).toBeNull();
    });
  });

  describe("existing behaviors stay unchanged", () => {
    test("clicking an entry title opens the link and marks it read", () => {
      setEntries([makeEntry({ id: "e1", title: "Clickable Article", link: "https://example.com/1" })]);
      render(<RssReaderFullView />);
      fireEvent.click(screen.getByRole("button", { name: "Clickable Article" }));
      expect(openUrlMock).toHaveBeenCalledWith({ url: "https://example.com/1" });
      expect(getMarkReadMock()).toHaveBeenCalledWith("e1");
    });

    test("mark unread button toggles a read entry", () => {
      setEntries([makeEntry({ id: "e1", isRead: true })]);
      render(<RssReaderFullView />);
      fireEvent.click(screen.getByRole("button", { name: "Mark unread" }));
      expect(getMarkUnreadMock()).toHaveBeenCalledWith("e1");
    });

    test("unread entry title keeps the unread styling when an icon is shown", () => {
      setEntries([makeEntry({ title: "Unread Article", isRead: false })]);
      setFavicons({ "example.com": "data:image/png;base64,AAAA" });
      render(<RssReaderFullView />);
      expect(screen.getByRole("button", { name: "Unread Article" }).className).toContain("text-zinc-200");
    });
  });
});
