import type { DashboardPage, LayoutItem } from "@core/types";
import { BookmarksProvider } from "@features/bookmarks/view/BookmarksContext";
import { BookmarksFullView } from "@features/bookmarks/view/BookmarksFullView";
import { BookmarksWidget } from "@features/bookmarks/view/BookmarksWidget";
import { CalendarFullView } from "@features/calendar/view/CalendarFullView";
import { CalendarWidget } from "@features/calendar/view/CalendarWidget";
import { ClipboardHistoryProvider } from "@features/clipboard-history/view/ClipboardHistoryContext";
import { ClipboardHistoryFullView } from "@features/clipboard-history/view/ClipboardHistoryFullView";
import { ClipboardHistoryWidget } from "@features/clipboard-history/view/ClipboardHistoryWidget";
import { ClockWidget } from "@features/clock/view/ClockWidget";
import { CountdownsProvider } from "@features/countdowns/view/CountdownsContext";
import { CountdownsFullView } from "@features/countdowns/view/CountdownsFullView";
import { CountdownsWidget } from "@features/countdowns/view/CountdownsWidget";
import { DailyJournalProvider } from "@features/daily-journal/view/DailyJournalContext";
import { DailyJournalFullView } from "@features/daily-journal/view/DailyJournalFullView";
import { DailyJournalWidget } from "@features/daily-journal/view/DailyJournalWidget";
import { HabitsProvider } from "@features/habits/view/HabitsContext";
import { HabitsFullView } from "@features/habits/view/HabitsFullView";
import { HabitsWidget } from "@features/habits/view/HabitsWidget";
import { PomodoroFullView } from "@features/pomodoro/view/PomodoroFullView";
import { PomodoroWidget } from "@features/pomodoro/view/PomodoroWidget";
import { RssReaderProvider } from "@features/rss-reader/view/RssReaderContext";
import { RssReaderFullView } from "@features/rss-reader/view/RssReaderFullView";
import { RssReaderWidget } from "@features/rss-reader/view/RssReaderWidget";
import { SnippetsProvider } from "@features/snippets/view/SnippetsContext";
import { SnippetsFullView } from "@features/snippets/view/SnippetsFullView";
import { SnippetsWidget } from "@features/snippets/view/SnippetsWidget";
import { TodoFullView } from "@features/todo/view/TodoFullView";
import { TodoWidget } from "@features/todo/view/TodoWidget";
import { WeatherWidget } from "@features/weather/view/WeatherWidget";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppOptions } from "./AppOptions";
import { CommandPalette } from "./CommandPalette";
import { commandRegistry } from "./command-registry";
import { DashboardGrid } from "./DashboardGrid";
import { rpc } from "./electrobun";
import { FeatureCatalog } from "./FeatureCatalog";
import { FocusModeView } from "./FocusModeView";
import { buildFocusCommands, buildNavigationCommands, FEATURE_VIEWS } from "./feature-views";
import { registerHotkey } from "./hotkeys";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { useAppOptions } from "./useAppOptions";
import { useNotifications } from "./useNotifications";
import { useRegisterCommand } from "./useRegisterCommand";
import { useTheme } from "./useTheme";
import { WidgetWindow } from "./WidgetWindow";

const LAYOUT_VERSION = 8;

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
      { i: "journal-1", x: 0, y: 4, w: 2, h: 2, featureId: "daily-journal", widgetId: "summary" },
      { i: "calendar-1", x: 2, y: 4, w: 2, h: 2, featureId: "calendar", widgetId: "upcoming-events" },
      { i: "habits-1", x: 0, y: 6, w: 2, h: 1, featureId: "habits", widgetId: "daily-checkin" },
      { i: "bookmarks-1", x: 2, y: 6, w: 2, h: 1, featureId: "bookmarks", widgetId: "recent-list" },
      { i: "countdowns-1", x: 0, y: 7, w: 2, h: 1, featureId: "countdowns", widgetId: "upcoming" },
      { i: "clipboard-1", x: 2, y: 7, w: 2, h: 1, featureId: "clipboard-history", widgetId: "recent-clips" },
      { i: "snippets-1", x: 0, y: 8, w: 2, h: 1, featureId: "snippets", widgetId: "favorites" },
    ],
    order: 0,
  },
];

