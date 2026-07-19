import type { ReactNode } from "react";
import { FEATURE_VIEWS, findFeatureView } from "./feature-views";

interface Props {
  featureId: string;
  children: ReactNode;
  onExpand?: () => void;
  onClose?: () => void;
}

export function WidgetWindow({ featureId, children, onExpand, onClose }: Props) {
  const descriptor = findFeatureView(FEATURE_VIEWS, featureId);
  const title = descriptor?.displayName ?? featureId;
  const icon = descriptor?.icon ?? "○";

  return (
    <div className="widget-window flex flex-col h-full rounded-xl overflow-hidden" data-feature={featureId}>
      {/* Title bar — also the drag handle for react-grid-layout */}
      <div className="widget-titlebar widget-drag-handle flex items-center gap-2 px-3 h-9 shrink-0 select-none">
        {/* Window control dots */}
        <div className="window-dots flex items-center gap-1.5">
          <button
            type="button"
            className="window-btn window-btn-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            aria-label="Remove from desktop"
          />
          <div className="window-btn window-btn-min" aria-hidden="true" />
          <button
            type="button"
            className="window-btn window-btn-max"
            onClick={(e) => {
              e.stopPropagation();
              onExpand?.();
            }}
            aria-label="Open full view"
          />
        </div>

        {/* Feature identity — centered */}
        <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
          <span className="text-sm leading-none" aria-hidden="true">
            {icon}
          </span>
          <span
            className="text-xs font-semibold tracking-wide truncate uppercase"
            style={{ color: "var(--feature-color)", letterSpacing: "0.06em", fontSize: "0.65rem" }}
          >
            {title}
          </span>
        </div>

        {/* Right spacer — balances the dots visually */}
        <div className="w-[52px] shrink-0" aria-hidden="true" />
      </div>

      {/* Widget content */}
      <div className="flex-1 overflow-hidden p-3 pt-2">{children}</div>
    </div>
  );
}
