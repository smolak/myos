// NOTE: imports in this file must use relative paths (../../core/..., ../../features/...).
// The electrobun bundler does not resolve tsconfig path aliases (@core/*, @features/*, @shell/*).

import { join } from "node:path";
import { BrowserView, BrowserWindow, type ElectrobunEvent, Tray, Updater, Utils } from "electrobun/bun";
import { ActionQueue } from "../../core/bun/action-queue";
import { CredentialStore } from "../../core/bun/credential-store";
import { DatabaseManager } from "../../core/bun/database-manager";
import { EventBus } from "../../core/bun/event-bus";
import { FeatureRegistry } from "../../core/bun/feature-registry";
import { Scheduler } from "../../core/bun/scheduler";
import { SettingsManager } from "../../core/bun/settings-manager";
import { clockFeature } from "../../features/clock/bun/index";
import { pomodoroFeature } from "../../features/pomodoro/bun/index";
import { rssReaderFeature } from "../../features/rss-reader/bun/index";
import { todoFeature } from "../../features/todo/bun/index";
import { weatherFeature } from "../../features/weather/bun/index";
import type { AppNotification } from "../shared/notification-types";
import type { AppRPCSchema, ThemeMode } from "../shared/rpc-schema";

const LAYOUT_SETTING_SCOPE = "dashboard";
const LAYOUT_SETTING_KEY = "layout";
const LAYOUT_VERSION = 4;

const POMODORO_SETTINGS_SCOPE = "pomodoro";
const DEFAULT_WORK_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

const THEME_SCOPE = "theme";
const DEFAULT_THEME_MODE: ThemeMode = "dark";
const DEFAULT_ACCENT_COLOR = "#6366f1";
const MAX_NOTIFICATIONS = 50;

const NOTIFICATIONS_SCOPE = "notifications";
const NOTIFICATIONS_KEY = "history";

// Bootstrap core services
const dataDir = process.env.MYOS_DATA_DIR?.trim() || join(Utils.paths.userData, "data");
const dbManager = new DatabaseManager(dataDir);
const coreDb = dbManager.getCoreDatabase();
const settingsManager = new SettingsManager(coreDb);
const credentialStore = new CredentialStore(coreDb);
const eventBus = new EventBus(coreDb);
const actionQueue = new ActionQueue(coreDb);
const scheduler = new Scheduler(coreDb);
const featureRegistry = new FeatureRegistry(
  dbManager,
  settingsManager,
  credentialStore,
  eventBus,
  actionQueue,
  scheduler,
);

// Feature startup runs async; RPC handlers await this before executing
const startupPromise = featureRegistry.startup([
  todoFeature,
  rssReaderFeature,
  pomodoroFeature,
  weatherFeature,
  clockFeature,
]);

async function ready(): Promise<void> {
  await startupPromise;
}

