import type { DashboardPage } from "@core/types";
import { render, screen } from "@testing-library/react";
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
    },
  },
}));

vi.mock("./DashboardGrid", () => ({
  DashboardGrid: ({ page }: { page: DashboardPage }) => (
    <div data-testid="dashboard-grid" data-page-id={page.id} data-page-name={page.name} />
  ),
}));

describe("App", () => {
  test("renders the default dashboard page when no layout is stored", () => {
    render(<App />);
    expect(screen.getByTestId("dashboard-grid")).toHaveAttribute("data-page-name", "Dashboard");
  });

  test("loads persisted pages from the RPC layer on mount", async () => {
    const { rpc } = await import("./electrobun");
    const saved: DashboardPage[] = [{ id: "work", name: "Work", layout: [], order: 0 }];
    vi.mocked(rpc.request["dashboard:get-layout"]).mockResolvedValueOnce({ version: 4, pages: saved });

    render(<App />);
    expect(await screen.findByTestId("dashboard-grid")).toHaveAttribute("data-page-name", "Work");
  });
});
