import { useClock } from "./useClock";

export function ClockWidget() {
  const { time, settings, updateFormat } = useClock();

  return (
    <div className="flex flex-col h-full items-center justify-center gap-3">
      <span className="text-2xl font-mono font-bold tabular-nums text-zinc-100 tracking-tight">{time}</span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => updateFormat("24h")}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${
            settings.format === "24h" ? "bg-zinc-600 text-zinc-100" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
          }`}
          aria-pressed={settings.format === "24h"}
        >
          24h
        </button>
        <button
          type="button"
          onClick={() => updateFormat("12h")}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${
            settings.format === "12h" ? "bg-zinc-600 text-zinc-100" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
          }`}
          aria-pressed={settings.format === "12h"}
        >
          12h
        </button>
      </div>
    </div>
  );
}
