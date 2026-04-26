import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";

// Prevent electrobun/view from creating a WebSocket at module load time.
// window.__electrobunRpcSocketPort and __electrobunWebviewId are undefined in
// jsdom, so the URL "ws://localhost:undefined/..." is invalid and throws.
// Mocking the package here stubs Electroview for all test files globally, so
// individual tests don't need to mock @shell/view/electrobun themselves.
vi.mock("electrobun/view", () => {
  function Electroview(_config?: unknown) {}
  Electroview.defineRPC = vi.fn().mockReturnValue({
    request: new Proxy(
      {},
      {
        get: (_t, method) => vi.fn().mockResolvedValue(undefined).mockName(String(method)),
      },
    ),
    setTransport: vi.fn(),
  });
  return { Electroview };
});

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
