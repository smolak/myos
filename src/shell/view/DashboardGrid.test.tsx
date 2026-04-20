import { render, screen } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import type { DashboardPage, LayoutItem } from "@core/types";
import { DashboardGrid, WIDGET_SIZES } from "./DashboardGrid";

vi.mock("react-grid-layout", () => ({
	GridLayout: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="rgl-grid">{children}</div>
	),
	useContainerWidth: () => ({ width: 800, containerRef: { current: null }, mounted: true }),
}));

const EMPTY_PAGE: DashboardPage = { id: "p1", name: "Main", layout: [], order: 0 };

const ITEM: LayoutItem = {
	i: "widget-1",
	x: 0,
	y: 0,
	w: 1,
	h: 1,
	featureId: "todo",
	widgetId: "list",
};

describe("DashboardGrid", () => {
	describe("empty state", () => {
		test("shows placeholder when layout is empty", () => {
			render(<DashboardGrid page={EMPTY_PAGE} />);
			expect(screen.getByText("No widgets configured")).toBeInTheDocument();
		});

		test("does not show grid when layout is empty", () => {
			render(<DashboardGrid page={EMPTY_PAGE} />);
			expect(screen.queryByTestId("rgl-grid")).not.toBeInTheDocument();
		});
	});

	describe("with items", () => {
		test("does not show placeholder when layout has items", () => {
			render(<DashboardGrid page={{ ...EMPTY_PAGE, layout: [ITEM] }} />);
			expect(screen.queryByText("No widgets configured")).not.toBeInTheDocument();
		});

		test("renders the grid when layout has items", () => {
			render(<DashboardGrid page={{ ...EMPTY_PAGE, layout: [ITEM] }} />);
			expect(screen.getByTestId("rgl-grid")).toBeInTheDocument();
		});

		test("renders one slot per layout item", () => {
			const items: LayoutItem[] = [
				ITEM,
				{ ...ITEM, i: "widget-2", widgetId: "list-2" },
			];
			render(<DashboardGrid page={{ ...EMPTY_PAGE, layout: items }} />);
			expect(screen.getAllByTestId("widget-slot")).toHaveLength(2);
		});
	});
});

describe("WIDGET_SIZES", () => {
	test("small is 1×1", () => {
		expect(WIDGET_SIZES.small).toEqual({ w: 1, h: 1 });
	});

	test("medium is 2×1", () => {
		expect(WIDGET_SIZES.medium).toEqual({ w: 2, h: 1 });
	});

	test("wide is 2×2", () => {
		expect(WIDGET_SIZES.wide).toEqual({ w: 2, h: 2 });
	});

	test("full-width is 4×1", () => {
		expect(WIDGET_SIZES["full-width"]).toEqual({ w: 4, h: 1 });
	});
});
