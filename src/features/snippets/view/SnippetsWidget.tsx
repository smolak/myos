import { useSnippetsContext } from "./SnippetsContext";

interface Props {
  onOpenFullView?: () => void;
}

export function SnippetsWidget({ onOpenFullView }: Props) {
  const { favorites, expand } = useSnippetsContext();

  async function handleCopy(id: string) {
    const text = await expand(id);
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-200">Snippets</h2>
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Open
        </button>
      </div>

      {favorites.length === 0 ? (
        <button
          type="button"
          className="flex flex-1 items-center justify-center cursor-pointer"
          onClick={onOpenFullView}
          aria-label="Open Snippets to add favorite snippets"
        >
          <p className="text-xs text-zinc-600 text-center">
            No favorites yet.
            <br />
            Star a snippet to pin it here.
          </p>
        </button>
      ) : (
        <ul className="flex-1 overflow-hidden space-y-1">
          {favorites.slice(0, 4).map((snippet) => (
            <li key={snippet.id} className="flex items-center gap-2">
              <span className="text-xs truncate flex-1 text-zinc-300">{snippet.name}</span>
              <button
                type="button"
                onClick={() => void handleCopy(snippet.id)}
                className="text-xs text-zinc-500 hover:text-zinc-200 shrink-0 transition-colors"
                aria-label={`Copy ${snippet.name}`}
              >
                Copy
              </button>
            </li>
          ))}
          {favorites.length > 4 && (
            <button
              type="button"
              onClick={onOpenFullView}
              className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 text-left transition-colors"
            >
              +{favorites.length - 4} more
            </button>
          )}
        </ul>
      )}
    </div>
  );
}
