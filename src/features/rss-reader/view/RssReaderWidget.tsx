import { rpc } from "@shell/view/electrobun";
import type { FaviconMap, RssEntry } from "../shared/types";
import { EntryIcon } from "./EntryIcon";
import { useRssReaderContext } from "./RssReaderContext";

interface Props {
  onOpenFullView?: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EntryRow({
  entry,
  onRead,
  favicons,
}: {
  entry: RssEntry;
  onRead: (id: string) => void;
  favicons: FaviconMap;
}) {
  return (
    <li className="flex items-start gap-2 py-1.5 border-b border-zinc-800 last:border-0">
      <EntryIcon link={entry.link} favicons={favicons} />
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => {
            void rpc.request["shell:open-url"]({ url: entry.link });
            onRead(entry.id);
          }}
          className={`text-xs truncate block text-left hover:text-zinc-200 transition-colors ${
            entry.isRead ? "text-zinc-600" : "text-zinc-300"
          }`}
          aria-label={entry.title}
        >
          {entry.title}
        </button>
        {entry.publishedAt && <span className="text-xs text-zinc-600">{formatDate(entry.publishedAt)}</span>}
      </div>
      {!entry.isRead && <span className="w-1.5 h-1.5 mt-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden />}
    </li>
  );
}

export function RssReaderWidget({ onOpenFullView }: Props) {
  const { entries, unreadCount, isLoading, feeds, markRead, favicons } = useRssReaderContext();

  const recentEntries = entries.slice(0, 5);
  const isEmpty = feeds.length === 0;

  return (
    <div className="flex flex-col h-full">
      {unreadCount > 0 && (
        <div className="mb-1.5">
          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{unreadCount} unread</span>
        </div>
      )}

      {isLoading && <p className="text-xs text-zinc-500 mb-1">Fetching feeds…</p>}

      {isEmpty ? (
        <button
          type="button"
          className="flex flex-1 items-center justify-center cursor-pointer"
          onClick={onOpenFullView}
          aria-label="Open RSS Reader to add feeds"
        >
          <p className="text-xs text-zinc-600 text-center">
            No feeds configured.
            <br />
            Click to add feeds.
          </p>
        </button>
      ) : recentEntries.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center flex-1 flex items-center justify-center">No entries yet</p>
      ) : (
        <ul className="flex-1 overflow-hidden">
          {recentEntries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} onRead={markRead} favicons={favicons} />
          ))}
        </ul>
      )}
    </div>
  );
}
