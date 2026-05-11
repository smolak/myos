import type { ReactNode } from "react";

export interface FeatureMeta {
  title: string;
  icon: string;
  description: string;
  widgetId: string;
  defaultW: number;
  defaultH: number;
}

export const FEATURE_META: Record<string, FeatureMeta> = {
  todo: {
    title: "Todo",
    icon: "✓",
    description: "Tasks and to-do lists",
    widgetId: "task-list",
    defaultW: 2,
    defaultH: 2,
  },
  pomodoro: {
    title: "Pomodoro",
    icon: "⏱",
    description: "Focus timer sessions",
    widgetId: "timer",
    defaultW: 2,
    defaultH: 1,
  },
  clock: {
    title: "Clock",
    icon: "🕐",
    description: "Current time display",
    widgetId: "display",
    defaultW: 1,
    defaultH: 1,
  },
  weather: {
    title: "Weather",
    icon: "⛅",
    description: "Temperature and conditions",
    widgetId: "conditions",
    defaultW: 1,
    defaultH: 1,
  },
  "rss-reader": {
    title: "RSS Reader",
    icon: "📡",
    description: "News feeds and articles",
    widgetId: "feed-list",
    defaultW: 4,
    defaultH: 2,
  },
  calendar: {
    title: "Calendar",
    icon: "📅",
    description: "Events and schedule",
    widgetId: "upcoming-events",
    defaultW: 2,
    defaultH: 2,
  },
  "daily-journal": {
    title: "Daily Journal",
    icon: "📓",
    description: "Activity log and notes",
    widgetId: "summary",
    defaultW: 2,
    defaultH: 2,
  },
  habits: {
    title: "Habits",
    icon: "🎯",
    description: "Daily habit tracking",
    widgetId: "daily-checkin",
    defaultW: 2,
    defaultH: 1,
  },
  bookmarks: {
    title: "Bookmarks",
    icon: "🔖",
    description: "Saved links and URLs",
    widgetId: "recent-list",
    defaultW: 2,
    defaultH: 1,
  },
  countdowns: {
    title: "Countdowns",
    icon: "⏳",
    description: "Timers to important dates",
    widgetId: "upcoming",
    defaultW: 2,
    defaultH: 1,
  },
  "clipboard-history": {
    title: "Clipboard",
    icon: "📋",
    description: "Recent clipboard entries",
    widgetId: "recent-clips",
    defaultW: 2,
    defaultH: 1,
  },
  snippets: {
    title: "Snippets",
    icon: "✂️",
    description: "Reusable text templates",
    widgetId: "favorites",
    defaultW: 2,
    defaultH: 1,
  },
};

interface Props {
  featureId: string;
  children: ReactNode;
  onExpand?: () => void;
  onClose?: () => void;
}

export function WidgetWindow({ featureId, children, onExpand, onClose }: Props) {
  const meta = FEATURE_META[featureId];
  const title = meta?.title ?? featureId;
  const icon = meta?.icon ?? "○";

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
