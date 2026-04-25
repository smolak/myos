import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { DayData } from "../shared/types";
import { DailyJournalFullView } from "./DailyJournalFullView";

const mockAddNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockDeleteNote = vi.fn();
const mockGetDay = vi.fn();
const mockSearchNotes = vi.fn();

let mockNotes: Array<{ id: string; date: string; content: string; createdAt: string; updatedAt: string }> = [];

vi.mock("./useDailyJournal", () => ({
  useDailyJournal: () => ({
    notes: mockNotes,
    isLoading: false,
    todayNote: null,
    getDay: mockGetDay,
    addNote: mockAddNote,
    updateNote: mockUpdateNote,
    deleteNote: mockDeleteNote,
    searchNotes: mockSearchNotes,
  }),
}));

function makeNote(overrides: Partial<{ id: string; date: string; content: string }> = {}) {
  return {
    id: overrides.id ?? "n1",
    date: overrides.date ?? "2026-04-25",
    content: overrides.content ?? "Test note content",
    createdAt: "2026-04-25T10:00:00.000Z",
    updatedAt: "2026-04-25T10:00:00.000Z",
  };
}

function makeDayData(overrides: Partial<DayData> = {}): DayData {
  return {
    date: overrides.date ?? "2026-04-25",
    note: overrides.note ?? null,
    events: overrides.events ?? [],
  };
}

describe("DailyJournalFullView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotes = [];
    mockGetDay.mockResolvedValue(makeDayData());
    mockSearchNotes.mockResolvedValue([]);
  });

  test("calls onClose when Close button is clicked", async () => {
    const onClose = vi.fn();
    render(<DailyJournalFullView onClose={onClose} />);
    await waitFor(() => screen.getByText("Close"));
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("shows 'No entries yet' when note list is empty", async () => {
    render(<DailyJournalFullView />);
    await waitFor(() => expect(screen.getByText("No entries yet")).toBeInTheDocument());
  });

  test("renders note list from hook", async () => {
    mockNotes = [makeNote({ id: "n1", date: "2026-04-25", content: "Great day" })];
    render(<DailyJournalFullView />);
    await waitFor(() => expect(screen.getByText("2026-04-25")).toBeInTheDocument());
  });

  test("shows 'No note for this day' when day has no note", async () => {
    mockGetDay.mockResolvedValue(makeDayData({ note: null, events: [] }));
    render(<DailyJournalFullView />);
    await waitFor(() => expect(screen.getByText("No note for this day.")).toBeInTheDocument());
  });

  test("shows note content when day has a note", async () => {
    mockGetDay.mockResolvedValue(makeDayData({ note: makeNote({ content: "Excellent progress today" }) }));
    render(<DailyJournalFullView />);
    await waitFor(() => expect(screen.getByText("Excellent progress today")).toBeInTheDocument());
  });

  test("enters edit mode when Edit is clicked", async () => {
    mockGetDay.mockResolvedValue(makeDayData({ note: makeNote({ content: "Original content" }) }));
    render(<DailyJournalFullView />);
    await waitFor(() => screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByPlaceholderText(/Write your note/)).toBeInTheDocument();
  });

  test("enters edit mode for new note when Add note is clicked", async () => {
    render(<DailyJournalFullView />);
    await waitFor(() => screen.getByText("Add note"));
    fireEvent.click(screen.getByText("Add note"));
    expect(screen.getByPlaceholderText(/Write your note/)).toBeInTheDocument();
  });

  test("calls addNote when saving a new note", async () => {
    mockAddNote.mockResolvedValue(undefined);
    mockGetDay
      .mockResolvedValueOnce(makeDayData({ note: null }))
      .mockResolvedValue(makeDayData({ note: makeNote({ content: "New note" }) }));

    render(<DailyJournalFullView />);
    await waitFor(() => screen.getByText("Add note"));
    fireEvent.click(screen.getByText("Add note"));

    const textarea = screen.getByPlaceholderText(/Write your note/);
    fireEvent.change(textarea, { target: { value: "New note content" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(mockAddNote).toHaveBeenCalledWith(expect.any(String), "New note content"));
  });

  test("calls updateNote when saving an existing note", async () => {
    const note = makeNote({ content: "Old content" });
    mockUpdateNote.mockResolvedValue(undefined);
    mockGetDay
      .mockResolvedValueOnce(makeDayData({ note }))
      .mockResolvedValue(makeDayData({ note: { ...note, content: "Updated" } }));

    render(<DailyJournalFullView />);
    await waitFor(() => screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Edit"));

    const textarea = screen.getByPlaceholderText(/Write your note/);
    fireEvent.change(textarea, { target: { value: "Updated content" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(mockUpdateNote).toHaveBeenCalledWith(note.id, "Updated content"));
  });

  test("cancels edit without saving", async () => {
    const note = makeNote({ content: "Untouched" });
    mockGetDay.mockResolvedValue(makeDayData({ note }));
    render(<DailyJournalFullView />);
    await waitFor(() => screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockUpdateNote).not.toHaveBeenCalled();
    expect(screen.getByText("Untouched")).toBeInTheDocument();
  });

  test("calls deleteNote when Delete is clicked", async () => {
    const note = makeNote();
    mockDeleteNote.mockResolvedValue(undefined);
    mockGetDay.mockResolvedValueOnce(makeDayData({ note })).mockResolvedValue(makeDayData({ note: null }));

    render(<DailyJournalFullView />);
    await waitFor(() => screen.getByText("Delete"));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => expect(mockDeleteNote).toHaveBeenCalledWith(note.id));
  });

  test("renders timeline events when present", async () => {
    mockGetDay.mockResolvedValue(
      makeDayData({
        events: [
          {
            id: 1,
            eventName: "todo:item-completed",
            featureId: "todo",
            payload: { id: "t1", title: "Buy groceries" },
            createdAt: "2026-04-25T10:30:00.000Z",
          },
        ],
      }),
    );
    render(<DailyJournalFullView />);
    await waitFor(() => expect(screen.getByText(/Completed todo: Buy groceries/)).toBeInTheDocument());
  });

  test("does not show activity timeline section when no events", async () => {
    mockGetDay.mockResolvedValue(makeDayData({ events: [] }));
    render(<DailyJournalFullView />);
    await waitFor(() => screen.getByText(/No activity recorded/));
    expect(screen.queryByText("Activity timeline")).not.toBeInTheDocument();
  });

  test("calls searchNotes when typing in the search box", async () => {
    mockSearchNotes.mockResolvedValue([]);
    render(<DailyJournalFullView />);
    await waitFor(() => screen.getByPlaceholderText("Search notes…"));

    fireEvent.change(screen.getByPlaceholderText("Search notes…"), {
      target: { value: "running" },
    });

    await waitFor(() => expect(mockSearchNotes).toHaveBeenCalledWith("running"));
  });
});
