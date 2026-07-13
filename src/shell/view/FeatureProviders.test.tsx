import { render, screen } from "@testing-library/react";
import { createContext, type ReactNode, useContext } from "react";
import { describe, expect, test } from "vitest";
import { FeatureProviders } from "./FeatureProviders";
import { makeDescriptor } from "./test-fixtures";

const GreetingContext = createContext("no greeting provided");

function GreetingProvider({ children }: { children: ReactNode }) {
  return <GreetingContext.Provider value="hello from provider">{children}</GreetingContext.Provider>;
}

function GreetingRegistrar() {
  const greeting = useContext(GreetingContext);
  return <span>registrar saw: {greeting}</span>;
}

function GreetingConsumer() {
  const greeting = useContext(GreetingContext);
  return <span>child saw: {greeting}</span>;
}

describe("FeatureProviders", () => {
  test("wraps children in each descriptor's provider", () => {
    render(
      <FeatureProviders descriptors={[makeDescriptor({ Provider: GreetingProvider })]}>
        <GreetingConsumer />
      </FeatureProviders>,
    );

    expect(screen.getByText("child saw: hello from provider")).toBeInTheDocument();
  });

  test("renders children unwrapped when no descriptor has a provider", () => {
    render(
      <FeatureProviders descriptors={[makeDescriptor()]}>
        <GreetingConsumer />
      </FeatureProviders>,
    );

    expect(screen.getByText("child saw: no greeting provided")).toBeInTheDocument();
  });

  test("mounts command registrars inside the feature providers", () => {
    render(
      <FeatureProviders
        descriptors={[makeDescriptor({ Provider: GreetingProvider, CommandRegistrar: GreetingRegistrar })]}
      >
        <span />
      </FeatureProviders>,
    );

    expect(screen.getByText("registrar saw: hello from provider")).toBeInTheDocument();
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

    expect(screen.getByText("registrar saw: hello from provider")).toBeInTheDocument();
  });
});
