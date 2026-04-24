import { useState, useCallback, useEffect } from "react";
import type { WeatherData, WeatherSettings } from "../shared/types";

type FetchJsonFn = (url: string) => Promise<string>;

let _fetchJson: FetchJsonFn = async (url) => {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.text();
};

export function overrideFetchJson(fn: FetchJsonFn): void {
	_fetchJson = fn;
}

const STORAGE_KEY = "weather:state";

interface WeatherState {
	settings: WeatherSettings;
	data: WeatherData | null;
	error: string | null;
}

const DEFAULT_SETTINGS: WeatherSettings = {
	apiKey: "",
	location: "",
	units: "metric",
};

function loadState(): WeatherState {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored) as WeatherState;
	} catch {
		// ignore corrupt storage
	}
	return { settings: DEFAULT_SETTINGS, data: null, error: null };
}

function persist(state: WeatherState): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export interface UseWeatherReturn {
	readonly data: WeatherData | null;
	readonly settings: WeatherSettings;
	readonly isLoading: boolean;
	readonly error: string | null;
	updateSettings(updates: Partial<WeatherSettings>): void;
	refresh(): Promise<void>;
}

export function useWeather(): UseWeatherReturn {
	const [state, setState] = useState<WeatherState>(loadState);
	const [isLoading, setIsLoading] = useState(false);

	const mutate = useCallback((updater: (prev: WeatherState) => WeatherState) => {
		setState((prev) => {
			const next = updater(prev);
			persist(next);
			return next;
		});
	}, []);

	const fetchWeather = useCallback(async (settings: WeatherSettings) => {
		const { apiKey, location, units } = settings;
		if (!apiKey || !location) return;

		setIsLoading(true);
		try {
			const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${encodeURIComponent(apiKey)}&units=${units}`;
			const text = await _fetchJson(url);
			const raw = JSON.parse(text) as {
				name: string;
				main: { temp: number; feels_like: number; humidity: number };
				weather: Array<{ id: number; main: string; description: string; icon: string }>;
			};

			const data: WeatherData = {
				location: raw.name,
				tempCelsius: raw.main.temp,
				feelsLikeCelsius: raw.main.feels_like,
				humidity: raw.main.humidity,
				condition: {
					id: raw.weather[0]!.id,
					main: raw.weather[0]!.main,
					description: raw.weather[0]!.description,
					icon: raw.weather[0]!.icon,
				},
				fetchedAt: new Date().toISOString(),
			};

			mutate((prev) => ({ ...prev, data, error: null }));
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to fetch weather";
			mutate((prev) => ({ ...prev, error: message }));
		} finally {
			setIsLoading(false);
		}
	}, [mutate]);

	useEffect(() => {
		if (state.settings.apiKey && state.settings.location && !state.data) {
			void fetchWeather(state.settings);
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const updateSettings = useCallback(
		(updates: Partial<WeatherSettings>) => {
			mutate((prev) => ({ ...prev, settings: { ...prev.settings, ...updates }, error: null }));
		},
		[mutate],
	);

	const refresh = useCallback(async () => {
		await fetchWeather(state.settings);
	}, [fetchWeather, state.settings]);

	return {
		data: state.data,
		settings: state.settings,
		isLoading,
		error: state.error,
		updateSettings,
		refresh,
	};
}
