import { createContext, useContext } from "react";
import type { UseCountdownsReturn } from "./useCountdowns";
import { useCountdowns } from "./useCountdowns";

const CountdownsContext = createContext<UseCountdownsReturn | null>(null);

export function CountdownsProvider({ children }: { children: React.ReactNode }) {
  const value = useCountdowns();
  return <CountdownsContext.Provider value={value}>{children}</CountdownsContext.Provider>;
}

export function useCountdownsContext(): UseCountdownsReturn {
  const ctx = useContext(CountdownsContext);
  if (!ctx) throw new Error("useCountdownsContext must be inside CountdownsProvider");
  return ctx;
}
