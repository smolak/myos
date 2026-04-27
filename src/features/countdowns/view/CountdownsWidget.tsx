import type { CountdownWithTimeLeft } from "../shared/types";
import { useCountdownsContext } from "./CountdownsContext";

interface Props {
  onOpenFullView?: () => void;
}

function formatTimeLeft(countdown: CountdownWithTimeLeft): string {
  if (countdown.isReached) return "Reached!";
  if (countdown.daysRemaining > 0) return `${countdown.daysRemaining}d ${countdown.hoursRemaining}h`;
  if (countdown.hoursRemaining > 0) return `${countdown.hoursRemaining}h ${countdown.minutesRemaining}m`;
  return `${countdown.minutesRemaining}m`;
}

function CountdownRow({ countdown }: { countdown: CountdownWithTimeLeft }) {
  return (
    <li className="flex items-center justify-between py-1 gap-2">
      <span className="text-xs truncate flex-1 text-zinc-300">{countdown.name}</span>
      <span className={`text-xs font-mono shrink-0 ${countdown.isReached ? "text-emerald-400" : "text-zinc-400"}`}>
        {formatTimeLeft(countdown)}
      </span>
    </li>
  );
}

export function CountdownsWidget({ onOpenFullView }: Props) {
  const { countdowns } = useCountdownsContext();
  const visible = countdowns.slice(0, 4);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-200">Countdowns</h2>
        <button
          type="button"
          onClick={onOpenFullView}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Open
        </button>
      </div>

      {countdowns.length === 0 ? (
        <button
          type="button"
          className="flex flex-1 items-center justify-center cursor-pointer"
          onClick={onOpenFullView}
          aria-label="Open Countdowns to add countdowns"
        >
          <p className="text-xs text-zinc-600 text-center">
            No countdowns yet.
            <br />
            Click to add one.
          </p>
        </button>
      ) : (
        <>
          <ul className="flex-1 overflow-hidden">
            {visible.map((countdown) => (
              <CountdownRow key={countdown.id} countdown={countdown} />
            ))}
          </ul>
          {countdowns.length > 4 && (
            <button
              type="button"
              onClick={onOpenFullView}
              className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 text-left transition-colors"
            >
              +{countdowns.length - 4} more
            </button>
          )}
        </>
      )}
    </div>
  );
}
