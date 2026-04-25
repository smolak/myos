import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PomodoroWidget } from "./PomodoroWidget";

vi.mock("./usePomodoro", () => {
  const startMock = vi.fn();
  const pauseMock = vi.fn();
  const resumeMock = vi.fn();
  const cancelMock = vi.fn();

  let session: null | {
    id: string;
    type: string;
    durationSeconds: number;
    elapsedSeconds: number;
    status: string;
    startedAt: string;
  } = null;
  let remaining = 0;

  return {
    usePomodoro: () => ({
      session,
      remaining,
      settings: { workDurationMinutes: 25, breakDurationMinutes: 5 },
      start: startMock,
      pause: pauseMock,
      resume: resumeMock,
      complete: vi.fn(),
      cancel: cancelMock,
      updateSettings: vi.fn(),
    }),
    formatTime: (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    },
    __setSession: (s: typeof session) => {
      session = s;
    },
    __setRemaining: (r: number) => {
      remaining = r;
    },
    __getStartMock: () => startMock,
    __getPauseMock: () => pauseMock,
    __getResumeMock: () => resumeMock,
    __getCancelMock: () => cancelMock,
  };
});

function makeSession(
  overrides: Partial<{
    status: string;
    type: string;
    durationSeconds: number;
    elapsedSeconds: number;
  }> = {},
) {
  return {
    id: "s1",
    type: overrides.type ?? "work",
    durationSeconds: overrides.durationSeconds ?? 1500,
    elapsedSeconds: overrides.elapsedSeconds ?? 0,
    status: overrides.status ?? "running",
    startedAt: new Date().toISOString(),
  };
}

describe("PomodoroWidget", () => {
  let setSession: (s: ReturnType<typeof makeSession> | null) => void;
  let setRemaining: (r: number) => void;
  let getStartMock: () => ReturnType<typeof vi.fn>;
  let getPauseMock: () => ReturnType<typeof vi.fn>;
  let getResumeMock: () => ReturnType<typeof vi.fn>;
  let getCancelMock: () => ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("./usePomodoro");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSession = (mod as any).__setSession;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRemaining = (mod as any).__setRemaining;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getStartMock = (mod as any).__getStartMock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getPauseMock = (mod as any).__getPauseMock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getResumeMock = (mod as any).__getResumeMock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getCancelMock = (mod as any).__getCancelMock;

    setSession(null);
    setRemaining(0);
    getStartMock().mockClear();
    getPauseMock().mockClear();
    getResumeMock().mockClear();
    getCancelMock().mockClear();
  });

  test("shows idle state with 25:00 when no session", () => {
    render(<PomodoroWidget />);
    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  test("shows Work and Break buttons in idle state", () => {
    render(<PomodoroWidget />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Break")).toBeInTheDocument();
  });

  test("calls start('work') when Work button clicked", () => {
    render(<PomodoroWidget />);
    fireEvent.click(screen.getByText("Work"));
    expect(getStartMock()).toHaveBeenCalledWith("work");
  });

  test("calls start('break') when Break button clicked", () => {
    render(<PomodoroWidget />);
    fireEvent.click(screen.getByText("Break"));
    expect(getStartMock()).toHaveBeenCalledWith("break");
  });

  test("shows Pause and Cancel buttons when running", () => {
    setSession(makeSession({ status: "running" }));
    setRemaining(1200);
    render(<PomodoroWidget />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  test("shows timer countdown when running", () => {
    setSession(makeSession({ status: "running" }));
    setRemaining(1200);
    render(<PomodoroWidget />);
    expect(screen.getByText("20:00")).toBeInTheDocument();
  });

  test("calls pause when Pause button clicked", () => {
    setSession(makeSession({ status: "running" }));
    setRemaining(1200);
    render(<PomodoroWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(getPauseMock()).toHaveBeenCalledOnce();
  });

  test("shows Resume and Cancel buttons when paused", () => {
    setSession(makeSession({ status: "paused" }));
    setRemaining(900);
    render(<PomodoroWidget />);
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  test("calls resume when Resume button clicked", () => {
    setSession(makeSession({ status: "paused" }));
    setRemaining(900);
    render(<PomodoroWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(getResumeMock()).toHaveBeenCalledOnce();
  });

  test("calls cancel when Cancel button clicked while running", () => {
    setSession(makeSession({ status: "running" }));
    setRemaining(1200);
    render(<PomodoroWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(getCancelMock()).toHaveBeenCalledOnce();
  });

  test("shows completed state with 00:00 timer", () => {
    setSession(makeSession({ status: "completed" }));
    setRemaining(0);
    render(<PomodoroWidget />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.getByText("Session complete!")).toBeInTheDocument();
  });

  test("shows New button after completion", () => {
    setSession(makeSession({ status: "completed" }));
    setRemaining(0);
    render(<PomodoroWidget />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  test("calls onOpenFullView when Open button clicked", () => {
    const onOpenFullView = vi.fn();
    render(<PomodoroWidget onOpenFullView={onOpenFullView} />);
    fireEvent.click(screen.getByText("Open"));
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });

  test("shows Work · Running label when session is running", () => {
    setSession(makeSession({ status: "running", type: "work" }));
    setRemaining(1200);
    render(<PomodoroWidget />);
    expect(screen.getByText("Work · Running")).toBeInTheDocument();
  });

  test("shows Break · Paused label when break session is paused", () => {
    setSession(makeSession({ status: "paused", type: "break" }));
    setRemaining(150);
    render(<PomodoroWidget />);
    expect(screen.getByText("Break · Paused")).toBeInTheDocument();
  });
});
