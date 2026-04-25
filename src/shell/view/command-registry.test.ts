import { describe, expect, test, vi } from "vitest";
import { CommandRegistry } from "./command-registry";

function makeCmd(id: string, overrides: Record<string, unknown> = {}) {
  return { id, label: `Label ${id}`, action: vi.fn(), ...overrides };
}

describe("CommandRegistry", () => {
  describe("register", () => {
    test("stores a command", () => {
      const r = new CommandRegistry();
      r.register(makeCmd("a"));
      expect(r.getAll()).toHaveLength(1);
    });

    test("returns unregister function that removes the command", () => {
      const r = new CommandRegistry();
      const unregister = r.register(makeCmd("a"));
      unregister();
      expect(r.getAll()).toHaveLength(0);
    });

    test("overwrites command with same id", () => {
      const r = new CommandRegistry();
      r.register(makeCmd("a", { label: "First" }));
      r.register(makeCmd("a", { label: "Second" }));
      expect(r.getAll()).toHaveLength(1);
      expect(r.getAll()[0].label).toBe("Second");
    });
  });

  describe("registerMany", () => {
    test("registers all commands", () => {
      const r = new CommandRegistry();
      r.registerMany([makeCmd("a"), makeCmd("b")]);
      expect(r.getAll()).toHaveLength(2);
    });

    test("unregisters all commands via single cleanup call", () => {
      const r = new CommandRegistry();
      const unregister = r.registerMany([makeCmd("a"), makeCmd("b")]);
      unregister();
      expect(r.getAll()).toHaveLength(0);
    });
  });

  describe("search", () => {
    test("returns all commands on empty query", () => {
      const r = new CommandRegistry();
      r.registerMany([makeCmd("a"), makeCmd("b")]);
      expect(r.search("")).toHaveLength(2);
    });

    test("filters by label (case-insensitive)", () => {
      const r = new CommandRegistry();
      r.register(makeCmd("a", { label: "Open Todo" }));
      r.register(makeCmd("b", { label: "Open Pomodoro" }));
      expect(r.search("todo")).toHaveLength(1);
      expect(r.search("TODO")).toHaveLength(1);
    });

    test("filters by description", () => {
      const r = new CommandRegistry();
      r.register(makeCmd("a", { description: "Create a new task" }));
      r.register(makeCmd("b", { description: "Start the timer" }));
      expect(r.search("task")).toHaveLength(1);
    });

    test("filters by keywords", () => {
      const r = new CommandRegistry();
      r.register(makeCmd("a", { keywords: ["task", "item"] }));
      r.register(makeCmd("b", { keywords: ["timer"] }));
      expect(r.search("item")).toHaveLength(1);
    });

    test("returns empty array when nothing matches", () => {
      const r = new CommandRegistry();
      r.register(makeCmd("a", { label: "Open Todo" }));
      expect(r.search("xyzzy")).toHaveLength(0);
    });

    test("ignores leading/trailing whitespace in query", () => {
      const r = new CommandRegistry();
      r.register(makeCmd("a", { label: "Open Todo" }));
      expect(r.search("  todo  ")).toHaveLength(1);
    });
  });
});
