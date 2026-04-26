import { createContext, useContext } from "react";
import type { UseBookmarksReturn } from "./useBookmarks";
import { useBookmarks } from "./useBookmarks";

const BookmarksContext = createContext<UseBookmarksReturn | null>(null);

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const value = useBookmarks();
  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarksContext(): UseBookmarksReturn {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error("useBookmarksContext must be inside BookmarksProvider");
  return ctx;
}
