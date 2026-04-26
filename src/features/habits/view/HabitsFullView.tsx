import { useState } from "react";
import type { HabitCompletion, HabitWithStats } from "../shared/types";
import { useHabitsContext } from "./HabitsContext";

interface Props {
  onClose?: () => void;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function StreakBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-zinc-800 rounded px-3 py-1.5">
      <span className="text-sm font-semibold text-zinc-200">{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function HistoryView({
  habitId,
  getHistory,
}: {
  habitId: string;
  getHistory: (id: string) => Promise<readonly HabitCompletion[]>;
}) {
  const [history, setHistory] = useState<readonly HabitCompletion[] | null>(null);

  if (history === null) {
    void getHistory(habitId).then(setHistory);
    return <p className="text-xs text-zinc-500">Loading…</p>;
  }

  if (history.length === 0) {
    return <p className="text-xs text-zinc-600">No completions yet.</p>;
  }

  return (
    <ul className="space-y-1">
      {history.map((entry) => (
        <li key={entry.id} className="text-xs text-zinc-400">
          {entry.date}
        </li>
      ))}
    </ul>
  );
}

function HabitItem({
  habit,
  today,
  onComplete,
  onUncomplete,
  onDelete,
  getHistory,
}: {
  habit: HabitWithStats;
  today: string;
  onComplete: (id: string, date: string) => Promise<void>;
  onUncomplete: (id: string, date: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  getHistory: (id: string) => Promise<readonly HabitCompletion[]>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (habit.completedToday ? void onUncomplete(habit.id, today) : void onComplete(habit.id, today))}
          aria-label={habit.completedToday ? `Unmark ${habit.name}` : `Complete ${habit.name}`}
          className={`w-5 h-5 rounded-full border shrink-0 transition-colors ${
            habit.completedToday ? "bg-emerald-500 border-emerald-500" : "border-zinc-600 hover:border-zinc-400"
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${habit.completedToday ? "text-zinc-500 line-through" : "text-zinc-200"}`}>
            {habit.name}
          </p>
          {habit.description && <p className="text-xs text-zinc-600 mt-0.5">{habit.description}</p>}
          <p className="text-xs text-zinc-600 mt-0.5 capitalize">{habit.frequency}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <StreakBadge label="streak" value={habit.currentStreak} />
            <StreakBadge label="best" value={habit.longestStreak} />
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors px-1"
            aria-label={expanded ? "Hide history" : "Show history"}
          >
            {expanded ? "▲" : "▼"}
          </button>
          <button
            type="button"
            onClick={() => void onDelete(habit.id)}
            className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
            aria-label={`Delete ${habit.name}`}
          >
            Remove
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 ml-8">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Completion history</p>
          <HistoryView habitId={habit.id} getHistory={getHistory} />
        </div>
      )}
    </li>
  );
}

function HabitsList({
  habits,
  complete,
  uncomplete,
  remove,
  getHistory,
}: {
  habits: readonly HabitWithStats[];
  complete: (id: string, date: string) => Promise<void>;
  uncomplete: (id: string, date: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getHistory: (id: string) => Promise<readonly HabitCompletion[]>;
}) {
  const today = todayString();

  if (habits.length === 0) {
    return <p className="text-zinc-600 text-sm text-center py-8">No habits yet. Add one above.</p>;
  }

  return (
    <ul>
      {habits.map((habit) => (
        <HabitItem
          key={habit.id}
          habit={habit}
          today={today}
          onComplete={complete}
          onUncomplete={uncomplete}
          onDelete={remove}
          getHistory={getHistory}
        />
      ))}
    </ul>
  );
}

function AddHabitForm({
  onCreate,
}: {
  onCreate: (name: string, description?: string, frequency?: "daily" | "weekly") => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await onCreate(trimmed, description.trim() || undefined, frequency);
      setName("");
      setDescription("");
      setFrequency("daily");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void handleAdd();
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">New habit</h3>
      <input
        type="text"
        placeholder="Habit name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
        aria-label="Habit name"
      />
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
        aria-label="Description"
      />
      <div className="flex gap-2">
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")}
          className="flex-1 bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200"
          aria-label="Frequency"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={!name.trim()}
          className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded text-sm transition-colors text-zinc-200"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function HabitsFullView({ onClose }: Props) {
  const { habits, create, complete, uncomplete, remove, getHistory } = useHabitsContext();

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold">Habits</h2>
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
        <AddHabitForm onCreate={create} />
        <div>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Your habits</h3>
          <HabitsList
            habits={habits}
            complete={complete}
            uncomplete={uncomplete}
            remove={remove}
            getHistory={getHistory}
          />
        </div>
      </div>
    </div>
  );
}
