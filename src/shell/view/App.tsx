import { useState } from "react";
import type { DashboardPage, LayoutItem } from "@core/types";
import { DashboardGrid } from "./DashboardGrid";
import { TodoWidget } from "@features/todo/view/TodoWidget";
import { TodoFullView } from "@features/todo/view/TodoFullView";
import { PomodoroWidget } from "@features/pomodoro/view/PomodoroWidget";
import { PomodoroFullView } from "@features/pomodoro/view/PomodoroFullView";

const STORAGE_KEY = "dashboard:pages";

const DEFAULT_PAGES: DashboardPage[] = [
	{
		id: "default",
		name: "Dashboard",
		layout: [
			{ i: "todo-1", x: 0, y: 0, w: 2, h: 2, featureId: "todo", widgetId: "task-list" },
			{ i: "pomodoro-1", x: 2, y: 0, w: 2, h: 1, featureId: "pomodoro", widgetId: "timer" },
		],
		order: 0,
	},
];

function loadPages(): DashboardPage[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored) as DashboardPage[];
	} catch {
		// ignore corrupt storage
	}
	return DEFAULT_PAGES;
}

function App() {
	const [pages, setPages] = useState<DashboardPage[]>(loadPages);
	const [fullViewFeature, setFullViewFeature] = useState<string | null>(null);
	const currentPage = pages[0]!;

	function handleLayoutChange(layout: LayoutItem[]): void {
		const updated = pages.map((p) => (p.id === currentPage.id ? { ...p, layout } : p));
		setPages(updated);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
	}

	function renderWidget(item: LayoutItem) {
		if (item.featureId === "todo" && item.widgetId === "task-list") {
			return <TodoWidget onOpenFullView={() => setFullViewFeature("todo")} />;
		}
		if (item.featureId === "pomodoro" && item.widgetId === "timer") {
			return <PomodoroWidget onOpenFullView={() => setFullViewFeature("pomodoro")} />;
		}
		return (
			<span className="text-xs text-zinc-500">
				{item.featureId}/{item.widgetId}
			</span>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
			<header className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-6 py-4 backdrop-blur">
				<h1 className="text-lg font-semibold tracking-tight">MyOS</h1>
			</header>
			<main className="flex-1 overflow-auto p-4">
				<DashboardGrid
					page={currentPage}
					onLayoutChange={handleLayoutChange}
					renderWidget={renderWidget}
				/>
			</main>

			{fullViewFeature === "todo" && (
				<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
					<div className="w-full max-w-lg h-2/3 rounded-xl overflow-hidden shadow-2xl">
						<TodoFullView onClose={() => setFullViewFeature(null)} />
					</div>
				</div>
			)}
			{fullViewFeature === "pomodoro" && (
				<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
					<div className="w-full max-w-lg h-2/3 rounded-xl overflow-hidden shadow-2xl">
						<PomodoroFullView onClose={() => setFullViewFeature(null)} />
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
