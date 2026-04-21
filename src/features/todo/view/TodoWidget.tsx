import { useTodos } from "./useTodos";

interface Props {
	onOpenFullView?: () => void;
}

export function TodoWidget({ onOpenFullView }: Props) {
	const { todos, complete } = useTodos();
	const activeTodos = todos.filter((t) => !t.completed).slice(0, 5);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between mb-3">
				<h2 className="text-sm font-semibold text-zinc-200">Todos</h2>
				<button
					onClick={onOpenFullView}
					className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
				>
					View all
				</button>
			</div>
			{activeTodos.length === 0 ? (
				<p className="text-xs text-zinc-500 flex-1 flex items-center justify-center">
					No active todos
				</p>
			) : (
				<ul className="flex-1 space-y-1 overflow-hidden">
					{activeTodos.map((todo) => (
						<li key={todo.id} className="flex items-center gap-2">
							<button
								onClick={() => complete(todo.id)}
								className="w-3.5 h-3.5 rounded-full border border-zinc-500 shrink-0 hover:border-zinc-300 hover:bg-zinc-700 transition-colors"
								aria-label={`Complete: ${todo.title}`}
							/>
							<span className="text-xs text-zinc-300 truncate">{todo.title}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
