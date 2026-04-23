import { useState, useEffect, useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import type { SessionType, SessionStatus } from "../shared/types";

export interface PomodoroSessionState {
	readonly id: string;
	readonly type: SessionType;
	readonly durationSeconds: number;
	readonly elapsedSeconds: number;
	readonly status: SessionStatus;
	readonly startedAt: string;
}

export interface PomodoroSettings {
	readonly workDurationMinutes: number;
	readonly breakDurationMinutes: number;
}

interface StoredPomodoroState {
	session: PomodoroSessionState | null;
	settings: PomodoroSettings;
}

const STORAGE_KEY = "pomodoro:state";
const DEFAULT_SETTINGS: PomodoroSettings = {
	workDurationMinutes: 25,
	breakDurationMinutes: 5,
};

function loadState(): StoredPomodoroState {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored) as StoredPomodoroState;
	} catch {
		// ignore corrupt storage
	}
	return { session: null, settings: DEFAULT_SETTINGS };
}

function persist(state: StoredPomodoroState): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export interface UsePomodoroReturn {
	readonly session: PomodoroSessionState | null;
	readonly settings: PomodoroSettings;
	readonly remaining: number;
	start(type?: SessionType): void;
	pause(): void;
	resume(): void;
	complete(): void;
	cancel(): void;
	updateSettings(settings: Partial<PomodoroSettings>): void;
}

export function usePomodoro(): UsePomodoroReturn {
	const [state, setState] = useState<StoredPomodoroState>(loadState);
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const mutate = useCallback((updater: (prev: StoredPomodoroState) => StoredPomodoroState) => {
		setState((prev) => {
			const next = updater(prev);
			persist(next);
			return next;
		});
	}, []);

	useEffect(() => {
		if (state.session?.status === "running") {
			tickRef.current = setInterval(() => {
				mutate((prev) => {
					if (!prev.session || prev.session.status !== "running") return prev;

					const newElapsed = prev.session.elapsedSeconds + 1;

					if (newElapsed >= prev.session.durationSeconds) {
						return {
							...prev,
							session: {
								...prev.session,
								elapsedSeconds: prev.session.durationSeconds,
								status: "completed",
							},
						};
					}

					return {
						...prev,
						session: { ...prev.session, elapsedSeconds: newElapsed },
					};
				});
			}, 1000);
		} else {
			if (tickRef.current !== null) {
				clearInterval(tickRef.current);
				tickRef.current = null;
			}
		}

		return () => {
			if (tickRef.current !== null) {
				clearInterval(tickRef.current);
				tickRef.current = null;
			}
		};
	}, [state.session?.status, mutate]);

	const start = useCallback(
		(type: SessionType = "work") => {
			const durationSeconds =
				type === "work"
					? state.settings.workDurationMinutes * 60
					: state.settings.breakDurationMinutes * 60;

			mutate((prev) => ({
				...prev,
				session: {
					id: nanoid(),
					type,
					durationSeconds,
					elapsedSeconds: 0,
					status: "running",
					startedAt: new Date().toISOString(),
				},
			}));
		},
		[state.settings, mutate],
	);

	const pause = useCallback(() => {
		mutate((prev) => {
			if (!prev.session || prev.session.status !== "running") return prev;
			return { ...prev, session: { ...prev.session, status: "paused" } };
		});
	}, [mutate]);

	const resume = useCallback(() => {
		mutate((prev) => {
			if (!prev.session || prev.session.status !== "paused") return prev;
			return { ...prev, session: { ...prev.session, status: "running" } };
		});
	}, [mutate]);

	const complete = useCallback(() => {
		mutate((prev) => {
			if (!prev.session) return prev;
			return {
				...prev,
				session: {
					...prev.session,
					elapsedSeconds: prev.session.durationSeconds,
					status: "completed",
				},
			};
		});
	}, [mutate]);

	const cancel = useCallback(() => {
		mutate((prev) => ({ ...prev, session: null }));
	}, [mutate]);

	const updateSettings = useCallback(
		(updates: Partial<PomodoroSettings>) => {
			mutate((prev) => ({
				...prev,
				settings: { ...prev.settings, ...updates },
			}));
		},
		[mutate],
	);

	const remaining = state.session
		? Math.max(0, state.session.durationSeconds - state.session.elapsedSeconds)
		: 0;

	return {
		session: state.session,
		settings: state.settings,
		remaining,
		start,
		pause,
		resume,
		complete,
		cancel,
		updateSettings,
	};
}

export function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
