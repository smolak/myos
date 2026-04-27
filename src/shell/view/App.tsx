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
import { SnippetsProvider, useSnippetsContext } from "@features/snippets/view/SnippetsContext";
import { SnippetsFullView } from "@features/snippets/view/SnippetsFullView";
import { SnippetsWidget } from "@features/snippets/view/SnippetsWidget";
import { TodoFullView } from "@features/todo/view/TodoFullView";
import { TodoWidget } from "@features/todo/view/TodoWidget";
import { WeatherWidget } from "@features/weather/view/WeatherWidget";
import { useCallback, useEffect, useRef, useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { commandRegistry } from "./command-registry";
import { DashboardGrid } from "./DashboardGrid";
import { rpc } from "./electrobun";
import { FocusModeView } from "./FocusModeView";
import { registerHotkey } from "./hotkeys";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { useNotifications } from "./useNotifications";
import { useTheme } from "./useTheme";

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

function SnippetsCommandRegistrar({ onOpenFullView }: { onOpenFullView: () => void }) {
  const { snippets, expand } = useSnippetsContext();

  useEffect(() => {
    if (snippets.length === 0) return;
    return commandRegistry.registerMany(
      snippets.map((s) => ({
        id: `snippets:expand:${s.id}`,
        label: `Expand Snippet: ${s.name}`,
        description: s.template.length > 60 ? `${s.template.slice(0, 60)}…` : s.template,
        group: "Snippets",
        keywords: ["snippet", "template", "expand", "copy"],
        action: () => {
          void expand(s.id).then((text) => navigator.clipboard.writeText(text));
        },
      })),
    );
  }, [snippets, expand]);

  useEffect(() => {
    return commandRegistry.register({
      id: "nav:snippets",
      label: "Open Snippets",
      description: "View and manage text snippets",
      group: "Navigation",
      keywords: ["snippet", "template", "text", "expand"],
      action: onOpenFullView,
    });
  }, [onOpenFullView]);

  return null;
}

function App() {
  const [pages, setPages] = useState<DashboardPage[]>(DEFAULT_PAGES);
  const [fullViewFeature, setFullViewFeature] = useState<string | null>(null);
  const [focusModeFeatureId, setFocusModeFeatureId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const currentPage = pages[0] as DashboardPage;
  const { mode: themeMode, accentColor, setMode: setThemeMode, setAccentColor } = useTheme();
  const { notifications, unreadCount, markRead, clearAll } = useNotifications();

  // Refs to avoid stale closures in hotkey handler
  const focusModeFeatureIdRef = useRef(focusModeFeatureId);
  focusModeFeatureIdRef.current = focusModeFeatureId;
  const fullViewFeatureRef = useRef(fullViewFeature);
  fullViewFeatureRef.current = fullViewFeature;

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

  // Register built-in navigation commands
  useEffect(() => {
    return commandRegistry.registerMany([
      {
        id: "nav:todo",
        label: "Open Todo",
        description: "View and manage todos",
        group: "Navigation",
        keywords: ["task", "tasks"],
        action: () => setFullViewFeature("todo"),
      },
      {
        id: "nav:pomodoro",
        label: "Open Pomodoro",
        description: "Focus timer",
        group: "Navigation",
        keywords: ["timer", "focus", "session"],
        action: () => setFullViewFeature("pomodoro"),
      },
      {
        id: "nav:rss",
        label: "Open RSS Reader",
        description: "Browse feed entries",
        group: "Navigation",
        keywords: ["feed", "articles", "news"],
        action: () => setFullViewFeature("rss-reader"),
      },
      {
        id: "nav:weather",
        label: "Open Weather",
        description: "Current conditions",
        group: "Navigation",
        keywords: ["forecast", "temperature"],
        action: () => setFullViewFeature("weather"),
      },
      {
        id: "nav:journal",
        label: "Open Daily Journal",
        description: "View today's activity and write notes",
        group: "Navigation",
        keywords: ["journal", "diary", "notes", "timeline"],
        action: () => setFullViewFeature("daily-journal"),
      },
      {
        id: "nav:calendar",
        label: "Open Calendar",
        description: "View upcoming events and manage calendars",
        group: "Navigation",
        keywords: ["calendar", "events", "schedule", "ics"],
        action: () => setFullViewFeature("calendar"),
      },
      {
        id: "nav:habits",
        label: "Open Habits",
        description: "View and manage daily habits",
        group: "Navigation",
        keywords: ["habits", "streak", "daily", "routine"],
        action: () => setFullViewFeature("habits"),
      },
      {
        id: "nav:bookmarks",
        label: "Open Bookmarks",
        description: "View and manage bookmarks",
        group: "Navigation",
        keywords: ["bookmark", "link", "url", "save"],
        action: () => setFullViewFeature("bookmarks"),
      },
      {
        id: "nav:countdowns",
        label: "Open Countdowns",
        description: "View and manage countdown timers",
        group: "Navigation",
        keywords: ["countdown", "timer", "date", "event"],
        action: () => setFullViewFeature("countdowns"),
      },
      {
        id: "nav:clipboard-history",
        label: "Open Clipboard History",
        description: "Browse and search clipboard history",
        group: "Navigation",
        keywords: ["clipboard", "copy", "paste", "history"],
        action: () => setFullViewFeature("clipboard-history"),
      },
    ]);
  }, []);

  // Register focus mode commands
  useEffect(() => {
    return commandRegistry.registerMany([
      {
        id: "focus:todo",
        label: "Focus Mode: Todo",
        description: "Open Todo in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "task", "tasks", "fullscreen"],
        action: () => enterFocusMode("todo"),
      },
      {
        id: "focus:pomodoro",
        label: "Focus Mode: Pomodoro",
        description: "Open Pomodoro timer in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "timer", "session", "fullscreen"],
        action: () => enterFocusMode("pomodoro"),
      },
      {
        id: "focus:rss-reader",
        label: "Focus Mode: RSS Reader",
        description: "Open RSS Reader in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "feed", "articles", "news", "fullscreen"],
        action: () => enterFocusMode("rss-reader"),
      },
      {
        id: "focus:daily-journal",
        label: "Focus Mode: Daily Journal",
        description: "Open Daily Journal in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "journal", "diary", "notes", "fullscreen"],
        action: () => enterFocusMode("daily-journal"),
      },
      {
        id: "focus:calendar",
        label: "Focus Mode: Calendar",
        description: "Open Calendar in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "calendar", "events", "schedule", "fullscreen"],
        action: () => enterFocusMode("calendar"),
      },
      {
        id: "focus:habits",
        label: "Focus Mode: Habits",
        description: "Open Habits in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "habits", "streak", "routine", "fullscreen"],
        action: () => enterFocusMode("habits"),
      },
      {
        id: "focus:bookmarks",
        label: "Focus Mode: Bookmarks",
        description: "Open Bookmarks in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "bookmark", "link", "fullscreen"],
        action: () => enterFocusMode("bookmarks"),
      },
      {
        id: "focus:countdowns",
        label: "Focus Mode: Countdowns",
        description: "Open Countdowns in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "countdown", "timer", "date", "fullscreen"],
        action: () => enterFocusMode("countdowns"),
      },
      {
        id: "focus:clipboard-history",
        label: "Focus Mode: Clipboard History",
        description: "Open Clipboard History in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "clipboard", "copy", "paste", "fullscreen"],
        action: () => enterFocusMode("clipboard-history"),
      },
      {
        id: "focus:snippets",
        label: "Focus Mode: Snippets",
        description: "Open Snippets in full-screen focus mode",
        group: "Focus Mode",
        keywords: ["focus", "snippet", "template", "expand", "fullscreen"],
        action: () => enterFocusMode("snippets"),
      },
    ]);
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
    if (item.featureId === "daily-journal" && item.widgetId === "summary") {
      return <DailyJournalWidget onOpenFullView={() => setFullViewFeature("daily-journal")} />;
    }
    if (item.featureId === "calendar" && item.widgetId === "upcoming-events") {
      return <CalendarWidget onOpenFullView={() => setFullViewFeature("calendar")} />;
    }
    if (item.featureId === "habits" && item.widgetId === "daily-checkin") {
      return <HabitsWidget onOpenFullView={() => setFullViewFeature("habits")} />;
    }
    if (item.featureId === "bookmarks" && item.widgetId === "recent-list") {
      return <BookmarksWidget onOpenFullView={() => setFullViewFeature("bookmarks")} />;
    }
    if (item.featureId === "countdowns" && item.widgetId === "upcoming") {
      return <CountdownsWidget onOpenFullView={() => setFullViewFeature("countdowns")} />;
    }
    if (item.featureId === "clipboard-history" && item.widgetId === "recent-clips") {
      return <ClipboardHistoryWidget onOpenFullView={() => setFullViewFeature("clipboard-history")} />;
    }
    if (item.featureId === "snippets" && item.widgetId === "favorites") {
      return <SnippetsWidget onOpenFullView={() => setFullViewFeature("snippets")} />;
    }
    return (
      <span className="text-xs text-zinc-500">
        {item.featureId}/{item.widgetId}
      </span>
    );
  }

  return (
    <SnippetsProvider>
      <SnippetsCommandRegistrar onOpenFullView={() => setFullViewFeature("snippets")} />
      <ClipboardHistoryProvider>
        <CountdownsProvider>
          <BookmarksProvider>
            <RssReaderProvider>
              <HabitsProvider>
                <DailyJournalProvider>
                  <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
                    <header className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-6 py-4 backdrop-blur flex items-center justify-between relative z-10">
                      <h1 className="text-lg font-semibold tracking-tight" style={{ color: "var(--accent-color)" }}>
                        MyOS
                      </h1>
                      <div className="flex items-center gap-2">
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
                          className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded px-2 py-1 transition-colors"
                          onClick={() => setPaletteOpen(true)}
                          aria-label="Open command palette"
                        >
                          ⌘K
                        </button>
                      </div>
                    </header>
                    <main className="flex-1 overflow-auto p-4">
                      <DashboardGrid
                        page={currentPage}
                        onLayoutChange={handleLayoutChange}
                        renderWidget={renderWidget}
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
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-2/3 rounded-xl overflow-hidden shadow-2xl">
                          <TodoFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "pomodoro" && (
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-2/3 rounded-xl overflow-hidden shadow-2xl">
                          <PomodoroFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "rss-reader" && (
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <RssReaderFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "daily-journal" && (
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <DailyJournalFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "calendar" && (
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <CalendarFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}
                    {fullViewFeature === "habits" && (
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <HabitsFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {fullViewFeature === "bookmarks" && (
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <BookmarksFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {fullViewFeature === "countdowns" && (
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <CountdownsFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {fullViewFeature === "clipboard-history" && (
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-2xl h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <ClipboardHistoryFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {fullViewFeature === "snippets" && (
                      <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
                        <div className="w-full max-w-lg h-3/4 rounded-xl overflow-hidden shadow-2xl">
                          <SnippetsFullView onClose={() => setFullViewFeature(null)} />
                        </div>
                      </div>
                    )}

                    {focusModeFeatureId && <FocusModeView featureId={focusModeFeatureId} onExit={exitFocusMode} />}
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
