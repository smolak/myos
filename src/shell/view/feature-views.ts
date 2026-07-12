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
import { RssReaderCommandRegistrar } from "@features/rss-reader/view/RssReaderCommandRegistrar";
import { RssReaderProvider } from "@features/rss-reader/view/RssReaderContext";
import { RssReaderFullView } from "@features/rss-reader/view/RssReaderFullView";
import { RssReaderWidget } from "@features/rss-reader/view/RssReaderWidget";
import { SnippetsCommandRegistrar } from "@features/snippets/view/SnippetsCommandRegistrar";
import { SnippetsProvider } from "@features/snippets/view/SnippetsContext";
import { SnippetsFullView } from "@features/snippets/view/SnippetsFullView";
import { SnippetsWidget } from "@features/snippets/view/SnippetsWidget";
import { TodoFullView } from "@features/todo/view/TodoFullView";
import { TodoWidget } from "@features/todo/view/TodoWidget";
import { WeatherWidget } from "@features/weather/view/WeatherWidget";
import type { ComponentType, ReactNode } from "react";
import type { Command } from "./command-registry";

export type ModalSize = "compact" | "wide" | "tall";

// Named size → the shell's modal class combination. Descriptors only name the
// size so raw styling never leaks into feature registration.
export const MODAL_SIZE_CLASSES: Readonly<Record<ModalSize, string>> = {
  compact: "max-w-lg h-2/3",
  wide: "max-w-2xl h-3/4",
  tall: "max-w-lg h-3/4",
};

export interface WidgetDescriptor {
  readonly Widget: ComponentType<{ onOpenFullView?: () => void }>;
  readonly defaultW: number;
  readonly defaultH: number;
}

interface FeatureViewDescriptorBase {
  readonly featureId: string;
  readonly displayName: string;
  readonly icon: string;
  readonly description: string;
  readonly widgets?: Readonly<Record<string, WidgetDescriptor>>;
  readonly navKeywords?: readonly string[];
  readonly Provider?: ComponentType<{ children: ReactNode }>;
  readonly CommandRegistrar?: ComponentType;
}

interface FullViewCapability {
  readonly FullView: ComponentType<{ onClose: () => void }>;
  readonly modalSize: ModalSize;
  readonly supportsFocusMode: boolean;
}

interface NoFullView {
  readonly FullView?: never;
  readonly modalSize?: never;
  readonly supportsFocusMode?: never;
}

// One entry per feature — the single view-side registration point. The shell
// derives widgets, full-view modals, focus mode, the catalog, providers, and
// palette commands from this list; it never enumerates feature IDs itself.
// A modal size or focus-mode flag without a FullView is a type error.
export type FeatureViewDescriptor = FeatureViewDescriptorBase & (FullViewCapability | NoFullView);

