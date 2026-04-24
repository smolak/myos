import { useState, useCallback, useEffect } from "react";
import type { DashboardPage, LayoutItem } from "@core/types";
import { DashboardGrid } from "./DashboardGrid";
import { TodoWidget } from "@features/todo/view/TodoWidget";
import { TodoFullView } from "@features/todo/view/TodoFullView";
import { PomodoroWidget } from "@features/pomodoro/view/PomodoroWidget";
import { PomodoroFullView } from "@features/pomodoro/view/PomodoroFullView";
import { RssReaderWidget } from "@features/rss-reader/view/RssReaderWidget";
import { RssReaderFullView } from "@features/rss-reader/view/RssReaderFullView";
import { ClockWidget } from "@features/clock/view/ClockWidget";
import { WeatherWidget } from "@features/weather/view/WeatherWidget";
import { rpc } from "./electrobun";

const LAYOUT_VERSION = 4;

const DEFAULT_PAGES: DashboardPage[] = [
  {
    id: "default",
    name: "Dashboard",
    layout: [
      { i: "todo-1", x: 0, y: 0, w: 2, h: 2, featureId: "todo", widgetId: "task-list" },
      { i: "pomodoro-1", x: 2, y: 0, w: 2, h: 1, featureId: "pomodoro", widgetId: "timer" },
      { i: "clock-1", x: 2, y: 1, w: 1, h: 1, featureId: "clock", widgetId: "display" },
      { i: "weather-1", x: 3, y: 1, w: 1, h: 1, featureId: "weather", widgetId: "conditions" },
      { i: "rss-1", x: 0, y: 2, w: 4, h: 2, featureId: "rss-reader", widgetId: "feed-list" },
    ],
    order: 0,
  },
];

function App() {
  const [pages, setPages] = useState<DashboardPage[]>(DEFAULT_PAGES);
  const [fullViewFeature, setFullViewFeature] = useState<string | null>(null);
  const currentPage = pages[0]!;

  useEffect(() => {
    void rpc.request["dashboard:get-layout"]({}).then((stored) => {
      if (stored.version === LAYOUT_VERSION && stored.pages.length > 0) {
        setPages(stored.pages);
      }
    });
  }, []);

  const handleLayoutChange = useCallback(
    (layout: LayoutItem[]): void => {
      setPages((prev) => {
        const updated = prev.map((p) => (p.id === currentPage.id ? { ...p, layout } : p));
        void rpc.request["dashboard:save-layout"]({ version: LAYOUT_VERSION, pages: updated });
        return updated;
      });
    },
    [currentPage.id],
  );

  function renderWidget(item: LayoutItem) {
    if (item.featureId === "todo" && item.widgetId === "task-list") {
      return <TodoWidget onOpenFullView={() => setFullViewFeature("todo")} />;
    }
    if (item.featureId === "pomodoro" && item.widgetId === "timer") {
      return <PomodoroWidget onOpenFullView={() => setFullViewFeature("pomodoro")} />;
    }
    if (item.featureId === "rss-reader" && item.widgetId === "feed-list") {
      return <RssReaderWidget onOpenFullView={() => setFullViewFeature("rss-reader")} />;
    }
    if (item.featureId === "clock" && item.widgetId === "display") {
      return <ClockWidget />;
    }
    if (item.featureId === "weather" && item.widgetId === "conditions") {
      return <WeatherWidget onOpenFullView={() => setFullViewFeature("weather")} />;
    }
    return (
      <span className="text-xs text-zinc-500">
        {item.featureId}/{item.widgetId}
      </span>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-6 py-4 backdrop-blur">
        <h1 className="text-lg font-semibold tracking-tight">MyOS</h1>
      </header>
      <main className="flex-1 overflow-auto p-4">
        <DashboardGrid page={currentPage} onLayoutChange={handleLayoutChange} renderWidget={renderWidget} />
      </main>

      {fullViewFeature === "todo" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="w-full max-w-lg h-2/3 rounded-xl overflow-hidden shadow-2xl">
            <TodoFullView onClose={() => setFullViewFeature(null)} />
          </div>
        </div>
      )}
      {fullViewFeature === "pomodoro" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="w-full max-w-lg h-2/3 rounded-xl overflow-hidden shadow-2xl">
            <PomodoroFullView onClose={() => setFullViewFeature(null)} />
          </div>
        </div>
      )}
      {fullViewFeature === "rss-reader" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
            <RssReaderFullView onClose={() => setFullViewFeature(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
