import type { DashboardPage } from "@core/types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import App from "./App";

vi.mock("./electrobun", () => ({
  rpc: {
    request: {
      "dashboard:get-layout": vi.fn().mockResolvedValue({ version: 0, pages: [] }),
      "dashboard:save-layout": vi.fn().mockResolvedValue({ success: true }),
      "theme:get": vi.fn().mockResolvedValue({ mode: "dark", accentColor: "#6366f1" }),
      "theme:update": vi.fn().mockResolvedValue({ success: true }),
      "notification:get-history": vi.fn().mockResolvedValue([]),
      "notification:mark-read": vi.fn().mockResolvedValue({ success: true }),
      "notification:clear": vi.fn().mockResolvedValue({ success: true }),
      "focus:get-last": vi.fn().mockResolvedValue({ lastFocusedFeatureId: null }),
      "focus:set-last": vi.fn().mockResolvedValue({ success: true }),
      "rss:get-feeds": vi.fn().mockResolvedValue([]),
      "rss:get-entries": vi.fn().mockResolvedValue([]),
      "journal:get-notes": vi.fn().mockResolvedValue([]),
      "journal:get-note-by-date": vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("./DashboardGrid", () => ({
  DashboardGrid: ({ page }: { page: DashboardPage }) => (
    <div data-testid="dashboard-grid" data-page-id={page.id} data-page-name={page.name} />
  ),
}));

vi.mock("./FocusModeView", () => ({
  FocusModeView: ({ featureId, onExit }: { featureId: string; onExit: () => void }) => (
    <div data-testid="focus-mode-view" data-feature-id={featureId}>
      <button type="button" onClick={onExit}>
        Exit Focus Mode
      </button>
    </div>
  ),
}));

describe("App", () => {
  test("renders the default dashboard page when no layout is stored", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByTestId("dashboard-grid")).toHaveAttribute("data-page-name", "Dashboard");
  });

  test("loads persisted pages from the RPC layer on mount", async () => {
    const { rpc } = await import("./electrobun");
    const saved: DashboardPage[] = [{ id: "work", name: "Work", layout: [], order: 0 }];
    vi.mocked(rpc.request["dashboard:get-layout"]).mockResolvedValueOnce({ version: 6, pages: saved });

    await act(async () => {
      render(<App />);
    });
    expect(screen.getByTestId("dashboard-grid")).toHaveAttribute("data-page-name", "Work");
  });

  test("does not show focus mode view on initial render", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.queryByTestId("focus-mode-view")).not.toBeInTheDocument();
  });

  test("registers focus mode commands in the command registry", async () => {
    const { commandRegistry } = await import("./command-registry");

    await act(async () => {
      render(<App />);
    });

    const commands = commandRegistry.getAll();
    const focusCommands = commands.filter((c) => c.id.startsWith("focus:"));
    expect(focusCommands.length).toBeGreaterThan(0);
    expect(focusCommands.some((c) => c.id === "focus:todo")).toBe(true);
    expect(focusCommands.some((c) => c.id === "focus:pomodoro")).toBe(true);
    expect(focusCommands.some((c) => c.id === "focus:rss-reader")).toBe(true);
    expect(focusCommands.some((c) => c.id === "focus:daily-journal")).toBe(true);
  });

  test("entering focus mode via command shows FocusModeView", async () => {
    const { commandRegistry } = await import("./command-registry");

    await act(async () => {
      render(<App />);
    });

    const focusTodoCommand = commandRegistry.getAll().find((c) => c.id === "focus:todo");

    await act(async () => {
      focusTodoCommand?.action();
    });

    expect(screen.getByTestId("focus-mode-view")).toBeInTheDocument();
    expect(screen.getByTestId("focus-mode-view")).toHaveAttribute("data-feature-id", "todo");
  });

  test("exiting focus mode via exit button hides FocusModeView", async () => {
    const { commandRegistry } = await import("./command-registry");

    await act(async () => {
      render(<App />);
    });

    const focusTodoCommand = commandRegistry.getAll().find((c) => c.id === "focus:todo");

    await act(async () => {
      focusTodoCommand?.action();
    });

    expect(screen.getByTestId("focus-mode-view")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /exit focus mode/i }));
    });

    expect(screen.queryByTestId("focus-mode-view")).not.toBeInTheDocument();
  });
});
