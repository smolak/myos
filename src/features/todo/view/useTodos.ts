import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import type { TodoItem } from "../shared/types";

const STORAGE_KEY = "todo:items";

function loadTodos(): TodoItem[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored) as TodoItem[];
	} catch {
		// ignore corrupt storage
	}
	return [];
}

function persist(todos: TodoItem[]): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

export interface UseTodosReturn {
	readonly todos: readonly TodoItem[];
	create(title: string, description?: string): void;
	update(id: string, changes: { title?: string; description?: string }): void;
	complete(id: string): void;
	remove(id: string): void;
}

export function useTodos(): UseTodosReturn {
	const [todos, setTodos] = useState<TodoItem[]>(loadTodos);

	const mutate = useCallback((updater: (prev: TodoItem[]) => TodoItem[]) => {
		setTodos((prev) => {
			const next = updater(prev);
			persist(next);
			return next;
		});
	}, []);

	const create = useCallback(
		(title: string, description?: string) => {
			const now = new Date().toISOString();
			const item: TodoItem = {
				id: nanoid(),
				title,
				description: description ?? null,
				completed: false,
				completedAt: null,
				createdAt: now,
				updatedAt: now,
			};
			mutate((prev) => [item, ...prev]);
		},
		[mutate],
	);

	const update = useCallback(
		(id: string, changes: { title?: string; description?: string }) => {
			mutate((prev) =>
				prev.map((t) =>
					t.id === id ? { ...t, ...changes, updatedAt: new Date().toISOString() } : t,
				),
			);
		},
		[mutate],
	);

	const complete = useCallback(
		(id: string) => {
			const now = new Date().toISOString();
			mutate((prev) =>
				prev.map((t) =>
					t.id === id ? { ...t, completed: true, completedAt: now, updatedAt: now } : t,
				),
			);
		},
		[mutate],
	);

	const remove = useCallback(
		(id: string) => {
			mutate((prev) => prev.filter((t) => t.id !== id));
		},
		[mutate],
	);

	return { todos, create, update, complete, remove };
}
