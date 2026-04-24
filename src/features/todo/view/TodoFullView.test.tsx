import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { TodoFullView } from "./TodoFullView";

const mockCreate = vi.fn();
const mockComplete = vi.fn();
const mockRemove = vi.fn();
const mockUpdate = vi.fn();

let currentTodos: Array<{
  id: string;
  title: string;
  description: null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}> = [];

vi.mock("./useTodos", () => ({
  useTodos: () => ({
    todos: currentTodos,
    create: mockCreate,
    complete: mockComplete,
    remove: mockRemove,
    update: mockUpdate,
  }),
}));

function makeTodo(
  overrides: Partial<{ id: string; title: string; completed: boolean; completedAt: string | null }> = {},
) {
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "Test todo",
    description: null,
    completed: overrides.completed ?? false,
    completedAt: overrides.completedAt ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("TodoFullView", () => {
  beforeEach(() => {
    currentTodos = [];
    mockCreate.mockClear();
    mockComplete.mockClear();
    mockRemove.mockClear();
    mockUpdate.mockClear();
  });

  test("shows empty state when there are no todos", () => {
    render(<TodoFullView />);
    expect(screen.getByText("No todos yet. Add one above!")).toBeInTheDocument();
  });

  test("adds a todo when form is submitted", () => {
    render(<TodoFullView />);
    const input = screen.getByPlaceholderText("Add a todo...");
    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.submit(input.closest("form")!);
    expect(mockCreate).toHaveBeenCalledWith("Buy milk");
  });

  test("does not add an empty todo", () => {
    render(<TodoFullView />);
    fireEvent.submit(screen.getByPlaceholderText("Add a todo...").closest("form")!);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("clears the input after adding a todo", () => {
    render(<TodoFullView />);
    const input = screen.getByPlaceholderText("Add a todo...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.submit(input.closest("form")!);
    expect(input.value).toBe("");
  });

  test("renders active todos in the Active section", () => {
    currentTodos = [makeTodo({ title: "Buy milk" })];
    render(<TodoFullView />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
  });

  test("renders completed todos in the Completed section", () => {
    currentTodos = [makeTodo({ id: "t1", title: "Done task", completed: true, completedAt: new Date().toISOString() })];
    render(<TodoFullView />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Done task")).toBeInTheDocument();
  });

  test("calls complete when complete button is clicked", () => {
    currentTodos = [makeTodo({ id: "t1", title: "Task" })];
    render(<TodoFullView />);
    fireEvent.click(screen.getByRole("button", { name: "Complete: Task" }));
    expect(mockComplete).toHaveBeenCalledWith("t1");
  });

  test("calls remove when delete button is clicked", () => {
    currentTodos = [makeTodo({ id: "t1", title: "Task" })];
    render(<TodoFullView />);
    fireEvent.click(screen.getByRole("button", { name: "Delete: Task" }));
    expect(mockRemove).toHaveBeenCalledWith("t1");
  });

  test("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<TodoFullView onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("does not show Close button when onClose is not provided", () => {
    render(<TodoFullView />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});