const rpc = BrowserView.defineRPC<AppRPCSchema>({
  handlers: {
    requests: {
      // Network passthrough
      "fetch-feed": async ({ url }) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch-feed failed: ${res.status} ${res.statusText}`);
        return res.text();
      },
      "fetch-json": async ({ url }) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch-json failed: ${res.status} ${res.statusText}`);
        return res.text();
      },

      // Todo
      "todo:create": async (params) => {
        await ready();
        return actionQueue.dispatchAction("todo", "create", params) as Promise<{ id: string }>;
      },
      "todo:update": async (params) => {
        await ready();
        return actionQueue.dispatchAction("todo", "update", params) as Promise<{ success: boolean }>;
      },
      "todo:complete": async (params) => {
        await ready();
        return actionQueue.dispatchAction("todo", "complete", params) as Promise<{ success: boolean }>;
      },
      "todo:delete": async (params) => {
        await ready();
        return actionQueue.dispatchAction("todo", "delete", params) as Promise<{ success: boolean }>;
      },
      "todo:find": async (params) => {
        await ready();
        // biome-ignore lint/suspicious/noExplicitAny: query return type is determined by the feature layer
        return actionQueue.executeQuery("todo", "find", params) as Promise<any>;
      },

      // RSS Reader
      "rss:add-feed": async (params) => {
        await ready();
        return actionQueue.dispatchAction("rss-reader", "add-feed", params) as Promise<{ id: string }>;
      },
      "rss:delete-feed": async (params) => {
        await ready();
        return actionQueue.dispatchAction("rss-reader", "delete-feed", params) as Promise<{ success: boolean }>;
      },
      "rss:mark-read": async (params) => {
        await ready();
        return actionQueue.dispatchAction("rss-reader", "mark-read", params) as Promise<{ success: boolean }>;
      },
      "rss:mark-unread": async (params) => {
        await ready();
        return actionQueue.dispatchAction("rss-reader", "mark-unread", params) as Promise<{ success: boolean }>;
      },
      "rss:fetch-feeds": async (_params) => {
        await ready();
        return actionQueue.dispatchAction("rss-reader", "fetch-feeds", {}) as Promise<{
          fetched: number;
          newEntries: number;
        }>;
      },
      "rss:get-feeds": async (_params) => {
        await ready();
        // biome-ignore lint/suspicious/noExplicitAny: query return type is determined by the feature layer
        return actionQueue.executeQuery("rss-reader", "get-feeds", {}) as Promise<any>;
      },
      "rss:get-entries": async (params) => {
        await ready();
        // biome-ignore lint/suspicious/noExplicitAny: query return type is determined by the feature layer
        return actionQueue.executeQuery("rss-reader", "get-entries", params) as Promise<any>;
      },

      // Pomodoro
      "pomodoro:start": async (params) => {
        await ready();
        return actionQueue.dispatchAction("pomodoro", "start", params) as Promise<{ id: string }>;
      },
      "pomodoro:pause": async (params) => {
        await ready();
        return actionQueue.dispatchAction("pomodoro", "pause", params) as Promise<{ success: boolean }>;
      },
      "pomodoro:resume": async (params) => {
        await ready();
        return actionQueue.dispatchAction("pomodoro", "resume", params) as Promise<{ success: boolean }>;
      },
      "pomodoro:complete": async (params) => {
        await ready();
        return actionQueue.dispatchAction("pomodoro", "complete", params) as Promise<{ success: boolean }>;
      },
      "pomodoro:cancel": async (params) => {
        await ready();
        return actionQueue.dispatchAction("pomodoro", "cancel", params) as Promise<{ success: boolean }>;
      },
      "pomodoro:get-current": async (_params) => {
        await ready();
        // biome-ignore lint/suspicious/noExplicitAny: query return type is determined by the feature layer
        return actionQueue.executeQuery("pomodoro", "get-current", {}) as Promise<any>;
      },
      "pomodoro:get-settings": async (_params) => {
        await ready();
        return {
          workDurationMinutes: settingsManager.get(
            POMODORO_SETTINGS_SCOPE,
            "workDurationMinutes",
            DEFAULT_WORK_MINUTES,
          ),
          breakDurationMinutes: settingsManager.get(
            POMODORO_SETTINGS_SCOPE,
            "breakDurationMinutes",
            DEFAULT_BREAK_MINUTES,
          ),
        };
      },
      "pomodoro:update-settings": async (params) => {
        await ready();
        if (params.workDurationMinutes !== undefined) {
          await settingsManager.set(POMODORO_SETTINGS_SCOPE, "workDurationMinutes", params.workDurationMinutes);
        }
        if (params.breakDurationMinutes !== undefined) {
          await settingsManager.set(POMODORO_SETTINGS_SCOPE, "breakDurationMinutes", params.breakDurationMinutes);
        }
        return { success: true };
      },

      // Weather
      "weather:fetch": async (_params) => {
        await ready();
        return actionQueue.dispatchAction("weather", "fetch", {}) as Promise<{ success: boolean }>;
      },
      "weather:get-current": async (_params) => {
        await ready();
        // biome-ignore lint/suspicious/noExplicitAny: query return type is determined by the feature layer
        return actionQueue.executeQuery("weather", "get-current", {}) as Promise<any>;
      },
      "weather:get-settings": async (_params) => {
        await ready();
        const weatherSettings = settingsManager.forScope("weather");
        const location = weatherSettings.get("location", "");
        const units = weatherSettings.get<"metric" | "imperial">("units", "metric");
        const apiKey = (await credentialStore.forScope("weather").retrieve("openweathermap", "api-key")) ?? "";
        return { apiKey, location, units };
      },
      "weather:update-settings": async (params) => {
        await ready();
        const weatherSettings = settingsManager.forScope("weather");
        const weatherCreds = credentialStore.forScope("weather");
        if (params.apiKey !== undefined) {
          await weatherCreds.store("openweathermap", "api-key", params.apiKey);
        }
        if (params.location !== undefined) {
          await weatherSettings.set("location", params.location);
        }
        if (params.units !== undefined) {
          await weatherSettings.set("units", params.units);
        }
        return { success: true };
      },

      // Clock
      "clock:get-format": async (_params) => {
        await ready();
        return { format: settingsManager.get<"12h" | "24h">("clock", "format", "24h") };
      },
      "clock:update-format": async (params) => {
        await ready();
        await settingsManager.set("clock", "format", params.format);
        return { success: true };
      },

      // Dashboard layout
      "dashboard:get-layout": async (_params) => {
        await ready();
        return settingsManager.get(LAYOUT_SETTING_SCOPE, LAYOUT_SETTING_KEY, {
          version: LAYOUT_VERSION,
          pages: [],
        });
      },
      "dashboard:save-layout": async (params) => {
        await ready();
        await settingsManager.set(LAYOUT_SETTING_SCOPE, LAYOUT_SETTING_KEY, params);
        return { success: true };
      },

      // Theme
      "theme:get": async (_params) => {
        return {
          mode: settingsManager.get<ThemeMode>(THEME_SCOPE, "mode", DEFAULT_THEME_MODE),
          accentColor: settingsManager.get<string>(THEME_SCOPE, "accentColor", DEFAULT_ACCENT_COLOR),
        };
      },
      "theme:update": async (params) => {
        if (params.mode !== undefined) {
          await settingsManager.set(THEME_SCOPE, "mode", params.mode);
        }
        if (params.accentColor !== undefined) {
          await settingsManager.set(THEME_SCOPE, "accentColor", params.accentColor);
        }
        return { success: true };
      },

      // Notifications
      "notification:get-history": async (_params) => {
        return settingsManager.get<AppNotification[]>(NOTIFICATIONS_SCOPE, NOTIFICATIONS_KEY, []);
      },
      "notification:mark-read": async ({ id }) => {
        const history = settingsManager.get<AppNotification[]>(NOTIFICATIONS_SCOPE, NOTIFICATIONS_KEY, []);
        const updated = history.map((n) => (n.id === id ? { ...n, read: true } : n));
        await settingsManager.set(NOTIFICATIONS_SCOPE, NOTIFICATIONS_KEY, updated);
        return { success: true };
      },
      "notification:clear": async (_params) => {
        await settingsManager.set(NOTIFICATIONS_SCOPE, NOTIFICATIONS_KEY, []);
        return { success: true };
      },
    },
  },
});

