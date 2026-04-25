import type { DashboardPage } from "@core/types";
import type { TimeFormat } from "@features/clock/shared/types";
import type { JournalNote, TimelineEvent } from "@features/daily-journal/shared/types";
import type { PomodoroSession, SessionType } from "@features/pomodoro/shared/types";
import type { RssEntry, RssFeed } from "@features/rss-reader/shared/types";
import type { TodoItem } from "@features/todo/shared/types";
import type { WeatherData } from "@features/weather/shared/types";
import type { ElectrobunRPCSchema } from "electrobun/bun";
import type { AppNotification } from "./notification-types";

export type ThemeMode = "dark" | "light" | "system";

export interface AppRPCSchema extends ElectrobunRPCSchema {
  bun: {
    requests: {
      "fetch-feed": { params: { url: string }; response: string };
      "fetch-json": { params: { url: string }; response: string };

      // Todo
      "todo:create": { params: { title: string; description?: string }; response: { id: string } };
      "todo:update": { params: { id: string; title?: string; description?: string }; response: { success: boolean } };
      "todo:complete": { params: { id: string }; response: { success: boolean } };
      "todo:delete": { params: { id: string }; response: { success: boolean } };
      "todo:find": { params: { completed?: boolean; limit?: number }; response: TodoItem[] };

      // RSS Reader
      "rss:add-feed": { params: { url: string; title?: string }; response: { id: string } };
      "rss:delete-feed": { params: { id: string }; response: { success: boolean } };
      "rss:mark-read": { params: { id: string }; response: { success: boolean } };
      "rss:mark-unread": { params: { id: string }; response: { success: boolean } };
      "rss:fetch-feeds": { params: Record<string, never>; response: { fetched: number; newEntries: number } };
      "rss:get-feeds": { params: Record<string, never>; response: RssFeed[] };
      "rss:get-entries": { params: { feedId?: string; unreadOnly?: boolean; limit?: number }; response: RssEntry[] };

      // Pomodoro
      "pomodoro:start": { params: { type?: SessionType; durationSeconds?: number }; response: { id: string } };
      "pomodoro:pause": { params: { id: string; elapsedSeconds: number }; response: { success: boolean } };
      "pomodoro:resume": { params: { id: string }; response: { success: boolean } };
      "pomodoro:complete": { params: { id: string; elapsedSeconds?: number }; response: { success: boolean } };
      "pomodoro:cancel": { params: { id: string }; response: { success: boolean } };
      "pomodoro:get-current": { params: Record<string, never>; response: PomodoroSession | null };
      "pomodoro:get-settings": {
        params: Record<string, never>;
        response: { workDurationMinutes: number; breakDurationMinutes: number };
      };
      "pomodoro:update-settings": {
        params: { workDurationMinutes?: number; breakDurationMinutes?: number };
        response: { success: boolean };
      };

      // Weather
      "weather:fetch": { params: Record<string, never>; response: { success: boolean } };
      "weather:get-current": { params: Record<string, never>; response: WeatherData | null };
      "weather:get-settings": {
        params: Record<string, never>;
        response: { apiKey: string; location: string; units: "metric" | "imperial" };
      };
      "weather:update-settings": {
        params: { apiKey?: string; location?: string; units?: "metric" | "imperial" };
        response: { success: boolean };
      };

      // Clock
      "clock:get-format": { params: Record<string, never>; response: { format: TimeFormat } };
      "clock:update-format": { params: { format: TimeFormat }; response: { success: boolean } };

      // Dashboard
      "dashboard:get-layout": { params: Record<string, never>; response: { version: number; pages: DashboardPage[] } };
      "dashboard:save-layout": { params: { version: number; pages: DashboardPage[] }; response: { success: boolean } };

      // Theme
      "theme:get": { params: Record<string, never>; response: { mode: ThemeMode; accentColor: string } };
      "theme:update": { params: { mode?: ThemeMode; accentColor?: string }; response: { success: boolean } };

      // Daily Journal
      "journal:add-note": { params: { date: string; content: string }; response: { id: string } };
      "journal:update-note": { params: { id: string; content: string }; response: { success: boolean } };
      "journal:delete-note": { params: { id: string }; response: { success: boolean } };
      "journal:get-notes": { params: { limit?: number; search?: string }; response: JournalNote[] };
      "journal:get-note-by-date": { params: { date: string }; response: JournalNote | null };
      "journal:get-timeline": { params: { date: string }; response: TimelineEvent[] };

      // Notifications
      "notification:get-history": { params: Record<string, never>; response: AppNotification[] };
      "notification:mark-read": { params: { id: string }; response: { success: boolean } };
      "notification:clear": { params: Record<string, never>; response: { success: boolean } };
    };
    messages: Record<never, never>;
  };
  webview: {
    requests: Record<never, never>;
    messages: Record<never, never>;
  };
}
