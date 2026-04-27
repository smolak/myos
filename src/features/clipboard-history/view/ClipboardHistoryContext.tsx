import { createContext, useContext } from "react";
import type { UseClipboardHistoryReturn } from "./useClipboardHistory";
import { useClipboardHistory } from "./useClipboardHistory";

const ClipboardHistoryContext = createContext<UseClipboardHistoryReturn | null>(null);

export function ClipboardHistoryProvider({ children }: { children: React.ReactNode }) {
  const value = useClipboardHistory();
  return <ClipboardHistoryContext.Provider value={value}>{children}</ClipboardHistoryContext.Provider>;
}

export function useClipboardHistoryContext(): UseClipboardHistoryReturn {
  const ctx = useContext(ClipboardHistoryContext);
  if (!ctx) throw new Error("useClipboardHistoryContext must be inside ClipboardHistoryProvider");
  return ctx;
}