function App() {
  const [pages, setPages] = useState<DashboardPage[]>(DEFAULT_PAGES);
  const [fullViewFeature, setFullViewFeature] = useState<string | null>(null);
  const [focusModeFeatureId, setFocusModeFeatureId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [appOptionsOpen, setAppOptionsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const currentPage = pages[0] as DashboardPage;
  const { mode: themeMode, accentColor, setMode: setThemeMode, setAccentColor } = useTheme();
  const { notifications, unreadCount, markRead, clearAll } = useNotifications();
  useAppOptions();

  // Refs to avoid stale closures in hotkey handler
  const focusModeFeatureIdRef = useRef(focusModeFeatureId);
  focusModeFeatureIdRef.current = focusModeFeatureId;
  const fullViewFeatureRef = useRef(fullViewFeature);
  fullViewFeatureRef.current = fullViewFeature;

  // Save window bounds silently on unload so they can be restored on next open
  useEffect(() => {
    function saveWindowBounds() {
      void rpc.request["app:save-window-bounds"]({
        width: window.outerWidth,
        height: window.outerHeight,
        x: window.screenX,
        y: window.screenY,
      });
    }
    window.addEventListener("resize", saveWindowBounds);
    window.addEventListener("beforeunload", saveWindowBounds);
    return () => {
      window.removeEventListener("resize", saveWindowBounds);
      window.removeEventListener("beforeunload", saveWindowBounds);
    };
  }, []);

  useEffect(() => {
    void rpc.request["dashboard:get-layout"]({}).then((stored) => {
      if (stored.version === LAYOUT_VERSION && stored.pages.length > 0) {
        setPages(stored.pages);
      }
    });
    void rpc.request["focus:get-last"]({}).then(({ lastFocusedFeatureId }) => {
      if (lastFocusedFeatureId) {
        // Store for the hotkey to recall — don't auto-enter focus mode
        focusModeFeatureIdRef.current = lastFocusedFeatureId;
      }
    });
  }, []);

  const enterFocusMode = useCallback((featureId: string) => {
    setFocusModeFeatureId(featureId);
    setFullViewFeature(null);
    void rpc.request["focus:set-last"]({ featureId });
  }, []);

  const exitFocusMode = useCallback(() => {
    setFocusModeFeatureId(null);
  }, []);

  // Register global Cmd+K hotkey
  useEffect(() => {
    return registerHotkey("cmd+k", () => setPaletteOpen(true));
  }, []);

  // Cmd+Shift+F: enter focus mode for the open modal, or exit if already in focus mode
  useEffect(() => {
    return registerHotkey("cmd+shift+f", () => {
      if (focusModeFeatureIdRef.current) {
        setFocusModeFeatureId(null);
      } else if (fullViewFeatureRef.current) {
        enterFocusMode(fullViewFeatureRef.current);
      }
    });
  }, [enterFocusMode]);

  // Register app-level commands
  useRegisterCommand({
    id: "app:open-options",
    label: "Open App Options",
    description: "Appearance, data directory, and about",
    group: "App",
    keywords: ["settings", "options", "preferences", "appearance", "background", "theme"],
    action: () => setAppOptionsOpen(true),
  });

  // Navigation and focus-mode commands are generated from the feature view descriptors
  useEffect(() => {
    return commandRegistry.registerMany(buildNavigationCommands(FEATURE_VIEWS, setFullViewFeature));
  }, []);

  useEffect(() => {
    return commandRegistry.registerMany(buildFocusCommands(FEATURE_VIEWS, enterFocusMode));
  }, [enterFocusMode]);

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

  const removeWidget = useCallback(
    (id: string): void => {
      setPages((prev) => {
        const updated = prev.map((p) =>
          p.id === currentPage.id ? { ...p, layout: p.layout.filter((l) => l.i !== id) } : p,
        );
        void rpc.request["dashboard:save-layout"]({ version: LAYOUT_VERSION, pages: updated });
        return updated;
      });
    },
    [currentPage.id],
  );

  const addWidget = useCallback(
    (featureId: string, widgetId: string, w: number, h: number): void => {
      const newItem: LayoutItem = {
        i: `${featureId}-${Date.now().toString(36)}`,
        x: 0,
        y: Number.POSITIVE_INFINITY,
        w,
        h,
        featureId,
        widgetId,
      };
      setPages((prev) => {
        const updated = prev.map((p) => (p.id === currentPage.id ? { ...p, layout: [...p.layout, newItem] } : p));
        void rpc.request["dashboard:save-layout"]({ version: LAYOUT_VERSION, pages: updated });
        return updated;
      });
    },
    [currentPage.id],
  );

  function getWidgetContent(item: LayoutItem, onOpenFullView: () => void) {
    if (item.featureId === "todo" && item.widgetId === "task-list") {
      return <TodoWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "pomodoro" && item.widgetId === "timer") {
      return <PomodoroWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "rss-reader" && item.widgetId === "feed-list") {
      return <RssReaderWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "clock" && item.widgetId === "display") {
      return <ClockWidget />;
    }
    if (item.featureId === "weather" && item.widgetId === "conditions") {
      return <WeatherWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "daily-journal" && item.widgetId === "summary") {
      return <DailyJournalWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "calendar" && item.widgetId === "upcoming-events") {
      return <CalendarWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "habits" && item.widgetId === "daily-checkin") {
      return <HabitsWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "bookmarks" && item.widgetId === "recent-list") {
      return <BookmarksWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "countdowns" && item.widgetId === "upcoming") {
      return <CountdownsWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "clipboard-history" && item.widgetId === "recent-clips") {
      return <ClipboardHistoryWidget onOpenFullView={onOpenFullView} />;
    }
    if (item.featureId === "snippets" && item.widgetId === "favorites") {
      return <SnippetsWidget onOpenFullView={onOpenFullView} />;
    }
    return (
      <span className="text-xs text-zinc-500">
        {item.featureId}/{item.widgetId}
      </span>
    );
  }

  function renderWidget(item: LayoutItem) {
    const onOpenFullView = () => setFullViewFeature(item.featureId);
    return (
      <WidgetWindow featureId={item.featureId} onExpand={onOpenFullView} onClose={() => removeWidget(item.i)}>
        {getWidgetContent(item, onOpenFullView)}
      </WidgetWindow>
    );
  }

  return (
    <SnippetsProvider>
      <ClipboardHistoryProvider>
        <CountdownsProvider>
          <BookmarksProvider>
            <RssReaderProvider>
              <HabitsProvider>
                <DailyJournalProvider>
                  {FEATURE_VIEWS.map(
                    ({ featureId, CommandRegistrar }) => CommandRegistrar && <CommandRegistrar key={featureId} />,
                  )}
                  <div
                    className="flex flex-col h-screen text-zinc-100 os-desktop"
                    style={{ background: "var(--user-bg, var(--bg-app))" }}
                  >
                    <header
                      className="shrink-0 bg-zinc-900/80 px-5 py-3 backdrop-blur flex items-center justify-between relative z-10"
                      style={{
                        boxShadow: "var(--shadow-header)",
                        borderBottom: "1px solid var(--border-color-subtle)",
                      }}
                    >
                      <h1
                        className="text-sm font-semibold tracking-tight select-none"
                        style={{ color: "var(--accent-color)", letterSpacing: "-0.02em" }}
                      >
                        MyOS
                      </h1>
                      <div className="flex items-center gap-1.5">
                        <ThemeToggle
                          mode={themeMode}
                          accentColor={accentColor}
                          onModeChange={(m) => void setThemeMode(m)}
                          onAccentChange={(c) => void setAccentColor(c)}
                        />
                        <NotificationCenter
                          notifications={notifications}
                          unreadCount={unreadCount}
                          onMarkRead={(id) => void markRead(id)}
                          onClearAll={() => void clearAll()}
                        />
                        <button
                          type="button"
                          className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-md px-2.5 py-1 transition-colors"
                          onClick={() => setCatalogOpen(true)}
                          aria-label="Open feature catalog"
                          title="Add features"
                        >
                          ⊞
                        </button>
                        <button
                          type="button"
                          className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-md px-2.5 py-1 transition-colors font-mono"
                          onClick={() => setPaletteOpen(true)}
                          aria-label="Open command palette"
                        >
                          ⌘K
                        </button>
                        <button
                          type="button"
                          className="text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-md px-2 py-1 transition-colors text-sm leading-none"
                          onClick={() => setAppOptionsOpen(true)}
                          aria-label="Open app options"
                        >
                          ⚙
                        </button>
                      </div>
                    </header>
                    <main className="flex-1 overflow-auto p-5">
                      <DashboardGrid
                        page={currentPage}
                        onLayoutChange={handleLayoutChange}
                        renderWidget={renderWidget}
                        onOpenCatalog={() => setCatalogOpen(true)}
                      />
                    </main>

                    <CommandPalette
                      open={paletteOpen}
                      onClose={() => setPaletteOpen(false)}
                      commands={commandRegistry.getAll()}
                      onSearch={(query) => rpc.request["search:global"]({ query })}
                      onNavigateToFeature={(featureId) => {
                        setFullViewFeature(featureId);
                      }}
                    />

                    {fullViewFeature === "todo" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-2/3 rounded-xl overflow-hidden shadow-2xl">
                          <TodoFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "pomodoro" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-2/3 rounded-xl overflow-hidden shadow-2xl">
                          <PomodoroFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "rss-reader" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <RssReaderFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "daily-journal" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <DailyJournalFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "calendar" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <CalendarFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "habits" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <HabitsFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {fullViewFeature === "bookmarks" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <BookmarksFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {fullViewFeature === "countdowns" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <CountdownsFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {fullViewFeature === "clipboard-history" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <ClipboardHistoryFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {fullViewFeature === "snippets" && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <SnippetsFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {catalogOpen && (
                      <FeatureCatalog
                        currentLayout={currentPage.layout}
                        onAdd={addWidget}
                        onClose={() => setCatalogOpen(false)}
                      />
                    )}

                    {focusModeFeatureId && <FocusModeView featureId={focusModeFeatureId} onExit={exitFocusMode} />}

                    {appOptionsOpen && <AppOptions onClose={() => setAppOptionsOpen(false)} />}
                  </div>
                </DailyJournalProvider>
              </HabitsProvider>
            </RssReaderProvider>
          </BookmarksProvider>
        </CountdownsProvider>
      </ClipboardHistoryProvider>
    </SnippetsProvider>
  );
}

export default App;
