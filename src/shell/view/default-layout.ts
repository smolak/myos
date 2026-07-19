import type { DashboardPage } from "@core/types";

export const DEFAULT_PAGES: DashboardPage[] = [
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
