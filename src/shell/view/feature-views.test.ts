import { describe, expect, test, vi } from "vitest";
import {
  buildCatalogEntries,
  buildFocusCommands,
  buildNavigationCommands,
  FEATURE_VIEWS,
  type FeatureViewDescriptor,
  findFeatureView,
  MODAL_SIZE_CLASSES,
  resolveWidget,
} from "./feature-views";

const DummyWidget = () => null;
const DummyFullView = () => null;

function makeDescriptor(overrides: Partial<FeatureViewDescriptor> = {}): FeatureViewDescriptor {
  return {
    featureId: "todo",
    displayName: "Todo",
    icon: "✓",
    description: "Tasks and to-do lists",
    widgets: { "task-list": { Widget: DummyWidget, defaultW: 2, defaultH: 2 } },
    FullView: DummyFullView,
    modalSize: "compact",
    supportsFocusMode: true,
    ...overrides,
  } as FeatureViewDescriptor;
}

function makeWidgetlessDescriptor(overrides: Partial<FeatureViewDescriptor> = {}): FeatureViewDescriptor {
  const descriptor = makeDescriptor(overrides);
  const { widgets: _widgets, ...rest } = descriptor;
  return rest as FeatureViewDescriptor;
}

function makeViewlessDescriptor(overrides: Partial<FeatureViewDescriptor> = {}): FeatureViewDescriptor {
  const descriptor = makeDescriptor(overrides);
  const { FullView: _f, modalSize: _m, supportsFocusMode: _s, ...rest } = descriptor;
  return rest as FeatureViewDescriptor;
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
      [makeViewlessDescriptor({ featureId: "weather", displayName: "Weather" })],
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
        makeViewlessDescriptor({ featureId: "clock", displayName: "Clock" }),
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

describe("resolveWidget", () => {
  test("returns the widget entry matching featureId and widgetId", () => {
    const entry = resolveWidget([makeDescriptor()], "todo", "task-list");

    expect(entry?.Widget).toBe(DummyWidget);
    expect(entry).toMatchObject({ defaultW: 2, defaultH: 2 });
  });

  test("resolves among multiple widgets of the same feature", () => {
    const Second = () => null;
    const descriptor = makeDescriptor({
      widgets: {
        "task-list": { Widget: DummyWidget, defaultW: 2, defaultH: 2 },
        "quick-add": { Widget: Second, defaultW: 1, defaultH: 1 },
      },
    });

    expect(resolveWidget([descriptor], "todo", "quick-add")?.Widget).toBe(Second);
  });

  test("returns undefined for an unknown featureId", () => {
    expect(resolveWidget([makeDescriptor()], "nope", "task-list")).toBeUndefined();
  });

  test("returns undefined for an unknown widgetId", () => {
    expect(resolveWidget([makeDescriptor()], "todo", "nope")).toBeUndefined();
  });

  test("returns undefined for a descriptor without widgets", () => {
    expect(resolveWidget([makeWidgetlessDescriptor()], "todo", "task-list")).toBeUndefined();
  });
});

describe("findFeatureView", () => {
  test("returns the descriptor for a known featureId", () => {
    const descriptor = makeDescriptor({ featureId: "habits" });

    expect(findFeatureView([descriptor], "habits")).toBe(descriptor);
  });

  test("returns undefined for an unknown featureId", () => {
    expect(findFeatureView([makeDescriptor()], "nope")).toBeUndefined();
  });
});

describe("MODAL_SIZE_CLASSES", () => {
  test("maps each named size to the shell's existing class combination", () => {
    expect(MODAL_SIZE_CLASSES).toEqual({
      compact: "max-w-lg h-2/3",
      wide: "max-w-2xl h-3/4",
      tall: "max-w-lg h-3/4",
    });
  });
});

describe("buildCatalogEntries", () => {
  test("lists one entry per descriptor with at least one widget", () => {
    const entries = buildCatalogEntries([
      makeDescriptor(),
      makeWidgetlessDescriptor({ featureId: "phantom", displayName: "Phantom" }),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.featureId).toBe("todo");
  });

  test("uses the descriptor's display identity and first widget's defaults", () => {
    const entries = buildCatalogEntries([
      makeDescriptor({
        widgets: {
          "task-list": { Widget: DummyWidget, defaultW: 2, defaultH: 2 },
          "quick-add": { Widget: DummyWidget, defaultW: 1, defaultH: 1 },
        },
      }),
    ]);

    expect(entries[0]).toEqual({
      featureId: "todo",
      displayName: "Todo",
      icon: "✓",
      description: "Tasks and to-do lists",
      widgetId: "task-list",
      defaultW: 2,
      defaultH: 2,
    });
  });
});

describe("FEATURE_VIEWS", () => {
  test("lists each feature exactly once", () => {
    const ids = FEATURE_VIEWS.map((f) => f.featureId);

    expect(new Set(ids).size).toEqual(ids.length);
  });

  test("declares a modal size for every full view", () => {
    for (const descriptor of FEATURE_VIEWS.filter((d) => d.FullView)) {
      expect(descriptor.modalSize, descriptor.featureId).toBeDefined();
    }
  });

  test("declares a full view for every focus-mode feature", () => {
    for (const descriptor of FEATURE_VIEWS.filter((d) => d.supportsFocusMode)) {
      expect(descriptor.FullView, descriptor.featureId).toBeDefined();
    }
  });

  test("declares at least one widget for every feature", () => {
    for (const descriptor of FEATURE_VIEWS) {
      expect(Object.keys(descriptor.widgets ?? {}).length, descriptor.featureId).toBeGreaterThan(0);
    }
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

  test("resolves a widget for every item in the default dashboard layout", () => {
    const defaultLayout: ReadonlyArray<[string, string]> = [
      ["todo", "task-list"],
      ["pomodoro", "timer"],
      ["clock", "display"],
      ["weather", "conditions"],
      ["rss-reader", "feed-list"],
      ["daily-journal", "summary"],
      ["calendar", "upcoming-events"],
      ["habits", "daily-checkin"],
      ["bookmarks", "recent-list"],
      ["countdowns", "upcoming"],
      ["clipboard-history", "recent-clips"],
      ["snippets", "favorites"],
    ];

    for (const [featureId, widgetId] of defaultLayout) {
      expect(resolveWidget(FEATURE_VIEWS, featureId, widgetId), `${featureId}/${widgetId}`).toBeDefined();
    }
  });

  test("lists every feature in the catalog", () => {
    const entries = buildCatalogEntries(FEATURE_VIEWS);

    expect(entries).toHaveLength(FEATURE_VIEWS.length);
    for (const entry of entries) {
      expect(entry.icon).not.toEqual("");
      expect(entry.description).not.toEqual("");
    }
  });
});
