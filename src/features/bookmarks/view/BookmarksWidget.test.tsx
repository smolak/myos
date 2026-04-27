import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { BookmarksWidget } from "./BookmarksWidget";

const mockOpenUrl = vi.fn();

let bookmarks: Array<{
  id: string;
  title: string;
  url: string;
  description: string | null;
  folder: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}> = [];

vi.mock("./BookmarksContext", () => ({
  useBookmarksContext: () => ({
    bookmarks,
    isLoading: false,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    openUrl: mockOpenUrl,
  }),
}));

function makeBookmark(overrides: Partial<{ id: string; title: string; url: string }> = {}) {
  return {
    id: overrides.id ?? "b1",
    title: overrides.title ?? "Test bookmark",
    url: overrides.url ?? "https://example.com",
    description: null,
    folder: null,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("BookmarksWidget", () => {
  beforeEach(() => {
    bookmarks = [];
    mockOpenUrl.mockClear();
  });

  test("shows empty state when there are no bookmarks", () => {
    render(<BookmarksWidget />);
    expect(screen.getByText(/No bookmarks yet/)).toBeInTheDocument();
  });

  test("shows bookmark titles", () => {
    bookmarks = [makeBookmark({ title: "My Link" })];
    render(<BookmarksWidget />);
    expect(screen.getByText("My Link")).toBeInTheDocument();
  });

  test("clicking a bookmark row opens the URL", () => {
    bookmarks = [makeBookmark({ url: "https://example.com/page" })];
    render(<BookmarksWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Test bookmark" }));
    expect(mockOpenUrl).toHaveBeenCalledWith("https://example.com/page");
  });

  test("shows at most 4 bookmarks", () => {
    bookmarks = Array.from({ length: 6 }, (_, i) => makeBookmark({ id: `b${i}`, title: `Bookmark ${i}` }));
    render(<BookmarksWidget />);
    expect(screen.getAllByRole("button").filter((el) => el.getAttribute("aria-label") !== null)).toHaveLength(4);
  });

  test("shows overflow count when more than 4 bookmarks", () => {
    bookmarks = Array.from({ length: 6 }, (_, i) => makeBookmark({ id: `b${i}`, title: `Bookmark ${i}` }));
    render(<BookmarksWidget />);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });
});
