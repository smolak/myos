import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockGetOptions = vi.fn();
const mockUpdateOptions = vi.fn();

vi.mock("./electrobun", () => ({
  rpc: {
    request: {
      "app:get-options": (...args: unknown[]) => mockGetOptions(...args),
      "app:update-options": (...args: unknown[]) => mockUpdateOptions(...args),
    },
  },
}));

const { useAppOptions } = await import("./useAppOptions");

describe("useAppOptions", () => {
  beforeEach(() => {
    mockGetOptions.mockResolvedValue({ background: null });
    mockUpdateOptions.mockResolvedValue({ success: true });
    document.documentElement.style.removeProperty("--user-bg");
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.documentElement.style.removeProperty("--user-bg");
  });

  test("loads initial background (null) from RPC on mount", async () => {
    const { result } = renderHook(() => useAppOptions());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.background).toBeNull();
  });

  test("does not set --user-bg when background is null", async () => {
    const { result } = renderHook(() => useAppOptions());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(document.documentElement.style.getPropertyValue("--user-bg")).toBe("");
  });

  test("applies solid color as --user-bg CSS variable on load", async () => {
    mockGetOptions.mockResolvedValue({ background: { type: "solid", color: "#ff0000" } });
    const { result } = renderHook(() => useAppOptions());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(document.documentElement.style.getPropertyValue("--user-bg")).toBe("#ff0000");
  });

  test("applies gradient preset as --user-bg CSS variable on load", async () => {
    mockGetOptions.mockResolvedValue({ background: { type: "gradient", preset: "midnight-blue" } });
    const { result } = renderHook(() => useAppOptions());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(document.documentElement.style.getPropertyValue("--user-bg")).toContain("linear-gradient");
  });

  test("setBackground updates state, sets --user-bg, and calls RPC", async () => {
    const { result } = renderHook(() => useAppOptions());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.setBackground({ type: "solid", color: "#1a1a2e" });
    });

    expect(result.current.background).toEqual({ type: "solid", color: "#1a1a2e" });
    expect(document.documentElement.style.getPropertyValue("--user-bg")).toBe("#1a1a2e");
    expect(mockUpdateOptions).toHaveBeenCalledWith({ background: { type: "solid", color: "#1a1a2e" } });
  });

  test("setBackground with gradient preset sets --user-bg and calls RPC", async () => {
    const { result } = renderHook(() => useAppOptions());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.setBackground({ type: "gradient", preset: "dark-ocean" });
    });

    expect(result.current.background).toEqual({ type: "gradient", preset: "dark-ocean" });
    expect(document.documentElement.style.getPropertyValue("--user-bg")).toContain("linear-gradient");
    expect(mockUpdateOptions).toHaveBeenCalledWith({ background: { type: "gradient", preset: "dark-ocean" } });
  });

  test("setBackground(null) removes --user-bg and calls RPC", async () => {
    mockGetOptions.mockResolvedValue({ background: { type: "solid", color: "#ff0000" } });
    const { result } = renderHook(() => useAppOptions());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.setBackground(null);
    });

    expect(result.current.background).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--user-bg")).toBe("");
    expect(mockUpdateOptions).toHaveBeenCalledWith({ background: undefined });
  });

  test("loaded is false before RPC resolves", () => {
    mockGetOptions.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAppOptions());
    expect(result.current.loaded).toBe(false);
  });
});
