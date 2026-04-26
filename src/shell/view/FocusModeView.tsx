import { DailyJournalFullView } from "@features/daily-journal/view/DailyJournalFullView";
import { PomodoroFullView } from "@features/pomodoro/view/PomodoroFullView";
import { RssReaderFullView } from "@features/rss-reader/view/RssReaderFullView";
import { TodoFullView } from "@features/todo/view/TodoFullView";

interface FocusModeViewProps {
  featureId: string;
  onExit: () => void;
}

function FeatureContent({ featureId, onExit }: FocusModeViewProps) {
  if (featureId === "todo") return <TodoFullView onClose={onExit} />;
  if (featureId === "pomodoro") return <PomodoroFullView onClose={onExit} />;
  if (featureId === "rss-reader") return <RssReaderFullView onClose={onExit} />;
  if (featureId === "daily-journal") return <DailyJournalFullView onClose={onExit} />;
  return null;
}

export function FocusModeView({ featureId, onExit }: FocusModeViewProps) {
  return (
    <div data-testid="focus-mode-view" className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100">
      <div className="shrink-0 flex justify-end px-4 py-2 border-b border-zinc-800">
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit focus mode"
          className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded px-2 py-1 transition-colors"
        >
          Exit Focus Mode (⌘⇧F)
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <FeatureContent featureId={featureId} onExit={onExit} />
      </div>
    </div>
  );
}
