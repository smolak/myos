import { useState } from "react";
import type { DashboardPage, LayoutItem } from "@core/types";
import { DashboardGrid } from "./DashboardGrid";

const STORAGE_KEY = "dashboard:pages";

const DEFAULT_PAGES: DashboardPage[] = [
	{ id: "default", name: "Dashboard", layout: [], order: 0 },
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
	const currentPage = pages[0]!;

	function handleLayoutChange(layout: LayoutItem[]): void {
		const updated = pages.map((p) => (p.id === currentPage.id ? { ...p, layout } : p));
		setPages(updated);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
	}

	return (
		<div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
			<header className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-6 py-4 backdrop-blur">
				<h1 className="text-lg font-semibold tracking-tight">MyOS</h1>
			</header>
			<main className="flex-1 overflow-auto p-4">
				<DashboardGrid page={currentPage} onLayoutChange={handleLayoutChange} />
			</main>
		</div>
	);
}

export default App;
