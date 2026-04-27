import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ClipboardEntry } from "../shared/types";
import { ClipboardHistoryFullView } from "./ClipboardHistoryFullView";

let entries: ClipboardEntry[] = [];
const mockRemove = vi.fn();
const mockClearAll = vi.fn();
const mockReload = vi.fn();

vi.mock("./ClipboardHistoryContext", () => ({
  useClipboardHistoryContext: () => ({
    entries,
    isLoading: false,
    reload: mockReload,
    remove: mockRemove,
    clearAll: mockClearAll,
  }),
}));

function makeEntry(overrides: Partial<ClipboardEntry> = {}): ClipboardEntry {
  return {
    id: overrides.id ?? "e1",
    content: overrides.content ?? "some text",
    contentType: overrides.contentType ?? "text",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

describe("ClipboardHistoryFullView", () => {
  beforeEach(() => {
    entries = [];
    vi.clearAllMocks();
  });

  test("shows empty state when no entries", () => {
    render(<ClipboardHistoryFullView onClose={vi.fn()} />);
    expect(screen.getByText(/Nothing in clipboard history yet/)).toBeInTheDocument();
  });

  test("renders entry content", () => {
    entries = [makeEntry({ content: "hello clipboard" })];
    render(<ClipboardHistoryFullView onClose={vi.fn()} />);
    expect(screen.getByText("hello clipboard")).toBeInTheDocument();
  });

  test("delete button calls remove with entry id", () => {
    entries = [makeEntry({ id: "abc", content: "delete me" })];
    render(<ClipboardHistoryFullView onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete entry/ }));
    expect(mockRemove).toHaveBeenCalledWith("abc");
  });

  test("search filters entries by content", () => {
    entries = [makeEntry({ id: "e1", content: "foo bar" }), makeEntry({ id: "e2", content: "hello world" })];
    render(<ClipboardHistoryFullView onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Search clipboard/), { target: { value: "hello" } });
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.queryByText("foo bar")).not.toBeInTheDocument();
  });

  test("shows no results message when search yields nothing", () => {
    entries = [makeEntry({ content: "something" })];
    render(<ClipboardHistoryFullView onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Search clipboard/), { target: { value: "xyz" } });
    expect(screen.getByText(/No entries match your search/)).toBeInTheDocument();
  });

  test("clear all button calls clearAll", () => {
    entries = [makeEntry()];
    render(<ClipboardHistoryFullView onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Clear all"));
    expect(mockClearAll).toHaveBeenCalledOnce();
  });

  test("close button calls onClose", () => {
    const onClose = vi.fn();
    render(<ClipboardHistoryFullView onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close clipboard history" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("does not show clear all button when no entries", () => {
    render(<ClipboardHistoryFullView onClose={vi.fn()} />);
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
  });
});
