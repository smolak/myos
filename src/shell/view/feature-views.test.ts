import { describe, expect, test, vi } from "vitest";
import {
  buildFocusCommands,
  buildNavigationCommands,
  FEATURE_VIEWS,
  type FeatureViewDescriptor,
} from "./feature-views";

function makeDescriptor(overrides: Partial<FeatureViewDescriptor> = {}): FeatureViewDescriptor {
  return {
    featureId: "todo",
    displayName: "Todo",
    hasFullView: true,
    supportsFocusMode: true,
    ...overrides,
  };
}

describe("buildNavigationCommands", () => {
  test("generates an Open command per descriptor with a full view", () => {
    const commands = buildNavigationCommands(
      [makeDescriptor(), makeDescriptor({ featureId: "rss-reader", displayName: "RSS Reader" })],
      vi.fn(),
    );

    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatchObject({ id: "nav:todo", label: "Open Todo", group: "Navigation" });
    expect(commands[1]).toMatchObject({ id: "nav:rss-reader", label: "Open RSS Reader", group: "Navigation" });
  });

  test("skips descriptors without a full view", () => {
    const commands = buildNavigationCommands(
      [makeDescriptor({ featureId: "weather", displayName: "Weather", hasFullView: false })],
      vi.fn(),
    );

    expect(commands).toHaveLength(0);
  });

  test("opens the feature's full view when the command runs", () => {
    const openFullView = vi.fn();
    const commands = buildNavigationCommands([makeDescriptor({ featureId: "habits" })], openFullView);

    commands[0]?.action();

    expect(openFullView).toHaveBeenCalledWith("habits");
  });

  test("passes navKeywords through as search keywords", () => {
    const commands = buildNavigationCommands([makeDescriptor({ navKeywords: ["task", "tasks"] })], vi.fn());

    expect(commands[0]?.keywords).toEqual(["task", "tasks"]);
  });
});

describe("buildFocusCommands", () => {
  test("generates a Focus Mode command per descriptor that supports focus mode", () => {
    const commands = buildFocusCommands(
      [
        makeDescriptor(),
        makeDescriptor({ featureId: "clock", displayName: "Clock", supportsFocusMode: false }),
        makeDescriptor({ featureId: "snippets", displayName: "Snippets" }),
      ],
      vi.fn(),
    );

    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatchObject({ id: "focus:todo", label: "Focus Mode: Todo", group: "Focus Mode" });
    expect(commands[1]).toMatchObject({ id: "focus:snippets", label: "Focus Mode: Snippets", group: "Focus Mode" });
  });

  test("enters focus mode for the feature when the command runs", () => {
    const enterFocusMode = vi.fn();
    const commands = buildFocusCommands([makeDescriptor({ featureId: "pomodoro" })], enterFocusMode);

    commands[0]?.action();

    expect(enterFocusMode).toHaveBeenCalledWith("pomodoro");
  });

  test("includes focus keywords alongside navKeywords", () => {
    const commands = buildFocusCommands([makeDescriptor({ navKeywords: ["timer"] })], vi.fn());

    expect(commands[0]?.keywords).toEqual(expect.arrayContaining(["focus", "fullscreen", "timer"]));
  });
});

describe("FEATURE_VIEWS", () => {
  test("lists each feature exactly once", () => {
    const ids = FEATURE_VIEWS.map((f) => f.featureId);

    expect(new Set(ids).size).toEqual(ids.length);
  });

  test("does not generate a nav command for weather (no full view)", () => {
    const commands = buildNavigationCommands(FEATURE_VIEWS, vi.fn());

    expect(commands.find((c) => c.id === "nav:weather")).toBeUndefined();
  });

  test("generates nav commands for every full-view feature", () => {
    const ids = buildNavigationCommands(FEATURE_VIEWS, vi.fn()).map((c) => c.id);

    expect(ids).toEqual([
      "nav:todo",
      "nav:pomodoro",
      "nav:rss-reader",
      "nav:daily-journal",
      "nav:calendar",
      "nav:habits",
      "nav:bookmarks",
      "nav:countdowns",
      "nav:clipboard-history",
      "nav:snippets",
    ]);
  });

  test("generates focus commands for every focus-capable feature", () => {
    const ids = buildFocusCommands(FEATURE_VIEWS, vi.fn()).map((c) => c.id);

    expect(ids).toEqual([
      "focus:todo",
      "focus:pomodoro",
      "focus:rss-reader",
      "focus:daily-journal",
      "focus:calendar",
      "focus:habits",
      "focus:bookmarks",
      "focus:countdowns",
      "focus:clipboard-history",
      "focus:snippets",
    ]);
  });
});
