import { createContext, useContext } from "react";
import type { UseSnippetsReturn } from "./useSnippets";
import { useSnippets } from "./useSnippets";

const SnippetsContext = createContext<UseSnippetsReturn | null>(null);

export function SnippetsProvider({ children }: { children: React.ReactNode }) {
  const value = useSnippets();
  return <SnippetsContext.Provider value={value}>{children}</SnippetsContext.Provider>;
}

export function useSnippetsContext(): UseSnippetsReturn {
  const ctx = useContext(SnippetsContext);
  if (!ctx) throw new Error("useSnippetsContext must be inside SnippetsProvider");
  return ctx;
}
