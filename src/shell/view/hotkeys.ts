// Thin hotkey abstraction. Swap the implementation block below without touching consumers.
// Public API: registerHotkey(keys, handler) → unregister

export type HotkeyHandler = (event: KeyboardEvent) => void;

interface ParsedHotkey {
  mod: boolean; // cmd / ctrl
  shift: boolean;
  alt: boolean;
  key: string; // lowercased e.key value
}

function parseHotkey(keys: string): ParsedHotkey {
  const parts = keys.toLowerCase().split("+");
  return {
    mod: parts.includes("cmd") || parts.includes("ctrl") || parts.includes("mod"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt") || parts.includes("option"),
    key: parts[parts.length - 1],
  };
}

function matchEvent(parsed: ParsedHotkey, e: KeyboardEvent): boolean {
  return (
    parsed.mod === (e.metaKey || e.ctrlKey) &&
    parsed.shift === e.shiftKey &&
    parsed.alt === e.altKey &&
    e.key.toLowerCase() === parsed.key
  );
}

// --- implementation (swap this block to use e.g. tinykeys or hotkeys-js) ---
export function registerHotkey(keys: string, handler: HotkeyHandler): () => void {
  const parsed = parseHotkey(keys);
  const listener = (e: KeyboardEvent) => {
    if (matchEvent(parsed, e)) {
      e.preventDefault();
      handler(e);
    }
  };
  window.addEventListener("keydown", listener);
  return () => window.removeEventListener("keydown", listener);
}
// ---------------------------------------------------------------------------
