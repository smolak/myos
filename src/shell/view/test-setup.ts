import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";

// Promote React's act() warning to a hard failure so it surfaces in every reporter.
// biome-ignore lint: intentional console.error interception in test setup
const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : "";
  if (msg.includes("not wrapped in act(")) {
    throw new Error(args.map(String).join(" "));
  }
  originalError(...args);
};

afterEach(() => {
  vi.restoreAllMocks();
});

// jsdom does not implement matchMedia — provide a minimal stub
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
