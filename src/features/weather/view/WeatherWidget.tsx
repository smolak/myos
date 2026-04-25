import { useState } from "react";
import type { WeatherUnits } from "../shared/types";
import { useWeather } from "./useWeather";

interface Props {
  onOpenFullView?: () => void;
}

function TemperatureDisplay({ temp, units }: { temp: number; units: WeatherUnits }) {
  const displayed = units === "imperial" ? Math.round((temp * 9) / 5 + 32) : Math.round(temp);
  const unit = units === "imperial" ? "°F" : "°C";
  return (
    <span className="text-3xl font-bold text-zinc-100 tabular-nums">
      {displayed}
      <span className="text-lg font-normal text-zinc-400">{unit}</span>
    </span>
  );
}

function SetupForm({ onSave }: { onSave: (apiKey: string, location: string) => void }) {
  const [apiKey, setApiKey] = useState("");
  const [location, setLocation] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (apiKey.trim() && location.trim()) {
      onSave(apiKey.trim(), location.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-1">
      <p className="text-xs text-zinc-500">Configure Weather</p>
      <input
        type="password"
        placeholder="OpenWeatherMap API key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
      />
      <input
        type="text"
        placeholder="City (e.g. London)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
      />
      <button
        type="submit"
        disabled={!apiKey.trim() || !location.trim()}
        className="text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 px-2 py-1 rounded text-zinc-200 transition-colors"
      >
        Save
      </button>
    </form>
  );
}

export function WeatherWidget({ onOpenFullView }: Props) {
  const { data, settings, isLoading, error, updateSettings, refresh } = useWeather();

  const isConfigured = Boolean(settings.apiKey && settings.location);

  if (!isConfigured) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-zinc-200">Weather</h2>
        </div>
        <SetupForm
          onSave={(apiKey, location) => {
            updateSettings({ apiKey, location });
            void refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-200">Weather</h2>
        <div className="flex items-center gap-2">
          {!isLoading && (
            <button
              type="button"
              onClick={() => void refresh()}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Refresh weather"
            >
              ↻
            </button>
          )}
          {onOpenFullView && (
            <button
              type="button"
              onClick={onOpenFullView}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Open
            </button>
          )}
        </div>
      </div>

      {isLoading && !data && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-zinc-500">Loading…</p>
        </div>
      )}

      {error && !data && (
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <p className="text-xs text-red-400 text-center">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <div className="flex flex-1 items-center gap-3">
          <div className="flex flex-col">
            <TemperatureDisplay temp={data.tempCelsius} units={settings.units} />
            <span className="text-xs text-zinc-400 mt-0.5 capitalize">{data.condition.description}</span>
          </div>
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <span className="text-xs text-zinc-300">{data.location}</span>
            <span className="text-xs text-zinc-600">{data.humidity}% humidity</span>
          </div>
        </div>
      )}
    </div>
  );
}
