import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { BookmarksFullView } from "./BookmarksFullView";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
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
    create: mockCreate,
    update: mockUpdate,
    remove: mockRemove,
    openUrl: mockOpenUrl,
  }),
}));

function makeBookmark(
  overrides: Partial<{
    id: string;
    title: string;
    url: string;
    description: string;
    folder: string;
    tags: string[];
  }> = {},
) {
  return {
    id: overrides.id ?? "b1",
    title: overrides.title ?? "Test bookmark",
    url: overrides.url ?? "https://example.com",
    description: overrides.description ?? null,
    folder: overrides.folder ?? null,
    tags: overrides.tags ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("BookmarksFullView", () => {
  beforeEach(() => {
    bookmarks = [];
    mockCreate.mockClear();
    mockUpdate.mockClear();
    mockRemove.mockClear();
    mockOpenUrl.mockClear();
  });

  test("shows empty state when there are no bookmarks", () => {
    render(<BookmarksFullView />);
    expect(screen.getByText(/No bookmarks yet/)).toBeInTheDocument();
  });

  test("shows bookmark titles", () => {
    bookmarks = [makeBookmark({ title: "My Link" })];
    render(<BookmarksFullView />);
    expect(screen.getByText("My Link")).toBeInTheDocument();
  });

  test("clicking bookmark title opens the URL", () => {
    bookmarks = [makeBookmark({ url: "https://example.com/page" })];
    render(<BookmarksFullView />);
    fireEvent.click(screen.getByRole("button", { name: "Open Test bookmark" }));
    expect(mockOpenUrl).toHaveBeenCalledWith("https://example.com/page");
  });

  test("clicking Edit shows an inline edit form", () => {
    bookmarks = [makeBookmark({ title: "My Link" })];
    render(<BookmarksFullView />);
    fireEvent.click(screen.getByRole("button", { name: "Edit My Link" }));
    expect(screen.getByDisplayValue("My Link")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  test("edit form is pre-populated with existing bookmark values", () => {
    bookmarks = [
      makeBookmark({
        title: "My Link",
        url: "https://example.com",
        description: "A desc",
        folder: "Work",
        tags: ["dev", "tools"],
      }),
    ];
    render(<BookmarksFullView />);
    fireEvent.click(screen.getByRole("button", { name: "Edit My Link" }));
    expect(screen.getByDisplayValue("My Link")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A desc")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Work")).toBeInTheDocument();
    expect(screen.getByDisplayValue("dev, tools")).toBeInTheDocument();
  });

  test("saving edit form calls update with changed values", async () => {
    mockUpdate.mockResolvedValue(undefined);
    bookmarks = [makeBookmark({ title: "Old Title", url: "https://old.com" })];
    render(<BookmarksFullView />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Old Title" }));

    const titleInput = screen.getByDisplayValue("Old Title");
    fireEvent.change(titleInput, { target: { value: "New Title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("b1", expect.objectContaining({ title: "New Title" }));
    });
  });

  test("cancelling edit form hides it without saving", () => {
    bookmarks = [makeBookmark({ title: "My Link" })];
    render(<BookmarksFullView />);
    fireEvent.click(screen.getByRole("button", { name: "Edit My Link" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("clicking Remove calls remove with bookmark id", () => {
    mockRemove.mockResolvedValue(undefined);
    bookmarks = [makeBookmark({ id: "bx", title: "My Link" })];
    render(<BookmarksFullView />);
    fireEvent.click(screen.getByRole("button", { name: "Delete My Link" }));
    expect(mockRemove).toHaveBeenCalledWith("bx");
  });

  test("add bookmark form calls create", async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<BookmarksFullView />);
    fireEvent.change(screen.getByRole("textbox", { name: "Bookmark title" }), { target: { value: "New" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Bookmark URL" }), { target: { value: "https://new.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add bookmark" }));
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith("New", "https://new.com", undefined, undefined, undefined);
    });
  });
});
