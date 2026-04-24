import { useState, useEffect, useCallback } from "react";
import type { ClockSettings, TimeFormat } from "../shared/types";
import { rpc } from "@shell/view/electrobun";

const DEFAULT_SETTINGS: ClockSettings = { format: "24h" };

export interface UseClockReturn {
  readonly time: string;
  readonly settings: ClockSettings;
  updateFormat(format: TimeFormat): Promise<void>;
}

export function useClock(): UseClockReturn {
  const [now, setNow] = useState(() => new Date());
  const [settings, setSettings] = useState<ClockSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void rpc.request["clock:get-format"]({}).then(({ format }) => {
      setSettings({ format });
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: settings.format === "12h",
  });

  const updateFormat = useCallback(async (format: TimeFormat) => {
    await rpc.request["clock:update-format"]({ format });
    setSettings({ format });
  }, []);

  return { time, settings, updateFormat };
}
