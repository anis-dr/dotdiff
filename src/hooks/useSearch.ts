/**
 * Hook for search state management
 */
import { useAtom } from "jotai";
import { useCallback } from "react";
import type { SearchState } from "../types.js";
import { searchAtom } from "../state/appState.js";

export interface UseSearch {
  search: SearchState;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
}

export function useSearch(): UseSearch {
  const [search, setSearch] = useAtom(searchAtom);

  const openSearch = useCallback(() => {
    setSearch({ active: true, query: "" });
  }, [setSearch]);

  const closeSearch = useCallback(() => {
    setSearch({ active: false, query: "" });
  }, [setSearch]);

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearch((prev) => ({ ...prev, query }));
    },
    [setSearch]
  );

  return {
    search,
    openSearch,
    closeSearch,
    setSearchQuery,
  };
}

