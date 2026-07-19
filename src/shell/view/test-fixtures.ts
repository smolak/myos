import type { ComponentType, ReactNode } from "react";
import type { FeatureViewDescriptor, WidgetDescriptor } from "./feature-views";

export const DummyWidget = () => null;
export const DummyFullView = () => null;

export interface DescriptorOptions {
  featureId?: string;
  displayName?: string;
  icon?: string;
  description?: string;
  widgets?: Readonly<Record<string, WidgetDescriptor>>;
  navKeywords?: readonly string[];
  Provider?: ComponentType<{ children: ReactNode }>;
  CommandRegistrar?: ComponentType;
}

function makeIdentity(overrides: DescriptorOptions) {
  return {
    featureId: overrides.featureId ?? "todo",
    displayName: overrides.displayName ?? "Todo",
    icon: overrides.icon ?? "✓",
    description: overrides.description ?? "Tasks and to-do lists",
    navKeywords: overrides.navKeywords,
    Provider: overrides.Provider,
    CommandRegistrar: overrides.CommandRegistrar,
  };
}

export function makeDescriptor(overrides: DescriptorOptions = {}): FeatureViewDescriptor {
  return {
    ...makeIdentity(overrides),
    widgets: overrides.widgets ?? { "task-list": { Widget: DummyWidget, defaultW: 2, defaultH: 2 } },
    FullView: DummyFullView,
    modalSize: "compact",
    supportsFocusMode: true,
  };
}

export function makeWidgetlessDescriptor(overrides: DescriptorOptions = {}): FeatureViewDescriptor {
  return {
    ...makeIdentity(overrides),
    FullView: DummyFullView,
    modalSize: "compact",
    supportsFocusMode: true,
  };
}

export function makeViewlessDescriptor(overrides: DescriptorOptions = {}): FeatureViewDescriptor {
  return {
    ...makeIdentity(overrides),
    widgets: overrides.widgets ?? { "task-list": { Widget: DummyWidget, defaultW: 2, defaultH: 2 } },
  };
}
