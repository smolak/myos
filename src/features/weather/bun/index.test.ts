import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ActionQueue } from "@core/bun/action-queue";
import { CredentialStore } from "@core/bun/credential-store";
import { DatabaseManager } from "@core/bun/database-manager";
import { EventBus } from "@core/bun/event-bus";
import { FeatureRegistry } from "@core/bun/feature-registry";
import { Scheduler } from "@core/bun/scheduler";
import { SettingsManager } from "@core/bun/settings-manager";
import { fetchWeather, overrideFetch } from "./actions";
import { weatherFeature } from "./index";

const MOCK_RESPONSE = JSON.stringify({
  name: "London",
  main: { temp: 15.2, feels_like: 13.8, humidity: 72 },
  weather: [{ id: 800, main: "Clear", description: "clear sky", icon: "01d" }],
});

describe("weatherFeature definition", () => {
  test("has id 'weather'", () => {
    expect(weatherFeature.id).toBe("weather");
  });

  test("has a non-empty name", () => {
    expect(weatherFeature.name.length).toBeGreaterThan(0);
  });

  test("has a version", () => {
    expect(weatherFeature.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("has the weather_cache migration at version 001", () => {
    expect(weatherFeature.migrations).toHaveLength(1);
    expect(weatherFeature.migrations[0]?.version).toBe("001");
    expect(weatherFeature.migrations[0]?.up).toContain("CREATE TABLE weather_cache");
  });

  test("manifest declares fetch action", () => {
    expect(Object.keys(weatherFeature.manifest.actions)).toContain("fetch");
  });

  test("manifest declares get-current query", () => {
    expect(Object.keys(weatherFeature.manifest.queries)).toContain("get-current");
  });

  test("manifest declares weather:updated event", () => {
    expect(Object.keys(weatherFeature.manifest.events)).toContain("weather:updated");
  });

  test("manifest declares conditions widget with small and medium sizes", () => {
    const widget = weatherFeature.manifest.widgets.find((w) => w.id === "conditions");
    expect(widget).toBeDefined();
    expect(widget?.sizes).toContain("small");
    expect(widget?.sizes).toContain("medium");
  });

  test("manifest declares network permission", () => {
    expect(weatherFeature.manifest.permissions).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "network" })]),
    );
  });

  test("manifest declares a scheduled fetch task", () => {
    const task = weatherFeature.manifest.scheduledTasks.find((t) => t.id === "weather:fetch");
    expect(task).toBeDefined();
  });
});

describe("weatherFeature lifecycle via FeatureRegistry", () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let actionQueue: ActionQueue;
  let registry: FeatureRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "myos-weather-feature-"));
    dbManager = new DatabaseManager(tmpDir);
    const coreDb = dbManager.getCoreDatabase();
    const settingsManager = new SettingsManager(coreDb);
    const credentialStore = new CredentialStore(coreDb);
    const eventBus = new EventBus(coreDb);
    actionQueue = new ActionQueue(coreDb, 0);
    const scheduler = new Scheduler(coreDb, 60_000, 0);
    registry = new FeatureRegistry(dbManager, settingsManager, credentialStore, eventBus, actionQueue, scheduler);
  });

  afterEach(async () => {
    dbManager.closeAll();
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("creates weather_cache table on first startup", async () => {
    await registry.startup([weatherFeature]);
    const featureDb = dbManager.getFeatureDatabase("weather");
    const row = featureDb
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' AND name='weather_cache'")
      .get();
    expect(row?.name).toBe("weather_cache");
  });

  test("registers as enabled in the features table", async () => {
    await registry.startup([weatherFeature]);
    const coreDb = dbManager.getCoreDatabase();
    const row = coreDb.query<{ enabled: number }, [string]>("SELECT enabled FROM features WHERE id = ?").get("weather");
    expect(row?.enabled).toBe(1);
  });

  test("get-current query returns null when no data has been fetched", async () => {
    await registry.startup([weatherFeature]);
    const result = await actionQueue.executeQuery("weather", "get-current", {});
    expect(result).toBeNull();
  });

  test("get-current returns cached data after fetchWeather writes to DB", async () => {
    overrideFetch(async () => MOCK_RESPONSE);
    await registry.startup([weatherFeature]);

    const featureDb = dbManager.getFeatureDatabase("weather");
    await fetchWeather(featureDb, "test-key", "London");

    const data = (await actionQueue.executeQuery("weather", "get-current", {})) as {
      location: string;
      tempCelsius: number;
    } | null;
    expect(data).not.toBeNull();
    expect(data?.location).toBe("London");
    expect(data?.tempCelsius).toBe(15.2);
  });
});
