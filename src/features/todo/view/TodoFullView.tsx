import { useState } from "react";
import { useTodos } from "./useTodos";
import type { TodoItem } from "../shared/types";

interface Props {
	onClose?: () => void;
}

export function TodoFullView({ onClose }: Props) {
	const { todos, create, update, complete, remove } = useTodos();
	const [newTitle, setNewTitle] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState("");

	function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		const title = newTitle.trim();
		if (!title) return;
		create(title);
		setNewTitle("");
	}

	function startEdit(todo: TodoItem) {
		setEditingId(todo.id);
		setEditTitle(todo.title);
	}

	function commitEdit() {
		if (!editingId) return;
		const title = editTitle.trim();
		if (title) update(editingId, { title });
		setEditingId(null);
	}

	function handleEditKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") commitEdit();
		if (e.key === "Escape") setEditingId(null);
	}

	const activeTodos = todos.filter((t) => !t.completed);
	const completedTodos = todos.filter((t) => t.completed);

	return (
		<div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
			<div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
				<h2 className="text-lg font-semibold">Todos</h2>
				{onClose && (
					<button
						onClick={onClose}
						className="text-zinc-400 hover:text-zinc-200 text-sm"
						aria-label="Close"
					>
						Close
					</button>
				)}
			</div>

			<div className="flex-1 overflow-auto p-6">
				<form onSubmit={handleAdd} className="flex gap-2 mb-6">
					<input
						type="text"
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
						placeholder="Add a todo..."
						className="flex-1 bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500"
					/>
					<button
						type="submit"
						className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded text-sm transition-colors"
					>
						Add
					</button>
				</form>

				{activeTodos.length > 0 && (
					<section className="mb-6">
						<h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
							Active
						</h3>
						<ul className="space-y-2">
							{activeTodos.map((todo) => (
								<li key={todo.id} className="flex items-center gap-3 group">
									<button
										onClick={() => complete(todo.id)}
										className="w-4 h-4 rounded-full border border-zinc-500 shrink-0 hover:border-zinc-300 hover:bg-zinc-700 transition-colors"
										aria-label={`Complete: ${todo.title}`}
									/>
									{editingId === todo.id ? (
										<input
											type="text"
											value={editTitle}
											onChange={(e) => setEditTitle(e.target.value)}
											onBlur={commitEdit}
											onKeyDown={handleEditKeyDown}
											className="flex-1 bg-zinc-800 rounded px-2 py-1 text-sm outline-none border border-zinc-600"
											autoFocus
										/>
									) : (
										<span
											onDoubleClick={() => startEdit(todo)}
											className="flex-1 text-sm text-zinc-200 cursor-default"
										>
											{todo.title}
										</span>
									)}
									<button
										onClick={() => remove(todo.id)}
										className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 text-xs transition-all"
										aria-label={`Delete: ${todo.title}`}
									>
										✕
									</button>
								</li>
							))}
						</ul>
					</section>
				)}

				{completedTodos.length > 0 && (
					<section>
						<h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
							Completed
						</h3>
						<ul className="space-y-2">
							{completedTodos.map((todo) => (
								<li key={todo.id} className="flex items-center gap-3 group">
									<div className="w-4 h-4 rounded-full bg-zinc-600 shrink-0 flex items-center justify-center">
										<span className="text-zinc-300 text-xs">✓</span>
									</div>
									<span className="flex-1 text-sm text-zinc-500 line-through">{todo.title}</span>
									<button
										onClick={() => remove(todo.id)}
										className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 text-xs transition-all"
										aria-label={`Delete: ${todo.title}`}
									>
										✕
									</button>
								</li>
							))}
						</ul>
					</section>
				)}

				{todos.length === 0 && (
					<p className="text-center text-zinc-500 text-sm py-12">
						No todos yet. Add one above!
					</p>
				)}
			</div>
		</div>
	);
}
