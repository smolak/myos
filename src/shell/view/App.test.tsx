import { render, screen } from "@testing-library/react";
import { describe, test, expect, beforeEach, vi } from "vitest";
import type { DashboardPage } from "@core/types";
import App from "./App";

vi.mock("./DashboardGrid", () => ({
  DashboardGrid: ({ page }: { page: DashboardPage }) => (
    <div data-testid="dashboard-grid" data-page-id={page.id} data-page-name={page.name} />
  ),
}));

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders the default dashboard page when nothing is stored", () => {
    render(<App />);
    expect(screen.getByTestId("dashboard-grid")).toHaveAttribute("data-page-name", "Dashboard");
  });

  test("loads persisted pages from localStorage on mount", () => {
    const saved: DashboardPage[] = [{ id: "work", name: "Work", layout: [], order: 0 }];
    localStorage.setItem("dashboard:pages", JSON.stringify(saved));
    render(<App />);
    expect(screen.getByTestId("dashboard-grid")).toHaveAttribute("data-page-name", "Work");
  });
});
