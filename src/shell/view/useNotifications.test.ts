import type { AppNotification } from "@shell/shared/notification-types";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockGetHistory = vi.fn();
const mockMarkRead = vi.fn();
const mockClear = vi.fn();

vi.mock("./electrobun", () => ({
  rpc: {
    request: {
      "notification:get-history": (...args: unknown[]) => mockGetHistory(...args),
      "notification:mark-read": (...args: unknown[]) => mockMarkRead(...args),
      "notification:clear": (...args: unknown[]) => mockClear(...args),
    },
  },
}));

const { useNotifications } = await import("./useNotifications");

const NOTIF_A: AppNotification = {
  id: "a",
  title: "Pomodoro ended",
  body: "Time for a break!",
  featureId: "pomodoro",
  timestamp: 1000,
  read: false,
};

const NOTIF_B: AppNotification = {
  id: "b",
  title: "Todo completed",
  body: "Buy groceries",
  featureId: "todo",
  timestamp: 2000,
  read: true,
};

// Flush all pending promises without advancing the fake clock.
const flushPromises = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

describe("useNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetHistory.mockResolvedValue([NOTIF_A, NOTIF_B]);
    mockMarkRead.mockResolvedValue({ success: true });
    mockClear.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("fetches history on mount", async () => {
    const { result } = renderHook(() => useNotifications());
    await flushPromises();
    expect(result.current.notifications).toHaveLength(2);
    expect(mockGetHistory).toHaveBeenCalledOnce();
  });

  test("counts unread notifications", async () => {
    const { result } = renderHook(() => useNotifications());
    await flushPromises();
    expect(result.current.unreadCount).toBe(1);
  });

  test("polls for new notifications every 5 seconds", async () => {
    renderHook(() => useNotifications());
    await flushPromises();
    expect(mockGetHistory).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mockGetHistory).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mockGetHistory).toHaveBeenCalledTimes(3);
  });

  test("markRead updates notification in state and calls RPC", async () => {
    const { result } = renderHook(() => useNotifications());
    await flushPromises();

    await act(async () => {
      await result.current.markRead("a");
    });

    expect(mockMarkRead).toHaveBeenCalledWith({ id: "a" });
    const notif = result.current.notifications.find((n) => n.id === "a");
    expect(notif?.read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  test("clearAll removes all notifications and calls RPC", async () => {
    const { result } = renderHook(() => useNotifications());
    await flushPromises();

    await act(async () => {
      await result.current.clearAll();
    });

    expect(mockClear).toHaveBeenCalledOnce();
    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  test("stops polling after unmount", async () => {
    const { result, unmount } = renderHook(() => useNotifications());
    await flushPromises();
    expect(result.current.notifications).toHaveLength(2);
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    // Only initial call — no polling after unmount
    expect(mockGetHistory).toHaveBeenCalledTimes(1);
  });
});
