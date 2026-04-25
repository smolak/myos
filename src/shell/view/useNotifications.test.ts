import type { AppNotification } from "@shell/shared/notification-types";
import { act, renderHook, waitFor } from "@testing-library/react";
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

describe("useNotifications", () => {
  beforeEach(() => {
    mockGetHistory.mockResolvedValue([NOTIF_A, NOTIF_B]);
    mockMarkRead.mockResolvedValue({ success: true });
    mockClear.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("fetches history on mount", async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(mockGetHistory).toHaveBeenCalledOnce();
  });

  test("counts unread notifications", async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(result.current.unreadCount).toBe(1);
  });

  test("polls for new notifications every 5 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderHook(() => useNotifications());
      await waitFor(() => expect(mockGetHistory).toHaveBeenCalledTimes(1));

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });
      await waitFor(() => expect(mockGetHistory).toHaveBeenCalledTimes(2));

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });
      await waitFor(() => expect(mockGetHistory).toHaveBeenCalledTimes(3));
    } finally {
      vi.useRealTimers();
    }
  });

  test("markRead updates notification in state and calls RPC", async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

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
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.clearAll();
    });

    expect(mockClear).toHaveBeenCalledOnce();
    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  test("stops polling after unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result, unmount } = renderHook(() => useNotifications());
      await waitFor(() => expect(result.current.notifications).toHaveLength(2));
      unmount();

      await act(async () => {
        vi.advanceTimersByTime(15000);
        await Promise.resolve();
      });
      // Only initial call — no polling after unmount
      expect(mockGetHistory).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
