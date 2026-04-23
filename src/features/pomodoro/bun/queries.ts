import type { Database } from "bun:sqlite";
import type { PomodoroSession, PomodoroQueries, SessionType, SessionStatus } from "../shared/types";

interface SessionRow {
	readonly id: string;
	readonly type: string;
	readonly duration_seconds: number;
	readonly elapsed_seconds: number;
	readonly status: string;
	readonly started_at: string;
	readonly ended_at: string | null;
	readonly created_at: string;
	readonly updated_at: string;
}

function rowToSession(row: SessionRow): PomodoroSession {
	return {
		id: row.id,
		type: row.type as SessionType,
		durationSeconds: row.duration_seconds,
		elapsedSeconds: row.elapsed_seconds,
		status: row.status as SessionStatus,
		startedAt: row.started_at,
		endedAt: row.ended_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function getCurrentSession(
	db: Database,
	_params: PomodoroQueries["get-current"]["params"],
): Promise<PomodoroQueries["get-current"]["result"]> {
	const row = db
		.query<SessionRow, []>(
			"SELECT * FROM pomodoro_sessions WHERE status IN ('running', 'paused') ORDER BY created_at DESC LIMIT 1",
		)
		.get();
	return row ? rowToSession(row) : null;
}

export async function getSessionHistory(
	db: Database,
	params: PomodoroQueries["get-history"]["params"],
): Promise<PomodoroQueries["get-history"]["result"]> {
	if (params.limit !== undefined) {
		return db
			.query<SessionRow, [number]>(
				"SELECT * FROM pomodoro_sessions WHERE status = 'completed' ORDER BY created_at DESC LIMIT ?",
			)
			.all(params.limit)
			.map(rowToSession);
	}
	return db
		.query<SessionRow, []>(
			"SELECT * FROM pomodoro_sessions WHERE status = 'completed' ORDER BY created_at DESC",
		)
		.all()
		.map(rowToSession);
}
