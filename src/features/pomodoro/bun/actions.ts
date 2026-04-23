import type { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import type { PomodoroActions } from "../shared/types";

const DEFAULT_WORK_SECONDS = 25 * 60;
const DEFAULT_BREAK_SECONDS = 5 * 60;

type StartParams = PomodoroActions["start"]["params"];
type PauseParams = PomodoroActions["pause"]["params"];
type ResumeParams = PomodoroActions["resume"]["params"];
type CompleteParams = PomodoroActions["complete"]["params"];
type CancelParams = PomodoroActions["cancel"]["params"];

export async function startSession(
	db: Database,
	params: StartParams,
): Promise<PomodoroActions["start"]["result"]> {
	const type = params.type ?? "work";
	const durationSeconds =
		params.durationSeconds ?? (type === "work" ? DEFAULT_WORK_SECONDS : DEFAULT_BREAK_SECONDS);

	db.query(
		`UPDATE pomodoro_sessions SET status = 'cancelled', ended_at = ?, updated_at = ?
		 WHERE status IN ('running', 'paused')`,
	).run(new Date().toISOString(), new Date().toISOString());

	const id = nanoid();
	const now = new Date().toISOString();
	db.query(
		`INSERT INTO pomodoro_sessions (id, type, duration_seconds, elapsed_seconds, status, started_at, ended_at, created_at, updated_at)
		 VALUES (?, ?, ?, 0, 'running', ?, NULL, ?, ?)`,
	).run(id, type, durationSeconds, now, now, now);

	return { id };
}

export async function pauseSession(
	db: Database,
	params: PauseParams,
): Promise<PomodoroActions["pause"]["result"]> {
	const row = db
		.query<{ id: string; status: string }, [string]>(
			"SELECT id, status FROM pomodoro_sessions WHERE id = ?",
		)
		.get(params.id);
	if (!row || row.status !== "running") return { success: false };

	const now = new Date().toISOString();
	db.query(
		"UPDATE pomodoro_sessions SET status = 'paused', elapsed_seconds = ?, updated_at = ? WHERE id = ?",
	).run(params.elapsedSeconds, now, params.id);
	return { success: true };
}

export async function resumeSession(
	db: Database,
	params: ResumeParams,
): Promise<PomodoroActions["resume"]["result"]> {
	const row = db
		.query<{ id: string; status: string }, [string]>(
			"SELECT id, status FROM pomodoro_sessions WHERE id = ?",
		)
		.get(params.id);
	if (!row || row.status !== "paused") return { success: false };

	const now = new Date().toISOString();
	db.query(
		"UPDATE pomodoro_sessions SET status = 'running', updated_at = ? WHERE id = ?",
	).run(now, params.id);
	return { success: true };
}

export async function completeSession(
	db: Database,
	params: CompleteParams,
): Promise<PomodoroActions["complete"]["result"]> {
	const row = db
		.query<{ id: string; status: string }, [string]>(
			"SELECT id, status FROM pomodoro_sessions WHERE id = ?",
		)
		.get(params.id);
	if (!row) return { success: false };
	if (row.status === "completed") return { success: true };
	if (row.status === "cancelled") return { success: false };

	const now = new Date().toISOString();
	const updates: [string | number, string, string] = [now, now, params.id];
	if (params.elapsedSeconds !== undefined) {
		db.query(
			`UPDATE pomodoro_sessions SET status = 'completed', elapsed_seconds = ?, ended_at = ?, updated_at = ? WHERE id = ?`,
		).run(params.elapsedSeconds, now, now, params.id);
	} else {
		db.query(
			"UPDATE pomodoro_sessions SET status = 'completed', ended_at = ?, updated_at = ? WHERE id = ?",
		).run(...updates);
	}
	return { success: true };
}

export async function cancelSession(
	db: Database,
	params: CancelParams,
): Promise<PomodoroActions["cancel"]["result"]> {
	const row = db
		.query<{ id: string; status: string }, [string]>(
			"SELECT id, status FROM pomodoro_sessions WHERE id = ?",
		)
		.get(params.id);
	if (!row) return { success: false };
	if (row.status === "cancelled") return { success: true };
	if (row.status === "completed") return { success: false };

	const now = new Date().toISOString();
	db.query(
		"UPDATE pomodoro_sessions SET status = 'cancelled', ended_at = ?, updated_at = ? WHERE id = ?",
	).run(now, now, params.id);
	return { success: true };
}
