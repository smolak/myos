import { useState } from "react";
import { usePomodoro, formatTime } from "./usePomodoro";
import type { PomodoroSession } from "../shared/types";

interface Props {
	onClose?: () => void;
}

function SessionHistoryItem({ session }: { session: PomodoroSession }) {
	const elapsed = session.elapsedSeconds;
	const total = session.durationSeconds;
	const completionPct = total > 0 ? Math.round((elapsed / total) * 100) : 0;
	const date = new Date(session.startedAt).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	return (
		<li className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
			<div>
				<span
					className={`text-xs font-medium ${session.type === "work" ? "text-zinc-200" : "text-zinc-400"}`}
				>
					{session.type === "work" ? "Work" : "Break"}
				</span>
				<span className="text-xs text-zinc-600 ml-2">{date}</span>
			</div>
			<span className="text-xs text-zinc-500">
				{formatTime(elapsed)} / {formatTime(total)} ({completionPct}%)
			</span>
		</li>
	);
}

export function PomodoroFullView({ onClose }: Props) {
	const { session, settings, remaining, start, pause, resume, complete, cancel, updateSettings } =
		usePomodoro();
	const [activeTab, setActiveTab] = useState<"timer" | "history" | "settings">("timer");

	const isIdle = !session || session.status === "completed" || session.status === "cancelled";
	const isRunning = session?.status === "running";
	const isPaused = session?.status === "paused";
	const isDone = session?.status === "completed";

	return (
		<div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
			<div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
				<h2 className="text-lg font-semibold">Pomodoro</h2>
				{onClose && (
					<button
						onClick={onClose}
						className="text-zinc-400 hover:text-zinc-200 text-sm"
						aria-label="Close"
					>
						Close
					</button>
				)}
			</div>

			<div className="flex border-b border-zinc-800 px-6">
				{(["timer", "history", "settings"] as const).map((tab) => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab)}
						className={`py-2 mr-4 text-sm border-b-2 transition-colors ${
							activeTab === tab
								? "border-zinc-400 text-zinc-200"
								: "border-transparent text-zinc-500 hover:text-zinc-300"
						}`}
					>
						{tab.charAt(0).toUpperCase() + tab.slice(1)}
					</button>
				))}
			</div>

			<div className="flex-1 overflow-auto p-6">
				{activeTab === "timer" && (
					<div className="flex flex-col items-center gap-6">
						{session && (isRunning || isPaused) && (
							<div className="text-xs text-zinc-500 uppercase tracking-wide">
								{session.type === "work" ? "Work Session" : "Break Session"}
							</div>
						)}

						<div className="text-center">
							<div
								className={`text-7xl font-mono font-bold tabular-nums ${isDone ? "text-green-400" : "text-zinc-100"}`}
							>
								{isIdle && !isDone ? formatTime(settings.workDurationMinutes * 60) : formatTime(remaining)}
							</div>
							{isDone && (
								<p className="text-green-500 text-sm mt-2">Session complete! Great work.</p>
							)}
							{isPaused && (
								<p className="text-zinc-500 text-sm mt-2">Paused</p>
							)}
						</div>

						<div className="flex gap-3">
							{isIdle && (
								<>
									<button
										onClick={() => start("work")}
										className="bg-zinc-700 hover:bg-zinc-600 px-6 py-2 rounded text-sm transition-colors"
									>
										Start Work
									</button>
									<button
										onClick={() => start("break")}
										className="bg-zinc-800 hover:bg-zinc-700 px-6 py-2 rounded text-sm transition-colors text-zinc-400"
									>
										Start Break
									</button>
								</>
							)}
							{isRunning && (
								<>
									<button
										onClick={pause}
										className="bg-zinc-700 hover:bg-zinc-600 px-6 py-2 rounded text-sm transition-colors"
										aria-label="Pause session"
									>
										Pause
									</button>
									<button
										onClick={complete}
										className="bg-zinc-800 hover:bg-zinc-700 px-6 py-2 rounded text-sm transition-colors text-zinc-400"
										aria-label="Complete session"
									>
										Done
									</button>
									<button
										onClick={cancel}
										className="bg-zinc-900 hover:bg-zinc-800 px-6 py-2 rounded text-sm transition-colors text-zinc-600"
										aria-label="Cancel session"
									>
										Cancel
									</button>
								</>
							)}
							{isPaused && (
								<>
									<button
										onClick={resume}
										className="bg-zinc-700 hover:bg-zinc-600 px-6 py-2 rounded text-sm transition-colors"
										aria-label="Resume session"
									>
										Resume
									</button>
									<button
										onClick={cancel}
										className="bg-zinc-900 hover:bg-zinc-800 px-6 py-2 rounded text-sm transition-colors text-zinc-600"
										aria-label="Cancel session"
									>
										Cancel
									</button>
								</>
							)}
							{isDone && (
								<>
									<button
										onClick={() => start("work")}
										className="bg-zinc-700 hover:bg-zinc-600 px-6 py-2 rounded text-sm transition-colors"
									>
										New Work Session
									</button>
									<button
										onClick={() => start("break")}
										className="bg-zinc-800 hover:bg-zinc-700 px-6 py-2 rounded text-sm transition-colors text-zinc-400"
									>
										Take a Break
									</button>
								</>
							)}
						</div>

						{session && (isRunning || isPaused) && (
							<div className="w-full max-w-sm bg-zinc-800 rounded-full h-1.5">
								<div
									className="bg-zinc-400 h-1.5 rounded-full transition-all"
									style={{
										width: `${Math.min(100, (session.elapsedSeconds / session.durationSeconds) * 100)}%`,
									}}
								/>
							</div>
						)}
					</div>
				)}

				{activeTab === "history" && <SessionHistoryTab />}

				{activeTab === "settings" && (
					<SettingsTab
						workMinutes={settings.workDurationMinutes}
						breakMinutes={settings.breakDurationMinutes}
						onUpdate={updateSettings}
					/>
				)}
			</div>
		</div>
	);
}

