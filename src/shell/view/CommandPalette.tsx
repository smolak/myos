import type { SearchResult } from "@shell/shared/search-types";
import { useEffect, useRef, useState } from "react";
import type { Command } from "./command-registry";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

interface Props {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onNavigateToFeature?: (featureId: string) => void;
}

type Item = { kind: "command"; command: Command } | { kind: "result"; result: SearchResult };

export function CommandPalette({ open, onClose, commands, onSearch, onNavigateToFeature }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = query.trim()
    ? commands.filter((cmd) => {
        const text = [cmd.label, cmd.description ?? "", cmd.group ?? "", ...(cmd.keywords ?? [])]
          .join(" ")
          .toLowerCase();
        return text.includes(query.toLowerCase().trim());
      })
    : commands;

  const items: Item[] = [
    ...filteredCommands.map((command): Item => ({ kind: "command", command })),
    ...searchResults.map((result): Item => ({ kind: "result", result })),
  ];

  useEffect(() => {
    if (!onSearch || query.trim().length < MIN_QUERY_LENGTH) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void onSearch(query.trim()).then(setSearchResults);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setSearchResults([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function handleQueryChange(newQuery: string) {
    setQuery(newQuery);
    setActiveIndex(0);
  }

  function executeItem(item: Item) {
    if (item.kind === "command") {
      item.command.action();
    } else {
      onNavigateToFeature?.(item.result.featureId);
    }
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[activeIndex]) {
      executeItem(items[activeIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        data-testid="palette-backdrop"
        className="fixed inset-0 z-50 bg-black/40 cursor-default"
        aria-label="Close command palette"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed inset-0 z-50 flex items-start justify-center pt-24 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="border-b border-zinc-700">
            <input
              ref={inputRef}
              type="text"
              className="w-full bg-transparent px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none text-sm"
              placeholder="Search commands and content…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Search commands"
              role="combobox"
              aria-expanded={items.length > 0}
              aria-autocomplete="list"
            />
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No results found</div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1" role="listbox">
              {filteredCommands.length > 0 && searchResults.length > 0 && (
                <div className="px-4 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">Commands</div>
              )}
              {filteredCommands.map((cmd, i) => (
                <div
                  key={cmd.id}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === activeIndex}
                  className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 text-sm select-none ${
                    i === activeIndex ? "text-white" : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                  style={i === activeIndex ? { backgroundColor: "var(--accent-color)" } : undefined}
                  onClick={() => executeItem({ kind: "command", command: cmd })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") executeItem({ kind: "command", command: cmd });
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className="flex-1 font-medium">{cmd.label}</span>
                  {cmd.description && <span className="text-xs text-zinc-500 shrink-0">{cmd.description}</span>}
                </div>
              ))}
              {searchResults.length > 0 && (
                <>
                  {filteredCommands.length > 0 && (
                    <div className="px-4 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wider mt-1">
                      Content
                    </div>
                  )}
                  {searchResults.map((result, ri) => {
                    const itemIndex = filteredCommands.length + ri;
                    return (
                      <div
                        key={`${result.featureId}:${result.itemId}`}
                        role="option"
                        tabIndex={-1}
                        aria-selected={itemIndex === activeIndex}
                        className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 text-sm select-none ${
                          itemIndex === activeIndex ? "text-white" : "text-zinc-300 hover:bg-zinc-800"
                        }`}
                        style={itemIndex === activeIndex ? { backgroundColor: "var(--accent-color)" } : undefined}
                        onClick={() => executeItem({ kind: "result", result })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") executeItem({ kind: "result", result });
                        }}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                      >
                        <span className="flex-1 font-medium">{result.title}</span>
                        <span className="text-xs text-zinc-500 shrink-0">
                          {result.subtitle ? `${result.subtitle} · ${result.featureName}` : result.featureName}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
