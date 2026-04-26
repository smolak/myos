import type { SearchResult } from "@shell/shared/search-types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import type { Command } from "./command-registry";

const COMMANDS: Command[] = [
  { id: "open-todo", label: "Open Todo", description: "View todos", action: vi.fn() },
  { id: "open-pomodoro", label: "Open Pomodoro", description: "Start timer", action: vi.fn() },
  { id: "create-todo", label: "Create Todo", action: vi.fn() },
];

const SEARCH_RESULTS: SearchResult[] = [
  { itemId: "1", title: "Buy milk", featureId: "todo", featureName: "Todo", type: "todo" },
  { itemId: "2", title: "Milk article", featureId: "rss-reader", featureName: "RSS Reader", type: "rss-entry" },
];

describe("CommandPalette", () => {
  test("renders nothing when closed", () => {
    render(<CommandPalette open={false} onClose={vi.fn()} commands={COMMANDS} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("renders dialog when open", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("shows all commands when query is empty", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  test("filters commands by label", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "todo" } });
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  test("filters commands by description", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "timer" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Open Pomodoro")).toBeInTheDocument();
  });

  test("shows 'No commands found' when nothing matches and no search results", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "xyzzy" } });
    expect(screen.getByText("No results found")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  test("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={COMMANDS} />);
    fireEvent.click(screen.getByTestId("palette-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("does not close when clicking inside the panel", () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={COMMANDS} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={COMMANDS} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("executes command and closes on Enter", () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const commands: Command[] = [{ id: "c1", label: "Test Command", action }];
    render(<CommandPalette open={true} onClose={onClose} commands={commands} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("executes command on click", () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const commands: Command[] = [{ id: "c1", label: "Test Command", action }];
    render(<CommandPalette open={true} onClose={onClose} commands={commands} />);
    fireEvent.click(screen.getByRole("option"));
    expect(action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("first item is selected by default", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });

  test("ArrowDown moves selection to next item", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  test("ArrowUp moves selection to previous item", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
  });

  test("ArrowDown does not go past last item", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    const input = screen.getByRole("combobox");
    for (let i = 0; i < 10; i++) fireEvent.keyDown(input, { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");
  });

  test("ArrowUp does not go before first item", () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} />);
    for (let i = 0; i < 5; i++) fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
  });
});

describe("CommandPalette — content search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("does not call onSearch when query is fewer than 2 characters", async () => {
    const onSearch = vi.fn().mockResolvedValue([]);
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "m" } });
    await act(() => vi.runAllTimersAsync());
    expect(onSearch).not.toHaveBeenCalled();
  });

  test("calls onSearch after debounce when query has 2+ characters", async () => {
    const onSearch = vi.fn().mockResolvedValue([]);
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "mi" } });
    await act(() => vi.runAllTimersAsync());
    expect(onSearch).toHaveBeenCalledWith("mi");
  });

  test("shows search results below commands", async () => {
    const onSearch = vi.fn().mockResolvedValue(SEARCH_RESULTS);
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "milk" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText("Milk article")).toBeInTheDocument();
  });

  test("shows featureName as subtitle for search results", async () => {
    const onSearch = vi.fn().mockResolvedValue(SEARCH_RESULTS);
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "milk" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByText("RSS Reader")).toBeInTheDocument();
  });

  test("search results are rendered as options alongside filtered commands", async () => {
    const onSearch = vi.fn().mockResolvedValue(SEARCH_RESULTS);
    // "todo" matches "Open Todo" and "Create Todo" (2 commands) + 2 search results = 4 total
    render(<CommandPalette open={true} onClose={vi.fn()} commands={COMMANDS} onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "todo" } });
    await act(() => vi.runAllTimersAsync());
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(
      COMMANDS.filter((c) => c.label.toLowerCase().includes("todo")).length + SEARCH_RESULTS.length,
    );
  });

  test("ArrowDown navigates into search results after commands", async () => {
    const onSearch = vi.fn().mockResolvedValue(SEARCH_RESULTS);
    const commands: Command[] = [{ id: "c1", label: "Open Todo", action: vi.fn() }];
    render(<CommandPalette open={true} onClose={vi.fn()} commands={commands} onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "milk" } });
    await act(() => vi.runAllTimersAsync());
    const input = screen.getByRole("combobox");
    // move past the one command into first search result
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  test("calls onNavigateToFeature and closes when a search result is selected via click", async () => {
    const onSearch = vi.fn().mockResolvedValue(SEARCH_RESULTS);
    const onNavigateToFeature = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        commands={[]}
        onSearch={onSearch}
        onNavigateToFeature={onNavigateToFeature}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "milk" } });
    await act(() => vi.runAllTimersAsync());
    fireEvent.click(screen.getByText("Buy milk"));
    expect(onNavigateToFeature).toHaveBeenCalledWith("todo");
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("calls onNavigateToFeature when search result is activated via Enter", async () => {
    const onSearch = vi.fn().mockResolvedValue(SEARCH_RESULTS);
    const onNavigateToFeature = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        commands={[]}
        onSearch={onSearch}
        onNavigateToFeature={onNavigateToFeature}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "milk" } });
    await act(() => vi.runAllTimersAsync());
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onNavigateToFeature).toHaveBeenCalledWith("todo");
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("clears search results when query drops below 2 chars", async () => {
    const onSearch = vi.fn().mockResolvedValue(SEARCH_RESULTS);
    render(<CommandPalette open={true} onClose={vi.fn()} commands={[]} onSearch={onSearch} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "milk" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "m" } });
    await act(() => vi.runAllTimersAsync());
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
  });
});
