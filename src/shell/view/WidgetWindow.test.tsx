import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { WidgetWindow } from "./WidgetWindow";

describe("WidgetWindow", () => {
  test("shows the feature's display name and icon in the title bar", () => {
    render(<WidgetWindow featureId="todo">content</WidgetWindow>);

    expect(screen.getByText("Todo")).toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  test("falls back to the raw feature id and a generic icon for an unknown feature", () => {
    render(<WidgetWindow featureId="not-a-feature">content</WidgetWindow>);

    expect(screen.getByText("not-a-feature")).toBeInTheDocument();
    expect(screen.getByText("○")).toBeInTheDocument();
  });
});
