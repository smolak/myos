import type { HabitWithStats } from "../shared/types";
import { useHabitsContext } from "./HabitsContext";

interface Props {
  onOpenFullView?: () => void;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function HabitRow({ habit, onToggle }: { habit: HabitWithStats; onToggle: () => void }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <button
        type="button"
        onClick={onToggle}
        aria-label={habit.completedToday ? `Unmark ${habit.name}` : `Complete ${habit.name}`}
        className={`w-4 h-4 rounded-full border shrink-0 transition-colors ${
          habit.completedToday ? "bg-emerald-500 border-emerald-500" : "border-zinc-600 hover:border-zinc-400"
        }`}
      />
      <span
        className={`text-xs truncate flex-1 ${habit.completedToday ? "text-zinc-500 line-through" : "text-zinc-300"}`}
      >
        {habit.name}
      </span>
      {habit.currentStreak > 1 && <span className="text-xs text-amber-500 shrink-0">{habit.currentStreak}d</span>}
    </li>
  );
}

export function HabitsWidget({ onOpenFullView }: Props) {
  const { habits, complete, uncomplete } = useHabitsContext();
  const today = todayString();
  const visibleHabits = habits.slice(0, 4);

  async function handleToggle(habit: HabitWithStats) {
    if (habit.completedToday) {
      await uncomplete(habit.id, today);
    } else {
      await complete(habit.id, today);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-200">Habits</h2>
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Open
        </button>
      </div>

      {habits.length === 0 ? (
        <button
          type="button"
          className="flex flex-1 items-center justify-center cursor-pointer"
          onClick={onOpenFullView}
          aria-label="Open Habits to add habits"
        >
          <p className="text-xs text-zinc-600 text-center">
            No habits yet.
            <br />
            Click to add habits.
          </p>
        </button>
      ) : (
        <>
          <ul className="flex-1 overflow-hidden">
            {visibleHabits.map((habit) => (
              <HabitRow key={habit.id} habit={habit} onToggle={() => void handleToggle(habit)} />
            ))}
          </ul>
          {habits.length > 4 && (
            <button
              type="button"
              onClick={onOpenFullView}
              className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 text-left transition-colors"
            >
              +{habits.length - 4} more
            </button>
          )}
        </>
      )}
    </div>
  );
}
