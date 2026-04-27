import type { ClipboardEntry } from "../shared/types";
import { useClipboardHistoryContext } from "./ClipboardHistoryContext";

interface Props {
  onOpenFullView?: () => void;
}

function ClipEntry({ entry, onCopy }: { entry: ClipboardEntry; onCopy: (content: string) => void }) {
  const preview = entry.content.length > 60 ? `${entry.content.slice(0, 60)}…` : entry.content;
  return (
    <li>
      <button
        type="button"
        aria-label={entry.content}
        onClick={() => onCopy(entry.content)}
        className="w-full text-left py-1 rounded hover:bg-zinc-800 transition-colors"
      >
        <p className={`text-xs truncate ${entry.contentType === "url" ? "text-blue-400" : "text-zinc-300"}`}>
          {preview}
        </p>
      </button>
    </li>
  );
}

export function ClipboardHistoryWidget({ onOpenFullView }: Props) {
  const { entries } = useClipboardHistoryContext();
  const visible = entries.slice(0, 5);

  const handleCopy = (content: string) => {
    void navigator.clipboard.writeText(content);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-200">Clipboard</h2>
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Open
        </button>
      </div>

      {entries.length === 0 ? (
        <button
          type="button"
          className="flex flex-1 items-center justify-center cursor-pointer"
          onClick={onOpenFullView}
          aria-label="Open Clipboard History"
        >
          <p className="text-xs text-zinc-600 text-center">
            No clipboard entries yet.
            <br />
            Copy something to start.
          </p>
        </button>
      ) : (
        <>
          <ul className="flex-1 overflow-hidden">
            {visible.map((entry) => (
              <ClipEntry key={entry.id} entry={entry} onCopy={handleCopy} />
            ))}
          </ul>
          {entries.length > 5 && (
            <button
              type="button"
              onClick={onOpenFullView}
              className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 text-left transition-colors"
            >
              +{entries.length - 5} more
            </button>
          )}
        </>
      )}
    </div>
  );
}
