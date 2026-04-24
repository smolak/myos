import type { ReactNode } from "react";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import type { Layout as RGLLayout } from "react-grid-layout";
import type { DashboardPage, LayoutItem, WidgetSize } from "@core/types";
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
}

export function DashboardGrid({ page, onLayoutChange, renderWidget }: Props) {
  const { width, containerRef, mounted } = useContainerWidth();

  if (page.layout.length === 0) {
    return (
      <div ref={containerRef} className="flex items-center justify-center py-32">
        <p className="text-zinc-400">No widgets configured</p>
      </div>
    );
  }

  const rglLayout: RGLLayout = page.layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));

  function handleLayoutChange(newLayout: RGLLayout): void {
    if (!onLayoutChange) return;
    const items: LayoutItem[] = newLayout.map((rglItem) => {
      const original = page.layout.find((l) => l.i === rglItem.i)!;
      return { ...original, x: rglItem.x, y: rglItem.y, w: rglItem.w, h: rglItem.h };
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
            <div key={item.i} data-testid="widget-slot" className="bg-zinc-800 rounded-lg p-4">
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
