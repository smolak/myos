import type { FeatureDefinition } from "@core/types";
import type { WeatherActions, WeatherEvents, WeatherQueries } from "../shared/types";
import { fetchWeather } from "./actions";
import { weatherMigrations } from "./migrations";
import { getCurrentWeather } from "./queries";

const FETCH_INTERVAL_MS = 30 * 60 * 1000;

export const weatherFeature: FeatureDefinition<WeatherEvents, WeatherActions, WeatherQueries> = {
  id: "weather",
  name: "Weather",
  version: "1.0.0",
  migrations: weatherMigrations,

  manifest: {
    events: {
      "weather:updated": {
        description: "Weather data was refreshed",
        payload: { location: "string", tempCelsius: "number", condition: "string" },
      },
    },
    actions: {
      fetch: {
        description: "Fetch current weather from OpenWeatherMap",
        params: {},
        result: { success: "boolean" },
      },
    },
    queries: {
      "get-current": {
        description: "Get the most recently fetched weather data",
        params: {},
        result: "WeatherData | null",
      },
    },
    permissions: [{ type: "network", reason: "Fetch weather data from OpenWeatherMap API" }],
    scheduledTasks: [
      {
        id: "weather:fetch",
        defaultSchedule: { type: "interval", value: FETCH_INTERVAL_MS },
        description: "Periodically refresh weather data",
      },
    ],
    widgets: [
      {
        id: "conditions",
        name: "Weather",
        sizes: ["small", "medium"],
        description: "Shows current temperature and weather conditions",
      },
    ],
    commands: [],
  },

  async install(_ctx) {},

  async activate(ctx) {
    ctx.actions.handle("fetch", async (_params, _meta) => {
      const apiKey = await ctx.credentials.retrieve("openweathermap", "api-key");
      const location = ctx.settings.get<string>("location", "");

      if (!apiKey || !location) {
        return { success: false };
      }

      try {
        const data = await fetchWeather(ctx.db, apiKey, location);
        ctx.events.emit("weather:updated", {
          location: data.location,
          tempCelsius: data.tempCelsius,
          condition: data.condition.main,
        });
        return { success: true };
      } catch (err) {
        ctx.log.error("Failed to fetch weather:", err);
        return { success: false };
      }
    });

    ctx.queries.handle("get-current", async (_params) => {
      return getCurrentWeather(ctx.db);
    });

    ctx.scheduler.register("weather:fetch", { type: "interval", value: FETCH_INTERVAL_MS }, async () => {
      const apiKey = await ctx.credentials.retrieve("openweathermap", "api-key");
      const location = ctx.settings.get<string>("location", "");
      if (!apiKey || !location) return;
      try {
        const data = await fetchWeather(ctx.db, apiKey, location);
        ctx.events.emit("weather:updated", {
          location: data.location,
          tempCelsius: data.tempCelsius,
          condition: data.condition.main,
        });
        ctx.log.info(`Weather updated: ${data.location} ${data.tempCelsius.toFixed(1)}°C`);
      } catch (err) {
        ctx.log.error("Scheduled weather fetch failed:", err);
      }
    });
  },

  async deactivate() {},
  async uninstall(_ctx) {},
};
