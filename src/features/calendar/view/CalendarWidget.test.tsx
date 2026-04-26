import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CalendarWidget } from "./CalendarWidget";

vi.mock("./useCalendar", () => {
  let events: {
    id: string;
    title: string;
    startTime: string;
    endTime: string | null;
    isAllDay: boolean;
    sourceId: string;
    uid: string;
    description: string | null;
    location: string | null;
    createdAt: string;
    updatedAt: string;
  }[] = [];
  let sources: { id: string; url: string; title: string }[] = [];
  let isLoading = false;

  return {
    useCalendar: () => ({
      sources,
      upcomingEvents: events,
      allEvents: events,
      isLoading,
      addSource: vi.fn(),
      deleteSource: vi.fn(),
      sync: vi.fn(),
    }),
    __setEvents: (e: typeof events) => {
      events = e;
    },
    __setSources: (s: typeof sources) => {
      sources = s;
    },
    __setIsLoading: (l: boolean) => {
      isLoading = l;
    },
  };
});

function makeEvent(overrides: Partial<{ id: string; title: string; startTime: string; isAllDay: boolean }> = {}) {
  return {
    id: overrides.id ?? "evt-1",
    sourceId: "src-1",
    uid: overrides.id ?? "evt-1",
    title: overrides.title ?? "Team Meeting",
    description: null,
    location: null,
    startTime: overrides.startTime ?? "2050-10-01T09:00:00.000Z",
    endTime: "2050-10-01T10:00:00.000Z",
    isAllDay: overrides.isAllDay ?? false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeSource() {
  return { id: "src-1", url: "https://example.com/cal.ics", title: "My Calendar" };
}

describe("CalendarWidget", () => {
  let setEvents: (e: ReturnType<typeof makeEvent>[]) => void;
  let setSources: (s: ReturnType<typeof makeSource>[]) => void;
  let setIsLoading: (l: boolean) => void;

  beforeEach(async () => {
    const mod = await import("./useCalendar");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEvents = (mod as any).__setEvents;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSources = (mod as any).__setSources;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setIsLoading = (mod as any).__setIsLoading;

    setEvents([]);
    setSources([]);
    setIsLoading(false);
  });

  test("shows empty state when no sources configured", () => {
    render(<CalendarWidget />);
    expect(screen.getByText(/No calendars configured/)).toBeInTheDocument();
  });

  test("shows 'Open' button", () => {
    render(<CalendarWidget />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  test("calls onOpenFullView when Open button clicked", () => {
    const onOpenFullView = vi.fn();
    render(<CalendarWidget onOpenFullView={onOpenFullView} />);
    fireEvent.click(screen.getByText("Open"));
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });

  test("calls onOpenFullView when empty state clicked", () => {
    const onOpenFullView = vi.fn();
    render(<CalendarWidget onOpenFullView={onOpenFullView} />);
    fireEvent.click(screen.getByRole("button", { name: /Open Calendar/i }));
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });

  test("shows upcoming events when sources and events exist", () => {
    setSources([makeSource()]);
    setEvents([makeEvent({ title: "Budget Review" })]);
    render(<CalendarWidget />);
    expect(screen.getByText("Budget Review")).toBeInTheDocument();
  });

  test("shows 'No upcoming events' when source exists but no events", () => {
    setSources([makeSource()]);
    setEvents([]);
    render(<CalendarWidget />);
    expect(screen.getByText("No upcoming events")).toBeInTheDocument();
  });

  test("shows loading indicator when isLoading=true", () => {
    setSources([makeSource()]);
    setIsLoading(true);
    render(<CalendarWidget />);
    expect(screen.getByText(/Syncing/)).toBeInTheDocument();
  });

  test("shows at most 5 events", () => {
    setSources([makeSource()]);
    setEvents(Array.from({ length: 7 }, (_, i) => makeEvent({ id: `evt-${i}`, title: `Event ${i}` })));
    render(<CalendarWidget />);
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeLessThanOrEqual(5);
  });

  test("marks all-day events as all day", () => {
    setSources([makeSource()]);
    setEvents([makeEvent({ title: "Holiday", isAllDay: true })]);
    render(<CalendarWidget />);
    expect(screen.getByText(/All day/i)).toBeInTheDocument();
  });
});
