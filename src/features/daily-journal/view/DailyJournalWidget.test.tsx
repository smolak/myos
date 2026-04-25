import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DailyJournalWidget } from "./DailyJournalWidget";

vi.mock("./useDailyJournal", () => {
  let todayNote: { id: string; date: string; content: string; createdAt: string; updatedAt: string } | null = null;
  let notes: Array<{ id: string; date: string; content: string; createdAt: string; updatedAt: string }> = [];
  return {
    useDailyJournal: () => ({
      todayNote,
      notes,
      isLoading: false,
      getDay: vi.fn(),
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      searchNotes: vi.fn(),
    }),
    __setTodayNote: (n: typeof todayNote) => {
      todayNote = n;
    },
    __setNotes: (n: typeof notes) => {
      notes = n;
    },
  };
});

function makeNote(overrides: Partial<{ id: string; date: string; content: string }> = {}) {
  return {
    id: overrides.id ?? "n1",
    date: overrides.date ?? new Date().toISOString().split("T")[0],
    content: overrides.content ?? "Some note content",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("DailyJournalWidget", () => {
  let setTodayNote: (n: ReturnType<typeof makeNote> | null) => void;
  let setNotes: (n: ReturnType<typeof makeNote>[]) => void;

  beforeEach(async () => {
    const mod = await import("./useDailyJournal");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setTodayNote = (mod as any).__setTodayNote;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setNotes = (mod as any).__setNotes;
    setTodayNote(null);
    setNotes([]);
  });

  test("shows prompt when no note for today", () => {
    render(<DailyJournalWidget />);
    expect(screen.getByText(/No note for today/)).toBeInTheDocument();
  });

  test("shows today note content when present", () => {
    setTodayNote(makeNote({ content: "Had a great morning" }));
    render(<DailyJournalWidget />);
    expect(screen.getByText("Had a great morning")).toBeInTheDocument();
  });

  test("shows entry count for the week", () => {
    const recent = makeNote({ id: "n1", date: new Date().toISOString().split("T")[0] });
    setNotes([recent]);
    render(<DailyJournalWidget />);
    expect(screen.getByText(/1 entry this week/)).toBeInTheDocument();
  });

  test("calls onOpenFullView when View all is clicked", () => {
    const onOpenFullView = vi.fn();
    render(<DailyJournalWidget onOpenFullView={onOpenFullView} />);
    fireEvent.click(screen.getByText("View all"));
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });

  test("calls onOpenFullView when the write prompt is clicked", () => {
    const onOpenFullView = vi.fn();
    render(<DailyJournalWidget onOpenFullView={onOpenFullView} />);
    fireEvent.click(screen.getByText(/No note for today/));
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });
});
