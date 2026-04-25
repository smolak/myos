import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TodoWidget } from "./TodoWidget";

vi.mock("./useTodos", () => {
  let todos: Array<{
    id: string;
    title: string;
    description: null;
    completed: boolean;
    completedAt: null;
    createdAt: string;
    updatedAt: string;
  }> = [];
  const completeMock = vi.fn((id: string) => {
    todos = todos.map((t) => (t.id === id ? { ...t, completed: true } : t));
  });
  return {
    useTodos: () => ({
      todos,
      complete: completeMock,
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    }),
    __setTodos: (next: typeof todos) => {
      todos = next;
    },
    __getCompleteMock: () => completeMock,
  };
});

function makeTodo(overrides: Partial<{ id: string; title: string; completed: boolean }> = {}) {
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "Test todo",
    description: null,
    completed: overrides.completed ?? false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("TodoWidget", () => {
  let setTodos: (todos: ReturnType<typeof makeTodo>[]) => void;
  let getCompleteMock: () => ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("./useTodos");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setTodos = (mod as any).__setTodos;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getCompleteMock = (mod as any).__getCompleteMock;
    setTodos([]);
    getCompleteMock().mockClear();
  });

  test("shows empty state when there are no active todos", () => {
    render(<TodoWidget />);
    expect(screen.getByText("No active todos")).toBeInTheDocument();
  });

  test("renders active todo titles", () => {
    setTodos([makeTodo({ title: "Buy milk" }), makeTodo({ id: "t2", title: "Read book" })]);
    render(<TodoWidget />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText("Read book")).toBeInTheDocument();
  });

  test("does not render completed todos", () => {
    setTodos([makeTodo({ title: "Active" }), makeTodo({ id: "t2", title: "Done", completed: true })]);
    render(<TodoWidget />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  test("calls onOpenFullView when View all is clicked", () => {
    const onOpenFullView = vi.fn();
    render(<TodoWidget onOpenFullView={onOpenFullView} />);
    fireEvent.click(screen.getByText("View all"));
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });

  test("calls complete when a todo's complete button is clicked", () => {
    setTodos([makeTodo({ id: "t1", title: "Buy milk" })]);
    render(<TodoWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Complete: Buy milk" }));
    expect(getCompleteMock()).toHaveBeenCalledWith("t1");
  });

  test("shows at most 5 active todos", () => {
    setTodos(Array.from({ length: 7 }, (_, i) => makeTodo({ id: `t${i}`, title: `Todo ${i}` })));
    render(<TodoWidget />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
