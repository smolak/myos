import type { BackgroundStyle } from "@shell/shared/rpc-schema";
import { useCallback, useEffect, useState } from "react";
import { rpc } from "./electrobun";

export type { BackgroundStyle };

export const GRADIENT_PRESETS: Record<string, string> = {
  "midnight-blue": "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  "dark-ocean": "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
  "deep-forest": "linear-gradient(135deg, #0a3622, #1a5c35, #0d2b1d)",
  "charcoal-rose": "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
  volcanic: "linear-gradient(135deg, #1a1a1a, #2d1b1b, #1a0a0a)",
};

function applyBackground(bg: BackgroundStyle | null) {
  if (bg === null) {
    document.documentElement.style.removeProperty("--user-bg");
    return;
  }
  const value = bg.type === "solid" ? bg.color : (GRADIENT_PRESETS[bg.preset] ?? "#09090b");
  document.documentElement.style.setProperty("--user-bg", value);
}

export function useAppOptions() {
  const [background, setBackgroundState] = useState<BackgroundStyle | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void rpc.request["app:get-options"]({}).then(({ background: bg }) => {
      setBackgroundState(bg);
      applyBackground(bg);
      setLoaded(true);
    });
  }, []);

  const setBackground = useCallback(async (newBg: BackgroundStyle | null) => {
    setBackgroundState(newBg);
    applyBackground(newBg);
    await rpc.request["app:update-options"]({ background: newBg ?? undefined });
  }, []);

  return { background, setBackground, loaded };
}
