import { useState, useEffect, useCallback } from "react";
import type { ClockSettings, TimeFormat } from "../shared/types";

const STORAGE_KEY = "clock:settings";
const DEFAULT_SETTINGS: ClockSettings = { format: "24h" };

function loadSettings(): ClockSettings {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored) as ClockSettings;
	} catch {
		// ignore corrupt storage
	}
	return DEFAULT_SETTINGS;
}

export interface UseClockReturn {
	readonly time: string;
	readonly settings: ClockSettings;
	updateFormat(format: TimeFormat): void;
}

export function useClock(): UseClockReturn {
	const [now, setNow] = useState(() => new Date());
	const [settings, setSettings] = useState<ClockSettings>(loadSettings);

	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(id);
	}, []);

	const time = now.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: settings.format === "12h",
	});

	const updateFormat = useCallback((format: TimeFormat) => {
		const next: ClockSettings = { format };
		setSettings(next);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	}, []);

	return { time, settings, updateFormat };
}
