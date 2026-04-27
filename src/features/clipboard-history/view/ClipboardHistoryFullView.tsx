import { useState } from "react";
import type { ClipboardEntry } from "../shared/types";
import { useClipboardHistoryContext } from "./ClipboardHistoryContext";

interface Props {
  onClose: () => void;
}

function EntryRow({
  entry,
  onCopy,
  onDelete,
}: {
  entry: ClipboardEntry;
  onCopy: (content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(entry.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
    onCopy(entry.content);
  };

  const date = new Date(entry.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="group flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-zinc-800 transition-colors">
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm break-all whitespace-pre-wrap ${entry.contentType === "url" ? "text-blue-400" : "text-zinc-200"}`}
        >
          {entry.content}
        </p>
        <p className="text-xs text-zinc-600 mt-1">{date}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded px-2 py-0.5 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          type="button"
          aria-label={`Delete entry: ${entry.content.slice(0, 30)}`}
          onClick={() => onDelete(entry.id)}
          className="text-xs text-red-500 hover:text-red-400 border border-zinc-700 rounded px-2 py-0.5 transition-colors"
        >
          ✕
        </button>
      </div>
    </li>
  );
}

export function ClipboardHistoryFullView({ onClose }: Props) {
  const { entries, remove, clearAll } = useClipboardHistoryContext();
  const [search, setSearch] = useState("");

  const filtered =
    search.trim() === "" ? entries : entries.filter((e) => e.content.toLowerCase().includes(search.toLowerCase()));

  const handleClearAll = () => {
    if (entries.length === 0) return;
    void clearAll();
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <h2 className="text-sm font-semibold text-zinc-200">Clipboard History</h2>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close clipboard history"
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      <div className="px-4 py-2 shrink-0 border-b border-zinc-800">
        <input
          type="text"
          placeholder="Search clipboard…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center mt-8">
            {search ? "No entries match your search." : "Nothing in clipboard history yet."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onCopy={() => {}} onDelete={(id) => void remove(id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
