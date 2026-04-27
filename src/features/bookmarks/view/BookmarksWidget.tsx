import type { Bookmark } from "../shared/types";
import { useBookmarksContext } from "./BookmarksContext";

interface Props {
  onOpenFullView?: () => void;
}

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function BookmarkRow({ bookmark, onOpen }: { bookmark: Bookmark; onOpen: (url: string) => void }) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-label={bookmark.title}
        onClick={() => onOpen(bookmark.url)}
        className="w-full text-left flex items-center gap-2 py-1 rounded hover:bg-zinc-800 transition-colors min-w-0"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-300 truncate">{bookmark.title}</p>
          <p className="text-xs text-zinc-600 truncate">{domain(bookmark.url)}</p>
        </div>
      </button>
    </li>
  );
}

export function BookmarksWidget({ onOpenFullView }: Props) {
  const { bookmarks, openUrl } = useBookmarksContext();
  const visible = bookmarks.slice(0, 4);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-200">Bookmarks</h2>
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Open
        </button>
      </div>

      {bookmarks.length === 0 ? (
        <button
          type="button"
          className="flex flex-1 items-center justify-center cursor-pointer"
          onClick={onOpenFullView}
          aria-label="Open Bookmarks to add bookmarks"
        >
          <p className="text-xs text-zinc-600 text-center">
            No bookmarks yet.
            <br />
            Click to add one.
          </p>
        </button>
      ) : (
        <>
          <ul className="flex-1 overflow-hidden">
            {visible.map((b) => (
              <BookmarkRow key={b.id} bookmark={b} onOpen={openUrl} />
            ))}
          </ul>
          {bookmarks.length > 4 && (
            <button
              type="button"
              onClick={onOpenFullView}
              className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 text-left transition-colors"
            >
              +{bookmarks.length - 4} more
            </button>
          )}
        </>
      )}
    </div>
  );
}
