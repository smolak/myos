import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { Command } from "./command-registry";
import { commandRegistry } from "./command-registry";
import { useRegisterCommand } from "./useRegisterCommand";

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: "test:command",
    label: "Test Command",
    action: vi.fn(),
    ...overrides,
  };
}

describe("useRegisterCommand", () => {
  test("registers the command on mount", () => {
    const { unmount } = renderHook(() => useRegisterCommand(makeCommand()));

    expect(commandRegistry.getAll().find((c) => c.id === "test:command")).toBeDefined();
    unmount();
  });

  test("unregisters the command on unmount", () => {
    const { unmount } = renderHook(() => useRegisterCommand(makeCommand()));

    unmount();

    expect(commandRegistry.getAll().find((c) => c.id === "test:command")).toBeUndefined();
  });

  test("invokes the latest action closure after a rerender", () => {
    const staleAction = vi.fn();
    const freshAction = vi.fn();
    const { rerender, unmount } = renderHook(({ action }) => useRegisterCommand(makeCommand({ action })), {
      initialProps: { action: staleAction },
    });

    rerender({ action: freshAction });
    commandRegistry
      .getAll()
      .find((c) => c.id === "test:command")
      ?.action();

    expect(staleAction).not.toHaveBeenCalled();
    expect(freshAction).toHaveBeenCalledTimes(1);
    unmount();
  });
});
