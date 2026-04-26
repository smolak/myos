import { createContext, useContext } from "react";
import type { UseDailyJournalReturn } from "./useDailyJournal";
import { useDailyJournal } from "./useDailyJournal";

const DailyJournalContext = createContext<UseDailyJournalReturn | null>(null);

export function DailyJournalProvider({ children }: { children: React.ReactNode }) {
  const value = useDailyJournal();
  return <DailyJournalContext.Provider value={value}>{children}</DailyJournalContext.Provider>;
}

export function useDailyJournalContext(): UseDailyJournalReturn {
  const ctx = useContext(DailyJournalContext);
  if (!ctx) throw new Error("useDailyJournalContext must be inside DailyJournalProvider");
  return ctx;
}