function SessionHistoryTab() {
	const { session } = usePomodoro();

	const storedRaw =
		typeof localStorage !== "undefined" ? localStorage.getItem("pomodoro:state") : null;
	const allSessions: PomodoroSession[] = [];

	if (storedRaw) {
		try {
			// Parse all completed sessions from localStorage
			// The usePomodoro hook only exposes current session; history would normally come from backend
			// For now, derive from the stored state's session if completed
			const parsed = JSON.parse(storedRaw) as { session: PomodoroSession | null };
			if (parsed.session?.status === "completed") {
				allSessions.push(parsed.session as PomodoroSession);
			}
		} catch {
			// ignore
		}
	}
	void session;

	return (
		<div>
			<h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
				Completed Sessions
			</h3>
			{allSessions.length === 0 ? (
				<p className="text-zinc-600 text-sm text-center py-8">No completed sessions yet</p>
			) : (
				<ul>
					{allSessions.map((s) => (
						<SessionHistoryItem key={s.id} session={s} />
					))}
				</ul>
			)}
		</div>
	);
}

interface SettingsTabProps {
	workMinutes: number;
	breakMinutes: number;
	onUpdate: (updates: { workDurationMinutes?: number; breakDurationMinutes?: number }) => void;
}

function SettingsTab({ workMinutes, breakMinutes, onUpdate }: SettingsTabProps) {
	const [work, setWork] = useState(String(workMinutes));
	const [brk, setBreak] = useState(String(breakMinutes));

	function handleSave() {
		const w = parseInt(work, 10);
		const b = parseInt(brk, 10);
		if (!isNaN(w) && w > 0) onUpdate({ workDurationMinutes: w });
		if (!isNaN(b) && b > 0) onUpdate({ breakDurationMinutes: b });
	}

	return (
		<div className="max-w-sm space-y-4">
			<h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
				Timer Settings
			</h3>
			<div className="space-y-1">
				<label className="text-sm text-zinc-400" htmlFor="work-duration">
					Work duration (minutes)
				</label>
				<input
					id="work-duration"
					type="number"
					min={1}
					max={120}
					value={work}
					onChange={(e) => setWork(e.target.value)}
					className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500"
				/>
			</div>
			<div className="space-y-1">
				<label className="text-sm text-zinc-400" htmlFor="break-duration">
					Break duration (minutes)
				</label>
				<input
					id="break-duration"
					type="number"
					min={1}
					max={60}
					value={brk}
					onChange={(e) => setBreak(e.target.value)}
					className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500"
				/>
			</div>
			<button
				onClick={handleSave}
				className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm transition-colors"
			>
				Save
			</button>
		</div>
	);
}
