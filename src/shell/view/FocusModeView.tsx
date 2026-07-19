import { FEATURE_VIEWS, findFeatureView } from "./feature-views";

interface FocusModeViewProps {
  featureId: string;
  onExit: () => void;
}

function FeatureContent({ featureId, onExit }: FocusModeViewProps) {
  const descriptor = findFeatureView(FEATURE_VIEWS, featureId);
  const FullView = descriptor?.supportsFocusMode ? descriptor.FullView : undefined;
  return FullView ? <FullView onClose={onExit} /> : null;
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
