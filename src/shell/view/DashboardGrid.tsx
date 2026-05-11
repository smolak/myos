import type { DashboardPage, LayoutItem, WidgetSize } from "@core/types";
import type { ReactNode } from "react";
import type { Layout as RGLLayout } from "react-grid-layout";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export const WIDGET_SIZES: Record<WidgetSize, { readonly w: number; readonly h: number }> = {
  small: { w: 1, h: 1 },
  medium: { w: 2, h: 1 },
  wide: { w: 2, h: 2 },
  "full-width": { w: 4, h: 1 },
};

const GRID_COLS = 4;
const GRID_ROW_HEIGHT = 160;

interface Props {
  page: DashboardPage;
  onLayoutChange?: (layout: LayoutItem[]) => void;
  renderWidget?: (item: LayoutItem) => ReactNode;
  onOpenCatalog?: () => void;
}

export function DashboardGrid({ page, onLayoutChange, renderWidget, onOpenCatalog }: Props) {
  const { width, containerRef, mounted } = useContainerWidth();

  if (page.layout.length === 0) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-zinc-500 text-sm">Your desktop is empty</p>
        {onOpenCatalog && (
          <button
            type="button"
            onClick={onOpenCatalog}
            className="text-xs px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            + Add features
          </button>
        )}
      </div>
    );
  }

  const rglLayout: RGLLayout = page.layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));

  function handleLayoutChange(newLayout: RGLLayout): void {
    if (!onLayoutChange) return;
    const items: LayoutItem[] = newLayout.flatMap((rglItem) => {
      const original = page.layout.find((l) => l.i === rglItem.i);
      return original ? [{ ...original, x: rglItem.x, y: rglItem.y, w: rglItem.w, h: rglItem.h }] : [];
    });
    onLayoutChange(items);
  }

  return (
    <div ref={containerRef}>
      {mounted && (
        <GridLayout
          width={width}
          gridConfig={{ cols: GRID_COLS, rowHeight: GRID_ROW_HEIGHT }}
          layout={rglLayout}
          onLayoutChange={handleLayoutChange}
        >
          {page.layout.map((item) => (
            <div key={item.i} data-testid="widget-slot">
              {renderWidget ? (
                renderWidget(item)
              ) : (
                <span className="text-xs text-zinc-500">
                  {item.featureId}/{item.widgetId}
                </span>
              )}
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
