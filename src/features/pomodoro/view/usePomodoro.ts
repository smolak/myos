import { useState, useEffect, useCallback, useRef } from "react";
import type { SessionType, SessionStatus, PomodoroSession } from "../shared/types";
import { rpc } from "@shell/view/electrobun";

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

const DEFAULT_SETTINGS: PomodoroSettings = {
	workDurationMinutes: 25,
	breakDurationMinutes: 5,
};

function sessionToState(s: PomodoroSession): PomodoroSessionState {
	return {
		id: s.id,
		type: s.type,
		durationSeconds: s.durationSeconds,
		elapsedSeconds: s.elapsedSeconds,
		status: s.status,
		startedAt: s.startedAt,
	};
}

export interface UsePomodoroReturn {
	readonly session: PomodoroSessionState | null;
	readonly settings: PomodoroSettings;
	readonly remaining: number;
	start(type?: SessionType): Promise<void>;
	pause(): Promise<void>;
	resume(): Promise<void>;
	complete(): Promise<void>;
	cancel(): Promise<void>;
	updateSettings(settings: Partial<PomodoroSettings>): Promise<void>;
}

export function usePomodoro(): UsePomodoroReturn {
	const [session, setSession] = useState<PomodoroSessionState | null>(null);
	const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Load persisted session and settings on mount
	useEffect(() => {
		void Promise.all([
			rpc.request["pomodoro:get-current"]({}),
			rpc.request["pomodoro:get-settings"]({}),
		]).then(([currentSession, savedSettings]) => {
			if (currentSession) {
				setSession(sessionToState(currentSession as PomodoroSession));
			}
			setSettings(savedSettings);
		});
	}, []);

	// Timer tick — runs only in view layer
	useEffect(() => {
		if (session?.status === "running") {
			tickRef.current = setInterval(() => {
				setSession((prev) => {
					if (!prev || prev.status !== "running") return prev;

					const newElapsed = prev.elapsedSeconds + 1;
					if (newElapsed >= prev.durationSeconds) {
						// Auto-complete when timer reaches zero
						void rpc.request["pomodoro:complete"]({ id: prev.id, elapsedSeconds: prev.durationSeconds });
						return { ...prev, elapsedSeconds: prev.durationSeconds, status: "completed" };
					}
					return { ...prev, elapsedSeconds: newElapsed };
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
	}, [session?.status]);

	const start = useCallback(
		async (type: SessionType = "work") => {
			const durationSeconds =
				type === "work"
					? settings.workDurationMinutes * 60
					: settings.breakDurationMinutes * 60;

			const result = await rpc.request["pomodoro:start"]({ type, durationSeconds });
			setSession({
				id: result.id,
				type,
				durationSeconds,
				elapsedSeconds: 0,
				status: "running",
				startedAt: new Date().toISOString(),
			});
		},
		[settings],
	);

	const pause = useCallback(async () => {
		if (!session || session.status !== "running") return;
		await rpc.request["pomodoro:pause"]({ id: session.id, elapsedSeconds: session.elapsedSeconds });
		setSession((prev) => (prev ? { ...prev, status: "paused" } : null));
	}, [session]);

	const resume = useCallback(async () => {
		if (!session || session.status !== "paused") return;
		await rpc.request["pomodoro:resume"]({ id: session.id });
		setSession((prev) => (prev ? { ...prev, status: "running" } : null));
	}, [session]);

	const complete = useCallback(async () => {
		if (!session) return;
		await rpc.request["pomodoro:complete"]({ id: session.id, elapsedSeconds: session.elapsedSeconds });
		setSession((prev) => (prev ? { ...prev, status: "completed" } : null));
	}, [session]);

	const cancel = useCallback(async () => {
		if (!session) return;
		await rpc.request["pomodoro:cancel"]({ id: session.id });
		setSession(null);
	}, [session]);

	const updateSettings = useCallback(async (updates: Partial<PomodoroSettings>) => {
		await rpc.request["pomodoro:update-settings"](updates);
		setSettings((prev) => ({ ...prev, ...updates }));
	}, []);

	const remaining = session
		? Math.max(0, session.durationSeconds - session.elapsedSeconds)
		: 0;

	return { session, settings, remaining, start, pause, resume, complete, cancel, updateSettings };
}

export function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
