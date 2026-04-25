import type { Database } from "bun:sqlite";
import type { WeatherData } from "../shared/types";

export interface OpenWeatherResponse {
  name: string;
  main: { temp: number; feels_like: number; humidity: number };
  weather: Array<{ id: number; main: string; description: string; icon: string }>;
}

type FetchFn = (url: string) => Promise<string>;

let _fetch: FetchFn = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
};

export function overrideFetch(fn: FetchFn): void {
  _fetch = fn;
}

export async function fetchWeather(db: Database, apiKey: string, location: string): Promise<WeatherData> {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${encodeURIComponent(apiKey)}&units=metric`;
  const text = await _fetch(url);
  const raw = JSON.parse(text) as OpenWeatherResponse;

  const data: WeatherData = {
    location: raw.name,
    tempCelsius: raw.main.temp,
    feelsLikeCelsius: raw.main.feels_like,
    humidity: raw.main.humidity,
    condition: {
      id: raw.weather[0]?.id,
      main: raw.weather[0]?.main,
      description: raw.weather[0]?.description,
      icon: raw.weather[0]?.icon,
    },
    fetchedAt: new Date().toISOString(),
  };

  db.query(
    `INSERT INTO weather_cache (id, location, temp_celsius, feels_like, humidity, condition_id, condition_main, condition_desc, condition_icon, fetched_at)
		 VALUES ('current', ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (id) DO UPDATE SET
		     location = excluded.location,
		     temp_celsius = excluded.temp_celsius,
		     feels_like = excluded.feels_like,
		     humidity = excluded.humidity,
		     condition_id = excluded.condition_id,
		     condition_main = excluded.condition_main,
		     condition_desc = excluded.condition_desc,
		     condition_icon = excluded.condition_icon,
		     fetched_at = excluded.fetched_at`,
  ).run(
    data.location,
    data.tempCelsius,
    data.feelsLikeCelsius,
    data.humidity,
    data.condition.id,
    data.condition.main,
    data.condition.description,
    data.condition.icon,
    data.fetchedAt,
  );

  return data;
}
