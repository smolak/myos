import type { ThemeMode } from "./useTheme";

const MODES: ThemeMode[] = ["dark", "light", "system"];
const LABELS: Record<ThemeMode, string> = { dark: "Dark", light: "Light", system: "System" };
const ICONS: Record<ThemeMode, string> = { dark: "☾", light: "☀", system: "◑" };

interface Props {
  mode: ThemeMode;
  accentColor: string;
  onModeChange: (mode: ThemeMode) => void;
  onAccentChange: (color: string) => void;
}

export function ThemeToggle({ mode, accentColor, onModeChange, onAccentChange }: Props) {
  function cycleMode() {
    const idx = MODES.indexOf(mode);
    onModeChange(MODES[(idx + 1) % MODES.length]);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={cycleMode}
        title={`Theme: ${LABELS[mode]}. Click to cycle.`}
        aria-label={`Current theme: ${LABELS[mode]}`}
        className="text-xs border border-zinc-700 rounded px-2 py-1 hover:border-zinc-500 transition-colors"
      >
        {ICONS[mode]} {LABELS[mode]}
      </button>
      <label className="sr-only" htmlFor="accent-color-picker">
        Accent color
      </label>
      <input
        id="accent-color-picker"
        type="color"
        value={accentColor}
        onChange={(e) => onAccentChange(e.target.value)}
        title="Accent color"
        className="w-6 h-6 rounded cursor-pointer border border-zinc-700 bg-transparent p-0"
        style={{ accentColor }}
      />
    </div>
  );
}
