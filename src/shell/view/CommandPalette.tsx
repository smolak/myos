import { useEffect, useRef, useState } from "react";
import type { Command } from "./command-registry";

interface Props {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.trim()
    ? commands.filter((cmd) => {
        const text = [cmd.label, cmd.description ?? "", cmd.group ?? "", ...(cmd.keywords ?? [])]
          .join(" ")
          .toLowerCase();
        return text.includes(query.toLowerCase().trim());
      })
    : commands;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function handleQueryChange(newQuery: string) {
    setQuery(newQuery);
    setActiveIndex(0);
  }

  function execute(cmd: Command) {
    cmd.action();
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      execute(results[activeIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop — closes on click; keyboard users close via Escape in the input */}
      <button
        type="button"
        data-testid="palette-backdrop"
        className="fixed inset-0 z-50 bg-black/40 cursor-default"
        aria-label="Close command palette"
        onClick={onClose}
      />
      {/* Dialog panel */}
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
              placeholder="Search commands…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Search commands"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-autocomplete="list"
            />
          </div>
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">No commands found</div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1" role="listbox">
              {results.map((cmd, i) => (
                <div
                  key={cmd.id}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === activeIndex}
                  className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 text-sm select-none ${
                    i === activeIndex ? "bg-zinc-700 text-zinc-100" : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                  onClick={() => execute(cmd)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") execute(cmd);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className="flex-1 font-medium">{cmd.label}</span>
                  {cmd.description && <span className="text-xs text-zinc-500 shrink-0">{cmd.description}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
