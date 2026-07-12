import { RssReaderCommandRegistrar } from "@features/rss-reader/view/RssReaderCommandRegistrar";
import { SnippetsCommandRegistrar } from "@features/snippets/view/SnippetsCommandRegistrar";
import type { ComponentType } from "react";
import type { Command } from "./command-registry";

// One entry per feature. The shell maps over this list to generate nav/focus
// palette commands and to mount each feature's CommandRegistrar.
export interface FeatureViewDescriptor {
  readonly featureId: string;
  readonly displayName: string;
  readonly hasFullView: boolean;
  readonly supportsFocusMode: boolean;
  readonly navKeywords?: readonly string[];
  readonly CommandRegistrar?: ComponentType;
}

export const FEATURE_VIEWS: readonly FeatureViewDescriptor[] = [
  {
    featureId: "todo",
    displayName: "Todo",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["task", "tasks"],
  },
  {
    featureId: "pomodoro",
    displayName: "Pomodoro",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["timer", "focus", "session"],
  },
  {
    featureId: "rss-reader",
    displayName: "RSS Reader",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["feed", "articles", "news"],
    CommandRegistrar: RssReaderCommandRegistrar,
  },
  {
    featureId: "clock",
    displayName: "Clock",
    hasFullView: false,
    supportsFocusMode: false,
  },
  {
    featureId: "weather",
    displayName: "Weather",
    hasFullView: false,
    supportsFocusMode: false,
    navKeywords: ["forecast", "temperature"],
  },
  {
    featureId: "daily-journal",
    displayName: "Daily Journal",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["journal", "diary", "notes", "timeline"],
  },
  {
    featureId: "calendar",
    displayName: "Calendar",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["calendar", "events", "schedule", "ics"],
  },
  {
    featureId: "habits",
    displayName: "Habits",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["habits", "streak", "daily", "routine"],
  },
  {
    featureId: "bookmarks",
    displayName: "Bookmarks",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["bookmark", "link", "url", "save"],
  },
  {
    featureId: "countdowns",
    displayName: "Countdowns",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["countdown", "timer", "date", "event"],
  },
  {
    featureId: "clipboard-history",
    displayName: "Clipboard History",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["clipboard", "copy", "paste", "history"],
  },
  {
    featureId: "snippets",
    displayName: "Snippets",
    hasFullView: true,
    supportsFocusMode: true,
    navKeywords: ["snippet", "template", "text", "expand"],
    CommandRegistrar: SnippetsCommandRegistrar,
  },
];

export function buildNavigationCommands(
  descriptors: readonly FeatureViewDescriptor[],
  openFullView: (featureId: string) => void,
): Command[] {
  return descriptors
    .filter((d) => d.hasFullView)
    .map((d) => ({
      id: `nav:${d.featureId}`,
      label: `Open ${d.displayName}`,
      group: "Navigation",
      keywords: [...(d.navKeywords ?? [])],
      action: () => openFullView(d.featureId),
    }));
}

export function buildFocusCommands(
  descriptors: readonly FeatureViewDescriptor[],
  enterFocusMode: (featureId: string) => void,
): Command[] {
  return descriptors
    .filter((d) => d.supportsFocusMode)
    .map((d) => ({
      id: `focus:${d.featureId}`,
      label: `Focus Mode: ${d.displayName}`,
      description: `Open ${d.displayName} in full-screen focus mode`,
      group: "Focus Mode",
      keywords: ["focus", "fullscreen", ...(d.navKeywords ?? [])],
      action: () => enterFocusMode(d.featureId),
    }));
}