export const FEATURE_VIEWS: readonly FeatureViewDescriptor[] = [
  {
    featureId: "todo",
    displayName: "Todo",
    icon: "✓",
    description: "Tasks and to-do lists",
    widgets: { "task-list": { Widget: TodoWidget, defaultW: 2, defaultH: 2 } },
    FullView: TodoFullView,
    modalSize: "compact",
    supportsFocusMode: true,
    navKeywords: ["task", "tasks"],
  },
  {
    featureId: "pomodoro",
    displayName: "Pomodoro",
    icon: "⏱",
    description: "Focus timer sessions",
    widgets: { timer: { Widget: PomodoroWidget, defaultW: 2, defaultH: 1 } },
    FullView: PomodoroFullView,
    modalSize: "compact",
    supportsFocusMode: true,
    navKeywords: ["timer", "focus", "session"],
  },
  {
    featureId: "rss-reader",
    displayName: "RSS Reader",
    icon: "📡",
    description: "News feeds and articles",
    widgets: { "feed-list": { Widget: RssReaderWidget, defaultW: 4, defaultH: 2 } },
    FullView: RssReaderFullView,
    modalSize: "wide",
    supportsFocusMode: true,
    navKeywords: ["feed", "articles", "news"],
    Provider: RssReaderProvider,
    CommandRegistrar: RssReaderCommandRegistrar,
  },
  {
    featureId: "clock",
    displayName: "Clock",
    icon: "🕐",
    description: "Current time display",
    widgets: { display: { Widget: ClockWidget, defaultW: 1, defaultH: 1 } },
  },
  {
    featureId: "weather",
    displayName: "Weather",
    icon: "⛅",
    description: "Temperature and conditions",
    widgets: { conditions: { Widget: WeatherWidget, defaultW: 1, defaultH: 1 } },
  },
  {
    featureId: "daily-journal",
    displayName: "Daily Journal",
    icon: "📓",
    description: "Activity log and notes",
    widgets: { summary: { Widget: DailyJournalWidget, defaultW: 2, defaultH: 2 } },
    FullView: DailyJournalFullView,
    modalSize: "wide",
    supportsFocusMode: true,
    navKeywords: ["journal", "diary", "notes", "timeline"],
    Provider: DailyJournalProvider,
  },
  {
    featureId: "calendar",
    displayName: "Calendar",
    icon: "📅",
    description: "Events and schedule",
    widgets: { "upcoming-events": { Widget: CalendarWidget, defaultW: 2, defaultH: 2 } },
    FullView: CalendarFullView,
    modalSize: "wide",
    supportsFocusMode: true,
    navKeywords: ["calendar", "events", "schedule", "ics"],
  },
  {
    featureId: "habits",
    displayName: "Habits",
    icon: "🎯",
    description: "Daily habit tracking",
    widgets: { "daily-checkin": { Widget: HabitsWidget, defaultW: 2, defaultH: 1 } },
    FullView: HabitsFullView,
    modalSize: "tall",
    supportsFocusMode: true,
    navKeywords: ["habits", "streak", "daily", "routine"],
    Provider: HabitsProvider,
  },
  {
    featureId: "bookmarks",
    displayName: "Bookmarks",
    icon: "🔖",
    description: "Saved links and URLs",
    widgets: { "recent-list": { Widget: BookmarksWidget, defaultW: 2, defaultH: 1 } },
    FullView: BookmarksFullView,
    modalSize: "wide",
    supportsFocusMode: true,
    navKeywords: ["bookmark", "link", "url", "save"],
    Provider: BookmarksProvider,
  },
  {
    featureId: "countdowns",
    displayName: "Countdowns",
    icon: "⏳",
    description: "Timers to important dates",
    widgets: { upcoming: { Widget: CountdownsWidget, defaultW: 2, defaultH: 1 } },
    FullView: CountdownsFullView,
    modalSize: "tall",
    supportsFocusMode: true,
    navKeywords: ["countdown", "timer", "date", "event"],
    Provider: CountdownsProvider,
  },
  {
    featureId: "clipboard-history",
    displayName: "Clipboard History",
    icon: "📋",
    description: "Recent clipboard entries",
    widgets: { "recent-clips": { Widget: ClipboardHistoryWidget, defaultW: 2, defaultH: 1 } },
    FullView: ClipboardHistoryFullView,
    modalSize: "wide",
    supportsFocusMode: true,
    navKeywords: ["clipboard", "copy", "paste", "history"],
    Provider: ClipboardHistoryProvider,
  },
  {
    featureId: "snippets",
    displayName: "Snippets",
    icon: "✂️",
    description: "Reusable text templates",
    widgets: { favorites: { Widget: SnippetsWidget, defaultW: 2, defaultH: 1 } },
    FullView: SnippetsFullView,
    modalSize: "tall",
    supportsFocusMode: true,
    navKeywords: ["snippet", "template", "text", "expand"],
    Provider: SnippetsProvider,
    CommandRegistrar: SnippetsCommandRegistrar,
  },
];

export function findFeatureView(
  descriptors: readonly FeatureViewDescriptor[],
  featureId: string,
): FeatureViewDescriptor | undefined {
  return descriptors.find((d) => d.featureId === featureId);
}

export function resolveWidget(
  descriptors: readonly FeatureViewDescriptor[],
  featureId: string,
  widgetId: string,
): WidgetDescriptor | undefined {
  return findFeatureView(descriptors, featureId)?.widgets?.[widgetId];
}

export interface CatalogEntry {
  readonly featureId: string;
  readonly displayName: string;
  readonly icon: string;
  readonly description: string;
  readonly widgetId: string;
  readonly defaultW: number;
  readonly defaultH: number;
}

// One catalog entry per feature with at least one widget; "add to desktop"
// uses the feature's first declared widget and its default grid size.
export function buildCatalogEntries(descriptors: readonly FeatureViewDescriptor[]): CatalogEntry[] {
  return descriptors.flatMap((d) => {
    const [first] = Object.entries(d.widgets ?? {});
    if (!first) {
      return [];
    }
    const [widgetId, { defaultW, defaultH }] = first;
    return [
      {
        featureId: d.featureId,
        displayName: d.displayName,
        icon: d.icon,
        description: d.description,
        widgetId,
        defaultW,
        defaultH,
      },
    ];
  });
}

export function buildNavigationCommands(
  descriptors: readonly FeatureViewDescriptor[],
  openFullView: (featureId: string) => void,
): Command[] {
  return descriptors
    .filter((d) => d.FullView)
    .map((d) => ({
      id: `nav:${d.featureId}`,
      label: `Open ${d.displayName}`,
      group: "Navigation",
      keywords: [...(d.navKeywords ?? [])],
      action: () => openFullView(d.featureId),
    }));
}

export function buildFocusCommands(
  descriptors: readonly FeatureViewDescriptor[],
  enterFocusMode: (featureId: string) => void,
): Command[] {
  return descriptors
    .filter((d) => d.supportsFocusMode)
    .map((d) => ({
      id: `focus:${d.featureId}`,
      label: `Focus Mode: ${d.displayName}`,
      description: `Open ${d.displayName} in full-screen focus mode`,
      group: "Focus Mode",
      keywords: ["focus", "fullscreen", ...(d.navKeywords ?? [])],
      action: () => enterFocusMode(d.featureId),
    }));
}
