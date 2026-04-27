import { useState } from "react";
import type { CountdownWithTimeLeft } from "../shared/types";
import { useCountdownsContext } from "./CountdownsContext";

interface Props {
  onClose?: () => void;
}

function formatTimeLeft(countdown: CountdownWithTimeLeft): string {
  if (countdown.isReached) return "Reached!";
  const parts: string[] = [];
  if (countdown.daysRemaining > 0) parts.push(`${countdown.daysRemaining}d`);
  if (countdown.hoursRemaining > 0) parts.push(`${countdown.hoursRemaining}h`);
  if (countdown.minutesRemaining > 0 || parts.length === 0) parts.push(`${countdown.minutesRemaining}m`);
  return parts.join(" ");
}

function formatTargetDate(targetDate: string): string {
  const tIdx = targetDate.indexOf("T");
  if (tIdx === -1) return targetDate;
  return `${targetDate.slice(0, tIdx)} ${targetDate.slice(tIdx + 1, tIdx + 6)}`;
}

function CountdownItem({
  countdown,
  onArchive,
  onDelete,
}: {
  countdown: CountdownWithTimeLeft;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <li className="py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200">{countdown.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{formatTargetDate(countdown.targetDate)}</p>
        </div>
        <span
          className={`text-sm font-mono font-semibold shrink-0 ${countdown.isReached ? "text-emerald-400" : "text-zinc-300"}`}
        >
          {formatTimeLeft(countdown)}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {countdown.isReached && (
            <button
              type="button"
              onClick={() => void onArchive(countdown.id)}
              className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
              aria-label={`Archive ${countdown.name}`}
            >
              Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => void onDelete(countdown.id)}
            className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
            aria-label={`Delete ${countdown.name}`}
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function CountdownsList({
  countdowns,
  archive,
  remove,
}: {
  countdowns: readonly CountdownWithTimeLeft[];
  archive: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}) {
  if (countdowns.length === 0) {
    return <p className="text-zinc-600 text-sm text-center py-8">No countdowns yet. Add one above.</p>;
  }

  return (
    <ul>
      {countdowns.map((countdown) => (
        <CountdownItem key={countdown.id} countdown={countdown} onArchive={archive} onDelete={remove} />
      ))}
    </ul>
  );
}

function AddCountdownForm({ onCreate }: { onCreate: (name: string, targetDate: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmedName = name.trim();
    if (!trimmedName || !targetDate) return;
    setError(null);
    try {
      const dateTime = targetTime ? `${targetDate}T${targetTime}` : targetDate;
      await onCreate(trimmedName, dateTime);
      setName("");
      setTargetDate("");
      setTargetTime("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void handleAdd();
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">New countdown</h3>
      <input
        type="text"
        placeholder="Event name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
        aria-label="Event name"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="flex-1 bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200"
          aria-label="Target date"
        />
        <input
          type="time"
          value={targetTime}
          onChange={(e) => setTargetTime(e.target.value)}
          className="bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200"
          aria-label="Target time"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={!name.trim() || !targetDate}
          className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded text-sm transition-colors text-zinc-200"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function CountdownsFullView({ onClose }: Props) {
  const { countdowns, create, archive, remove } = useCountdownsContext();

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold">Countdowns</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm"
            aria-label="Close"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <AddCountdownForm onCreate={create} />
        <div>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Your countdowns</h3>
          <CountdownsList countdowns={countdowns} archive={archive} remove={remove} />
        </div>
      </div>
    </div>
  );
}
