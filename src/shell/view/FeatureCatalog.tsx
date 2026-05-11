import type { LayoutItem } from "@core/types";
import { FEATURE_META } from "./WidgetWindow";

interface Props {
  currentLayout: LayoutItem[];
  onAdd: (featureId: string, widgetId: string, w: number, h: number) => void;
  onClose: () => void;
}

export function FeatureCatalog({ currentLayout, onAdd, onClose }: Props) {
  const activeFeatureIds = new Set(currentLayout.map((l) => l.featureId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color-subtle)" }}
        >
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Features</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Click to add a feature widget to your desktop</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Feature grid */}
        <div className="overflow-auto p-6">
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(FEATURE_META).map(([id, meta]) => {
              const isActive = activeFeatureIds.has(id);
              return (
                <div
                  key={id}
                  data-feature={id}
                  className="feature-catalog-card rounded-xl p-4 border transition-all"
                  style={{
                    background: "var(--bg-surface-raised, var(--bg-surface))",
                    borderColor: isActive ? "var(--feature-color)" : "var(--border-color-subtle)",
                    borderWidth: isActive ? "1px" : "1px",
                    opacity: isActive ? 0.9 : 1,
                  }}
                >
                  {/* Icon + title row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                      style={{ background: "color-mix(in srgb, var(--feature-color) 15%, transparent)" }}
                    >
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: "var(--feature-color)" }}>
                        {meta.title}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">{meta.description}</div>
                    </div>
                  </div>

                  {/* Status / action */}
                  {isActive ? (
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--feature-color)" }}>
                      <span>✓</span>
                      <span className="opacity-80">On desktop</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onAdd(id, meta.widgetId, meta.defaultW, meta.defaultH);
                        onClose();
                      }}
                      className="text-xs rounded-lg px-3 py-1.5 transition-colors text-zinc-200 hover:text-zinc-100"
                      style={{
                        background: "color-mix(in srgb, var(--feature-color) 20%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--feature-color) 40%, transparent)",
                      }}
                    >
                      + Add to desktop
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