async function addNotification(notif: AppNotification) {
  const history = settingsManager.get<AppNotification[]>(NOTIFICATIONS_SCOPE, NOTIFICATIONS_KEY, []);
  const updated = [notif, ...history].slice(0, MAX_NOTIFICATIONS);
  await settingsManager.set(NOTIFICATIONS_SCOPE, NOTIFICATIONS_KEY, updated);
}

void startupPromise.then(() => {
  eventBus.subscribe("pomodoro:session-ended", async (payload) => {
    const p = payload as { type?: string };
    await addNotification({
      id: crypto.randomUUID(),
      title: "Pomodoro session ended",
      body: p.type === "work" ? "Time for a break!" : "Back to work!",
      featureId: "pomodoro",
      timestamp: Date.now(),
      read: false,
    });
  });

  eventBus.subscribe("todo:item-completed", async (payload) => {
    const p = payload as { title?: string };
    await addNotification({
      id: crypto.randomUUID(),
      title: "Todo completed",
      body: p.title,
      featureId: "todo",
      timestamp: Date.now(),
      read: false,
    });
  });
});

const APP_TITLE = "MyOS";
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getDashboardUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      return DEV_SERVER_URL;
    } catch {}
  }
  return "views://dashboard/index.html";
}

const WINDOW_FRAME = {
  width: 900,
  height: 700,
  x: 200,
  y: 200,
} as const;

let mainWindow: BrowserWindow | null = null;

function attachCloseHandler(win: BrowserWindow) {
  win.on("close", () => {
    mainWindow = null;
  });
}

function createMainWindow(url: string): BrowserWindow {
  const win = new BrowserWindow({
    title: APP_TITLE,
    url,
    frame: WINDOW_FRAME,
    rpc,
  });
  attachCloseHandler(win);
  mainWindow = win;
  return win;
}

async function showDashboard() {
  const url = await getDashboardUrl();
  if (mainWindow) {
    const existing = BrowserWindow.getById(mainWindow.id);
    if (existing) {
      if (existing.isMinimized()) {
        existing.unminimize();
      }
      existing.show();
      return;
    }
    mainWindow = null;
  }
  createMainWindow(url);
}

function hideDashboard() {
  if (!mainWindow) return;
  const win = BrowserWindow.getById(mainWindow.id);
  if (win) {
    win.close();
    mainWindow = null;
  }
}

const initialUrl = await getDashboardUrl();
createMainWindow(initialUrl);

const tray = new Tray({
  title: APP_TITLE,
  template: true,
});

tray.setMenu([
  { type: "normal", label: "Show", action: "show" },
  { type: "normal", label: "Hide", action: "hide" },
  { type: "divider" },
  { type: "normal", label: "Quit", action: "quit" },
]);

tray.on("tray-clicked", (raw) => {
  const event = raw as ElectrobunEvent<{ id: number; action: string; data?: unknown }, { allow: boolean }>;

  switch (event.data.action) {
    case "show":
      void showDashboard();
      break;
    case "hide":
      hideDashboard();
      break;
    case "quit":
      Utils.quit();
      break;
    default:
      break;
  }
});

void mainWindow;
