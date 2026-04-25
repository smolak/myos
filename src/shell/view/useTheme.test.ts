import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("./electrobun", () => ({
  rpc: {
    request: {
      "theme:get": (...args: unknown[]) => mockGet(...args),
      "theme:update": (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// Must import after mock is set up
const { useTheme } = await import("./useTheme");

describe("useTheme", () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({ mode: "dark", accentColor: "#6366f1" });
    mockUpdate.mockResolvedValue({ success: true });
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-effective-theme");
    document.documentElement.style.removeProperty("--accent-color");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("loads initial theme from RPC on mount", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.mode).toBe("dark");
    expect(result.current.accentColor).toBe("#6366f1");
  });

  test("applies data-theme and data-effective-theme attributes on load", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-effective-theme")).toBe("dark");
  });

  test("applies accent color as CSS variable on load", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#6366f1");
  });

  test("loads light theme when stored setting is light", async () => {
    mockGet.mockResolvedValue({ mode: "light", accentColor: "#f59e0b" });
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.mode).toBe("light");
    expect(document.documentElement.getAttribute("data-effective-theme")).toBe("light");
  });

  test("setMode updates state, applies theme, and calls RPC", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.setMode("light");
    });

    expect(result.current.mode).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-effective-theme")).toBe("light");
    expect(mockUpdate).toHaveBeenCalledWith({ mode: "light" });
  });

  test("setAccentColor updates state, applies CSS var, and calls RPC", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.setAccentColor("#ec4899");
    });

    expect(result.current.accentColor).toBe("#ec4899");
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#ec4899");
    expect(mockUpdate).toHaveBeenCalledWith({ accentColor: "#ec4899" });
  });

  test("system mode resolves effective theme based on media query", async () => {
    mockGet.mockResolvedValue({ mode: "system", accentColor: "#6366f1" });
    // jsdom defaults to no dark mode preference → effective = light
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.mode).toBe("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("system");
    // In jsdom, prefers-color-scheme: dark is false → effective is light
    expect(document.documentElement.getAttribute("data-effective-theme")).toBe("light");
  });
});
