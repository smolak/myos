import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ClipboardEntry } from "../shared/types";
import { ClipboardHistoryWidget } from "./ClipboardHistoryWidget";

let entries: ClipboardEntry[] = [];
const mockReload = vi.fn();
const mockRemove = vi.fn();
const mockClearAll = vi.fn();

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

describe("ClipboardHistoryWidget", () => {
  beforeEach(() => {
    entries = [];
    vi.clearAllMocks();
  });

  test("shows empty state when there are no entries", () => {
    render(<ClipboardHistoryWidget />);
    expect(screen.getByText(/No clipboard entries yet/)).toBeInTheDocument();
  });

  test("shows entry content", () => {
    entries = [makeEntry({ content: "copied text" })];
    render(<ClipboardHistoryWidget />);
    expect(screen.getByText("copied text")).toBeInTheDocument();
  });

  test("shows at most 5 entries", () => {
    entries = Array.from({ length: 7 }, (_, i) => makeEntry({ id: `e${i}`, content: `entry ${i}` }));
    render(<ClipboardHistoryWidget />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  test("shows overflow count when more than 5 entries", () => {
    entries = Array.from({ length: 8 }, (_, i) => makeEntry({ id: `e${i}`, content: `entry ${i}` }));
    render(<ClipboardHistoryWidget />);
    expect(screen.getByText("+3 more")).toBeInTheDocument();
  });

  test("Open button calls onOpenFullView", () => {
    entries = [makeEntry()];
    const onOpen = vi.fn();
    render(<ClipboardHistoryWidget onOpenFullView={onOpen} />);
    fireEvent.click(screen.getByText("Open"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test("empty state button calls onOpenFullView", () => {
    const onOpen = vi.fn();
    render(<ClipboardHistoryWidget onOpenFullView={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Clipboard History" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test("URL entries are rendered", () => {
    entries = [makeEntry({ content: "https://example.com", contentType: "url" })];
    render(<ClipboardHistoryWidget />);
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });
});
