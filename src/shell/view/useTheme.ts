import type { ThemeMode } from "@shell/shared/rpc-schema";
import { useCallback, useEffect, useState } from "react";
import { rpc } from "./electrobun";

export type { ThemeMode };

function effectiveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyTheme(mode: ThemeMode, accentColor: string) {
  const html = document.documentElement;
  html.setAttribute("data-theme", mode);
  html.setAttribute("data-effective-theme", effectiveTheme(mode));
  html.style.setProperty("--accent-color", accentColor);
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [accentColor, setAccentColorState] = useState<string>("#6366f1");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void rpc.request["theme:get"]({}).then(({ mode: m, accentColor: a }) => {
      setModeState(m);
      setAccentColorState(a);
      applyTheme(m, a);
      setLoaded(true);
    });
  }, []);

  // Re-resolve effective theme when system preference changes
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system", accentColor);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, accentColor]);

  const setMode = useCallback(
    async (newMode: ThemeMode) => {
      setModeState(newMode);
      applyTheme(newMode, accentColor);
      await rpc.request["theme:update"]({ mode: newMode });
    },
    [accentColor],
  );

  const setAccentColor = useCallback(
    async (newColor: string) => {
      setAccentColorState(newColor);
      applyTheme(mode, newColor);
      await rpc.request["theme:update"]({ accentColor: newColor });
    },
    [mode],
  );

  return { mode, accentColor, setMode, setAccentColor, loaded };
}
