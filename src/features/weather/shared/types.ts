import type { ActionMap, EventMap, QueryMap } from "@core/types";

export type WeatherUnits = "metric" | "imperial";

export interface WeatherCondition {
  readonly id: number;
  readonly main: string;
  readonly description: string;
  readonly icon: string;
}

export interface WeatherData {
  readonly location: string;
  readonly tempCelsius: number;
  readonly feelsLikeCelsius: number;
  readonly humidity: number;
  readonly condition: WeatherCondition;
  readonly fetchedAt: string;
}

export interface WeatherSettings {
  readonly apiKey: string;
  readonly location: string;
  readonly units: WeatherUnits;
}

export interface WeatherEvents extends EventMap {
  "weather:updated": { location: string; tempCelsius: number; condition: string };
}

export interface WeatherActions extends ActionMap {
  fetch: { params: Record<string, never>; result: { success: boolean } };
}

export interface WeatherQueries extends QueryMap {
  "get-current": { params: Record<string, never>; result: WeatherData | null };
}
