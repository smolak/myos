import { useDailyJournal } from "./useDailyJournal";

interface Props {
  onOpenFullView?: () => void;
}

export function DailyJournalWidget({ onOpenFullView }: Props) {
  const { todayNote, notes, isLoading } = useDailyJournal();
  const today = new Date().toISOString().split("T")[0];

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-zinc-500 text-xs">Loading…</div>;
  }

  const recentCount = notes.filter((n) => {
    const d = new Date(n.date);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return d >= sevenDaysAgo;
  }).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-200">Daily Journal</h2>
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          View all
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        <div className="text-xs text-zinc-500">
          {today} &mdash; {recentCount} {recentCount === 1 ? "entry" : "entries"} this week
        </div>

        {todayNote ? (
          <div className="flex-1 overflow-hidden">
            <p className="text-xs text-zinc-300 line-clamp-4 leading-relaxed">{todayNote.content}</p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <button
              type="button"
              onClick={onOpenFullView}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              No note for today — write one
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
