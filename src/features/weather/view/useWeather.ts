import { useState, useCallback, useEffect } from "react";
import type { WeatherData, WeatherSettings } from "../shared/types";
import { rpc } from "@shell/view/electrobun";

const DEFAULT_SETTINGS: WeatherSettings = {
	apiKey: "",
	location: "",
	units: "metric",
};

export interface UseWeatherReturn {
	readonly data: WeatherData | null;
	readonly settings: WeatherSettings;
	readonly isLoading: boolean;
	readonly error: string | null;
	updateSettings(updates: Partial<WeatherSettings>): Promise<void>;
	refresh(): Promise<void>;
}

export function useWeather(): UseWeatherReturn {
	const [data, setData] = useState<WeatherData | null>(null);
	const [settings, setSettings] = useState<WeatherSettings>(DEFAULT_SETTINGS);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void Promise.all([
			rpc.request["weather:get-settings"]({}),
			rpc.request["weather:get-current"]({}),
		]).then(([savedSettings, cachedData]) => {
			setSettings(savedSettings);
			setData(cachedData);
		}).finally(() => setIsLoading(false));
	}, []);

	const refresh = useCallback(async () => {
		if (!settings.apiKey || !settings.location) return;
		setIsLoading(true);
		setError(null);
		try {
			const result = await rpc.request["weather:fetch"]({});
			if (result.success) {
				const fresh = await rpc.request["weather:get-current"]({});
				setData(fresh);
			} else {
				setError("Failed to fetch weather");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch weather");
		} finally {
			setIsLoading(false);
		}
	}, [settings.apiKey, settings.location]);

	const updateSettings = useCallback(async (updates: Partial<WeatherSettings>) => {
		await rpc.request["weather:update-settings"](updates);
		setSettings((prev) => ({ ...prev, ...updates }));
		setError(null);
	}, []);

	return { data, settings, isLoading, error, updateSettings, refresh };
}
