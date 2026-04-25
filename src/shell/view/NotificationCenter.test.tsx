import type { AppNotification } from "@shell/shared/notification-types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { NotificationCenter } from "./NotificationCenter";

const NOTIF_UNREAD: AppNotification = {
  id: "n1",
  title: "Pomodoro ended",
  body: "Time for a break!",
  featureId: "pomodoro",
  timestamp: Date.now() - 60_000,
  read: false,
};

const NOTIF_READ: AppNotification = {
  id: "n2",
  title: "Todo completed",
  body: "Buy groceries",
  featureId: "todo",
  timestamp: Date.now() - 120_000,
  read: true,
};

describe("NotificationCenter", () => {
  test("renders bell button", () => {
    render(<NotificationCenter notifications={[]} unreadCount={0} onMarkRead={vi.fn()} onClearAll={vi.fn()} />);
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });

  test("shows unread badge when there are unread notifications", () => {
    render(
      <NotificationCenter notifications={[NOTIF_UNREAD]} unreadCount={1} onMarkRead={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  test("does not show badge when no unread notifications", () => {
    render(
      <NotificationCenter notifications={[NOTIF_READ]} unreadCount={0} onMarkRead={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  test("panel is hidden by default", () => {
    render(
      <NotificationCenter notifications={[NOTIF_UNREAD]} unreadCount={1} onMarkRead={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  test("clicking bell opens notification panel", () => {
    render(
      <NotificationCenter notifications={[NOTIF_UNREAD]} unreadCount={1} onMarkRead={vi.fn()} onClearAll={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  test("shows notification titles in panel", () => {
    render(
      <NotificationCenter
        notifications={[NOTIF_UNREAD, NOTIF_READ]}
        unreadCount={1}
        onMarkRead={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText("Pomodoro ended")).toBeInTheDocument();
    expect(screen.getByText("Todo completed")).toBeInTheDocument();
  });

  test("shows empty state when no notifications", () => {
    render(<NotificationCenter notifications={[]} unreadCount={0} onMarkRead={vi.fn()} onClearAll={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
  });

  test("clicking a notification calls onMarkRead", () => {
    const onMarkRead = vi.fn();
    render(
      <NotificationCenter
        notifications={[NOTIF_UNREAD]}
        unreadCount={1}
        onMarkRead={onMarkRead}
        onClearAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    fireEvent.click(screen.getByText("Pomodoro ended"));
    expect(onMarkRead).toHaveBeenCalledWith("n1");
  });

  test("clear all button calls onClearAll", () => {
    const onClearAll = vi.fn();
    render(
      <NotificationCenter
        notifications={[NOTIF_UNREAD]}
        unreadCount={1}
        onMarkRead={vi.fn()}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});
