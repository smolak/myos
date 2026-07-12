import { render, screen } from "@testing-library/react";
import { createContext, type ReactNode, useContext } from "react";
import { describe, expect, test } from "vitest";
import { FeatureProviders } from "./FeatureProviders";
import type { FeatureViewDescriptor } from "./feature-views";

const GreetingContext = createContext("none");

function GreetingProvider({ children }: { children: ReactNode }) {
  return <GreetingContext.Provider value="hello">{children}</GreetingContext.Provider>;
}

function GreetingRegistrar() {
  const greeting = useContext(GreetingContext);
  return <span data-testid="registrar-greeting">{greeting}</span>;
}

function GreetingConsumer() {
  const greeting = useContext(GreetingContext);
  return <span data-testid="child-greeting">{greeting}</span>;
}

function makeDescriptor(overrides: Partial<FeatureViewDescriptor>): FeatureViewDescriptor {
  return {
    featureId: "greeting",
    displayName: "Greeting",
    icon: "👋",
    description: "Says hello",
    ...overrides,
  } as FeatureViewDescriptor;
}

describe("FeatureProviders", () => {
  test("wraps children in each descriptor's provider", () => {
    render(
      <FeatureProviders descriptors={[makeDescriptor({ Provider: GreetingProvider })]}>
        <GreetingConsumer />
      </FeatureProviders>,
    );

    expect(screen.getByTestId("child-greeting")).toHaveTextContent("hello");
  });

  test("renders children unwrapped when no descriptor has a provider", () => {
    render(
      <FeatureProviders descriptors={[makeDescriptor({})]}>
        <GreetingConsumer />
      </FeatureProviders>,
    );

    expect(screen.getByTestId("child-greeting")).toHaveTextContent("none");
  });

  test("mounts command registrars inside the feature providers", () => {
    render(
      <FeatureProviders
        descriptors={[makeDescriptor({ Provider: GreetingProvider, CommandRegistrar: GreetingRegistrar })]}
      >
        <span />
      </FeatureProviders>,
    );

    expect(screen.getByTestId("registrar-greeting")).toHaveTextContent("hello");
  });

  test("mounts a registrar inside another feature's provider", () => {
    render(
      <FeatureProviders
        descriptors={[
          makeDescriptor({ featureId: "provider-only", Provider: GreetingProvider }),
          makeDescriptor({ featureId: "registrar-only", CommandRegistrar: GreetingRegistrar }),
        ]}
      >
        <span />
      </FeatureProviders>,
    );

    expect(screen.getByTestId("registrar-greeting")).toHaveTextContent("hello");
  });
});
