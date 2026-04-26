import { createContext, useContext } from "react";
import type { UseRssReaderReturn } from "./useRssReader";
import { useRssReader } from "./useRssReader";

const RssReaderContext = createContext<UseRssReaderReturn | null>(null);

export function RssReaderProvider({ children }: { children: React.ReactNode }) {
  const value = useRssReader();
  return <RssReaderContext.Provider value={value}>{children}</RssReaderContext.Provider>;
}

export function useRssReaderContext(): UseRssReaderReturn {
  const ctx = useContext(RssReaderContext);
  if (!ctx) throw new Error("useRssReaderContext must be inside RssReaderProvider");
  return ctx;
}
