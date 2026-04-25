import { useState } from "react";
import type { StoredEntry, StoredFeed } from "./useRssReader";
import { useRssReader } from "./useRssReader";

interface Props {
  onClose?: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EntryItem({
  entry,
  onMarkRead,
  onMarkUnread,
}: {
  entry: StoredEntry;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
}) {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-zinc-800 last:border-0">
      {!entry.isRead && <span className="w-1.5 h-1.5 mt-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden />}
      {entry.isRead && <span className="w-1.5 mt-1.5 shrink-0" aria-hidden />}
      <div className="flex-1 min-w-0">
        <a
          href={entry.link}
          target="_blank"
          rel="noreferrer"
          onClick={() => onMarkRead(entry.id)}
          className={`text-sm block hover:text-zinc-200 transition-colors leading-snug ${
            entry.isRead ? "text-zinc-600" : "text-zinc-200"
          }`}
        >
          {entry.title}
        </a>
        {entry.publishedAt && (
          <span className="text-xs text-zinc-600 mt-0.5 block">{formatDate(entry.publishedAt)}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => (entry.isRead ? onMarkUnread(entry.id) : onMarkRead(entry.id))}
        className="shrink-0 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        aria-label={entry.isRead ? "Mark unread" : "Mark read"}
      >
        {entry.isRead ? "Unread" : "Read"}
      </button>
    </li>
  );
}

function FeedTab() {
  const { entries, markRead, markUnread } = useRssReader();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const displayed = showUnreadOnly ? entries.filter((e) => !e.isRead) : entries;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-500">{displayed.length} entries</span>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
            className="accent-blue-400"
          />
          Unread only
        </label>
      </div>

      {displayed.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-8">
          {showUnreadOnly ? "All caught up!" : "No entries yet. Add feeds and refresh."}
        </p>
      ) : (
        <ul>
          {displayed.map((entry) => (
            <EntryItem key={entry.id} entry={entry} onMarkRead={markRead} onMarkUnread={markUnread} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedRow({ feed, onDelete }: { feed: StoredFeed; onDelete: (id: string) => void }) {
  return (
    <li className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm text-zinc-200 truncate">{feed.title}</p>
        <p className="text-xs text-zinc-600 truncate mt-0.5">{feed.url}</p>
        {feed.lastFetchedAt && (
          <p className="text-xs text-zinc-600 mt-0.5">Last fetched: {formatDate(feed.lastFetchedAt)}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(feed.id)}
        className="shrink-0 text-xs text-zinc-600 hover:text-red-400 transition-colors"
        aria-label={`Remove ${feed.title}`}
      >
        Remove
      </button>
    </li>
  );
}

function ManageTab() {
  const { feeds, addFeed, deleteFeed, refresh, isLoading } = useRssReader();
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const url = urlInput.trim();
    if (!url) return;
    setError(null);
    try {
      await addFeed(url);
      setUrlInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to fetch feed: ${msg}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") void handleAdd();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Add Feed</h3>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://example.com/feed.xml"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-zinc-800 rounded px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 text-zinc-200 placeholder-zinc-600"
            aria-label="Feed URL"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!urlInput.trim() || isLoading}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 rounded text-sm transition-colors text-zinc-200"
          >
            Add
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Configured Feeds ({feeds.length})</h3>
        {feeds.length > 0 && (
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Refreshing…" : "Refresh all"}
          </button>
        )}
      </div>

      {feeds.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-4">No feeds added yet.</p>
      ) : (
        <ul>
          {feeds.map((feed) => (
            <FeedRow key={feed.id} feed={feed} onDelete={deleteFeed} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function RssReaderFullView({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"feed" | "manage">("feed");

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold">RSS Reader</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm"
            aria-label="Close"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex border-b border-zinc-800 px-6">
        {(["feed", "manage"] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 mr-4 text-sm border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-zinc-400 text-zinc-200"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "feed" ? "Entries" : "Manage"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === "feed" && <FeedTab />}
        {activeTab === "manage" && <ManageTab />}
      </div>
    </div>
  );
}
