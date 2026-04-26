import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { FocusModeView } from "./FocusModeView";

vi.mock("@features/todo/view/TodoFullView", () => ({
  TodoFullView: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="todo-full-view">
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock("@features/pomodoro/view/PomodoroFullView", () => ({
  PomodoroFullView: () => <div data-testid="pomodoro-full-view" />,
}));

vi.mock("@features/rss-reader/view/RssReaderFullView", () => ({
  RssReaderFullView: () => <div data-testid="rss-reader-full-view" />,
}));

vi.mock("@features/daily-journal/view/DailyJournalFullView", () => ({
  DailyJournalFullView: () => <div data-testid="daily-journal-full-view" />,
}));

describe("FocusModeView", () => {
  test("renders with focus-mode-view test id", () => {
    render(<FocusModeView featureId="todo" onExit={vi.fn()} />);
    expect(screen.getByTestId("focus-mode-view")).toBeInTheDocument();
  });

  test("renders exit button with keyboard hint", () => {
    render(<FocusModeView featureId="todo" onExit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /exit focus mode/i })).toBeInTheDocument();
  });

  test("calls onExit when exit button is clicked", () => {
    const onExit = vi.fn();
    render(<FocusModeView featureId="todo" onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: /exit focus mode/i }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  test("renders TodoFullView for featureId=todo", () => {
    render(<FocusModeView featureId="todo" onExit={vi.fn()} />);
    expect(screen.getByTestId("todo-full-view")).toBeInTheDocument();
  });

  test("renders PomodoroFullView for featureId=pomodoro", () => {
    render(<FocusModeView featureId="pomodoro" onExit={vi.fn()} />);
    expect(screen.getByTestId("pomodoro-full-view")).toBeInTheDocument();
  });

  test("renders RssReaderFullView for featureId=rss-reader", () => {
    render(<FocusModeView featureId="rss-reader" onExit={vi.fn()} />);
    expect(screen.getByTestId("rss-reader-full-view")).toBeInTheDocument();
  });

  test("renders DailyJournalFullView for featureId=daily-journal", () => {
    render(<FocusModeView featureId="daily-journal" onExit={vi.fn()} />);
    expect(screen.getByTestId("daily-journal-full-view")).toBeInTheDocument();
  });

  test("renders nothing for unknown featureId", () => {
    render(<FocusModeView featureId="unknown-feature" onExit={vi.fn()} />);
    expect(screen.queryByTestId("todo-full-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pomodoro-full-view")).not.toBeInTheDocument();
  });

  test("passes onExit as onClose to the feature full view", () => {
    const onExit = vi.fn();
    render(<FocusModeView featureId="todo" onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onExit).toHaveBeenCalledOnce();
  });
});
