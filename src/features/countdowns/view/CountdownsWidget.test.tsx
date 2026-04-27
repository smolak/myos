import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CountdownsWidget } from "./CountdownsWidget";

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

const mockOpenFullView = vi.fn();

vi.mock("./CountdownsContext", () => ({
  useCountdownsContext: () => ({
    countdowns,
    isLoading: false,
    create: vi.fn(),
    remove: vi.fn(),
    archive: vi.fn(),
  }),
}));

function makeCountdown(
  overrides: Partial<{ id: string; name: string; isReached: boolean; daysRemaining: number }> = {},
) {
  return {
    id: overrides.id ?? "c1",
    name: overrides.name ?? "Test Event",
    targetDate: "2027-01-01",
    archivedAt: null,
    reachedNotifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isReached: overrides.isReached ?? false,
    daysRemaining: overrides.daysRemaining ?? 30,
    hoursRemaining: 0,
    minutesRemaining: 0,
  };
}

describe("CountdownsWidget", () => {
  beforeEach(() => {
    countdowns = [];
    mockOpenFullView.mockClear();
  });

  test("shows empty state when there are no countdowns", () => {
    render(<CountdownsWidget onOpenFullView={mockOpenFullView} />);
    expect(screen.getByText(/No countdowns yet/)).toBeInTheDocument();
  });

  test("clicking empty state opens full view", () => {
    render(<CountdownsWidget onOpenFullView={mockOpenFullView} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Countdowns to add countdowns" }));
    expect(mockOpenFullView).toHaveBeenCalledOnce();
  });

  test("shows countdown names", () => {
    countdowns = [makeCountdown({ name: "My Birthday" })];
    render(<CountdownsWidget onOpenFullView={mockOpenFullView} />);
    expect(screen.getByText("My Birthday")).toBeInTheDocument();
  });

  test("shows days remaining for future countdowns", () => {
    countdowns = [makeCountdown({ daysRemaining: 42 })];
    render(<CountdownsWidget onOpenFullView={mockOpenFullView} />);
    expect(screen.getByText(/42d/)).toBeInTheDocument();
  });

  test("shows 'Reached!' for completed countdowns", () => {
    countdowns = [makeCountdown({ isReached: true, daysRemaining: 0 })];
    render(<CountdownsWidget onOpenFullView={mockOpenFullView} />);
    expect(screen.getByText("Reached!")).toBeInTheDocument();
  });

  test("shows at most 4 countdowns", () => {
    countdowns = Array.from({ length: 6 }, (_, i) => makeCountdown({ id: `c${i}`, name: `Event ${i}` }));
    render(<CountdownsWidget onOpenFullView={mockOpenFullView} />);
    expect(screen.getAllByText(/Event \d/).length).toBe(4);
  });

  test("shows overflow count when more than 4 countdowns", () => {
    countdowns = Array.from({ length: 6 }, (_, i) => makeCountdown({ id: `c${i}`, name: `Event ${i}` }));
    render(<CountdownsWidget onOpenFullView={mockOpenFullView} />);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  test("clicking Open button triggers onOpenFullView", () => {
    countdowns = [makeCountdown()];
    render(<CountdownsWidget onOpenFullView={mockOpenFullView} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(mockOpenFullView).toHaveBeenCalledOnce();
  });
});
