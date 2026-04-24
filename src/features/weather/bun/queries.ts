import type { Database } from "bun:sqlite";
import type { WeatherData } from "../shared/types";

interface WeatherRow {
  location: string;
  temp_celsius: number;
  feels_like: number;
  humidity: number;
  condition_id: number;
  condition_main: string;
  condition_desc: string;
  condition_icon: string;
  fetched_at: string;
}

export function getCurrentWeather(db: Database): WeatherData | null {
  const row = db
    .query<WeatherRow, []>(
      "SELECT location, temp_celsius, feels_like, humidity, condition_id, condition_main, condition_desc, condition_icon, fetched_at FROM weather_cache WHERE id = 'current'",
    )
    .get();

  if (!row) return null;

  return {
    location: row.location,
    tempCelsius: row.temp_celsius,
    feelsLikeCelsius: row.feels_like,
    humidity: row.humidity,
    condition: {
      id: row.condition_id,
      main: row.condition_main,
      description: row.condition_desc,
      icon: row.condition_icon,
    },
    fetchedAt: row.fetched_at,
  };
}
