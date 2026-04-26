import { createContext, useContext } from "react";
import type { UseHabitsReturn } from "./useHabits";
import { useHabits } from "./useHabits";

const HabitsContext = createContext<UseHabitsReturn | null>(null);

export function HabitsProvider({ children }: { children: React.ReactNode }) {
  const value = useHabits();
  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabitsContext(): UseHabitsReturn {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error("useHabitsContext must be inside HabitsProvider");
  return ctx;
}
