import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CountdownsFullView } from "./CountdownsFullView";

let countdowns: Array<{
  id: string;
  name: string;
  targetDate: string;
  archivedAt: string | null;
  reachedNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isReached: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
}> = [];

const mockCreate = vi.fn();
const mockRemove = vi.fn();
const mockArchive = vi.fn();

vi.mock("./CountdownsContext", () => ({
  useCountdownsContext: () => ({
    countdowns,
    isLoading: false,
    create: mockCreate,
    remove: mockRemove,
    archive: mockArchive,
  }),
}));

function makeCountdown(overrides: Partial<{ id: string; name: string; isReached: boolean }> = {}) {
  return {
    id: overrides.id ?? "c1",
    name: overrides.name ?? "Test Event",
    targetDate: "2027-01-01",
    archivedAt: null,
    reachedNotifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isReached: overrides.isReached ?? false,
    daysRemaining: 30,
    hoursRemaining: 0,
    minutesRemaining: 0,
  };
}

describe("CountdownsFullView", () => {
  beforeEach(() => {
    countdowns = [];
    mockCreate.mockClear();
    mockRemove.mockClear();
    mockArchive.mockClear();
  });

  test("renders the header", () => {
    render(<CountdownsFullView />);
    expect(screen.getByText("Countdowns")).toBeInTheDocument();
  });

  test("calls onClose when Close is clicked", () => {
    const onClose = vi.fn();
    render(<CountdownsFullView onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("shows empty message when no countdowns", () => {
    render(<CountdownsFullView />);
    expect(screen.getByText(/No countdowns yet/)).toBeInTheDocument();
  });

  test("shows countdown name and target date", () => {
    countdowns = [makeCountdown({ name: "New Year" })];
    render(<CountdownsFullView />);
    expect(screen.getByText("New Year")).toBeInTheDocument();
    expect(screen.getByText("2027-01-01")).toBeInTheDocument();
  });

  test("delete button calls remove with countdown id", () => {
    mockRemove.mockResolvedValue(undefined);
    countdowns = [makeCountdown({ id: "abc", name: "Test" })];
    render(<CountdownsFullView />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Test" }));
    expect(mockRemove).toHaveBeenCalledWith("abc");
  });

  test("archive button is shown for reached countdowns", () => {
    countdowns = [makeCountdown({ id: "abc", name: "Old Event", isReached: true })];
    render(<CountdownsFullView />);
    expect(screen.getByRole("button", { name: "Archive Old Event" })).toBeInTheDocument();
  });

  test("archive button is NOT shown for future countdowns", () => {
    countdowns = [makeCountdown({ name: "Future Event", isReached: false })];
    render(<CountdownsFullView />);
    expect(screen.queryByRole("button", { name: /Archive/ })).toBeNull();
  });

  test("Add button is disabled when name or date is empty", () => {
    render(<CountdownsFullView />);
    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
  });

  test("Add button triggers create with name and date (no time)", async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<CountdownsFullView />);
    fireEvent.change(screen.getByRole("textbox", { name: "Event name" }), {
      target: { value: "Birthday" },
    });
    fireEvent.change(screen.getByLabelText("Target date"), { target: { value: "2027-05-10" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });
    expect(mockCreate).toHaveBeenCalledWith("Birthday", "2027-05-10");
  });

  test("Add button triggers create with name, date and time", async () => {
    mockCreate.mockResolvedValue(undefined);
    render(<CountdownsFullView />);
    fireEvent.change(screen.getByRole("textbox", { name: "Event name" }), {
      target: { value: "Birthday" },
    });
    fireEvent.change(screen.getByLabelText("Target date"), { target: { value: "2027-05-10" } });
    fireEvent.change(screen.getByLabelText("Target time"), { target: { value: "14:30" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    });
    expect(mockCreate).toHaveBeenCalledWith("Birthday", "2027-05-10T14:30");
  });
});
