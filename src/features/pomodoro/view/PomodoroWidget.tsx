import { formatTime, usePomodoro } from "./usePomodoro";

interface Props {
  onOpenFullView?: () => void;
}

const SESSION_LABELS: Record<string, string> = {
  work: "Work",
  break: "Break",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Running",
  paused: "Paused",
  completed: "Done!",
  cancelled: "Cancelled",
};

export function PomodoroWidget({ onOpenFullView }: Props) {
  const { session, remaining, start, pause, resume, cancel } = usePomodoro();

  const isIdle = !session || session.status === "completed" || session.status === "cancelled";
  const isRunning = session?.status === "running";
  const isPaused = session?.status === "paused";
  const isDone = session?.status === "completed";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-200">Pomodoro</h2>
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Open
        </button>
      </div>

      <div className="flex flex-1 items-center gap-4">
        <button
          type="button"
          className="flex flex-col items-center cursor-pointer"
          onClick={onOpenFullView}
          aria-label="Open Pomodoro"
        >
          <span className={`text-3xl font-mono font-bold tabular-nums ${isDone ? "text-green-400" : "text-zinc-100"}`}>
            {isIdle && !isDone ? "25:00" : formatTime(remaining)}
          </span>
          {session && !isIdle ? (
            <span className="text-xs text-zinc-500 mt-0.5">
              {SESSION_LABELS[session.type]} · {STATUS_LABELS[session.status]}
            </span>
          ) : isDone ? (
            <span className="text-xs text-green-500 mt-0.5">Session complete!</span>
          ) : (
            <span className="text-xs text-zinc-600 mt-0.5">Ready</span>
          )}
        </button>

        <div className="flex flex-col gap-1.5 ml-auto">
          {isIdle && (
            <>
              <button
                type="button"
                onClick={() => start("work")}
                className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded transition-colors text-zinc-200"
              >
                Work
              </button>
              <button
                type="button"
                onClick={() => start("break")}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded transition-colors text-zinc-400"
              >
                Break
              </button>
            </>
          )}
          {isRunning && (
            <>
              <button
                type="button"
                onClick={pause}
                className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded transition-colors text-zinc-200"
                aria-label="Pause"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={cancel}
                className="text-xs bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded transition-colors text-zinc-500"
                aria-label="Cancel"
              >
                Cancel
              </button>
            </>
          )}
          {isPaused && (
            <>
              <button
                type="button"
                onClick={resume}
                className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded transition-colors text-zinc-200"
                aria-label="Resume"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={cancel}
                className="text-xs bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded transition-colors text-zinc-500"
                aria-label="Cancel"
              >
                Cancel
              </button>
            </>
          )}
          {isDone && (
            <button
              type="button"
              onClick={() => start("work")}
              className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded transition-colors text-zinc-200"
            >
              New
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
