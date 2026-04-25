import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapMigrationsTable, runMigrations } from "@core/bun/migration-runner";
import { fetchWeather, overrideFetch } from "./actions";
import { weatherMigrations } from "./migrations";

const MOCK_RESPONSE = JSON.stringify({
  name: "London",
  main: { temp: 15.2, feels_like: 13.8, humidity: 72 },
  weather: [{ id: 800, main: "Clear", description: "clear sky", icon: "01d" }],
});

describe("fetchWeather", () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-weather-"));
    db = new Database(join(tmpDir, "weather.db"));
    db.run("PRAGMA journal_mode=WAL");
    bootstrapMigrationsTable(db);
    runMigrations(db, "weather", weatherMigrations);
    overrideFetch(async () => MOCK_RESPONSE);
  });

  afterEach(async () => {
    db.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns parsed weather data", async () => {
    const data = await fetchWeather(db, "fake-key", "London");
    expect(data.location).toBe("London");
    expect(data.tempCelsius).toBe(15.2);
    expect(data.feelsLikeCelsius).toBe(13.8);
    expect(data.humidity).toBe(72);
    expect(data.condition.main).toBe("Clear");
    expect(data.condition.description).toBe("clear sky");
    expect(data.condition.icon).toBe("01d");
  });

  test("persists data to weather_cache table", async () => {
    await fetchWeather(db, "fake-key", "London");
    const row = db.query<{ location: string }, []>("SELECT location FROM weather_cache WHERE id = 'current'").get();
    expect(row?.location).toBe("London");
  });

  test("overwrites previous cache entry on second fetch", async () => {
    await fetchWeather(db, "fake-key", "London");
    overrideFetch(async () =>
      JSON.stringify({
        name: "Paris",
        main: { temp: 18.0, feels_like: 17.0, humidity: 65 },
        weather: [{ id: 801, main: "Clouds", description: "few clouds", icon: "02d" }],
      }),
    );
    await fetchWeather(db, "fake-key", "Paris");
    const count = db.query<{ c: number }, []>("SELECT COUNT(*) as c FROM weather_cache").get();
    expect(count?.c).toBe(1);
    const row = db.query<{ location: string }, []>("SELECT location FROM weather_cache WHERE id = 'current'").get();
    expect(row?.location).toBe("Paris");
  });

  test("throws when fetch returns an error", async () => {
    overrideFetch(async () => {
      throw new Error("network error");
    });
    await expect(fetchWeather(db, "fake-key", "London")).rejects.toThrow("network error");
  });
});
