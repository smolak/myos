import { useRssReader } from "./useRssReader";
import type { StoredEntry } from "./useRssReader";

interface Props {
	onOpenFullView?: () => void;
}

function formatDate(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EntryRow({ entry, onRead }: { entry: StoredEntry; onRead: (id: string) => void }) {
	return (
		<li className="flex items-start gap-2 py-1.5 border-b border-zinc-800 last:border-0">
			<div className="flex-1 min-w-0">
				<a
					href={entry.link}
					target="_blank"
					rel="noreferrer"
					onClick={() => onRead(entry.id)}
					className={`text-xs truncate block hover:text-zinc-200 transition-colors ${
						entry.isRead ? "text-zinc-600" : "text-zinc-300"
					}`}
					aria-label={entry.title}
				>
					{entry.title}
				</a>
				{entry.publishedAt && (
					<span className="text-xs text-zinc-600">{formatDate(entry.publishedAt)}</span>
				)}
			</div>
			{!entry.isRead && (
				<span className="w-1.5 h-1.5 mt-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden />
			)}
		</li>
	);
}

export function RssReaderWidget({ onOpenFullView }: Props) {
	const { entries, unreadCount, isLoading, feeds, markRead } = useRssReader();

	const recentEntries = entries.slice(0, 5);
	const isEmpty = feeds.length === 0;

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-semibold text-zinc-200">RSS Reader</h2>
					{unreadCount > 0 && (
						<span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">
							{unreadCount}
						</span>
					)}
				</div>
				<button
					onClick={onOpenFullView}
					className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
				>
					Open
				</button>
			</div>

			{isLoading && (
				<p className="text-xs text-zinc-500 mb-1">Fetching feeds…</p>
			)}

			{isEmpty ? (
				<div
					className="flex flex-1 items-center justify-center cursor-pointer"
					onClick={onOpenFullView}
					role="button"
					tabIndex={0}
					onKeyDown={(e) => e.key === "Enter" && onOpenFullView?.()}
					aria-label="Open RSS Reader to add feeds"
				>
					<p className="text-xs text-zinc-600 text-center">
						No feeds configured.
						<br />
						Click to add feeds.
					</p>
				</div>
			) : recentEntries.length === 0 ? (
				<p className="text-xs text-zinc-600 text-center flex-1 flex items-center justify-center">
					No entries yet
				</p>
			) : (
				<ul className="flex-1 overflow-hidden">
					{recentEntries.map((entry) => (
						<EntryRow key={entry.id} entry={entry} onRead={markRead} />
					))}
				</ul>
			)}
		</div>
	);
}
