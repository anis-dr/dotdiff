/**
 * Hook for search state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import type { SearchState } from "../types.js";
import { searchAtom } from "../state/appState.js";
import {
  openSearchOp,
  closeSearchOp,
  setSearchQueryOp,
} from "../state/atomicOps.js";

export interface UseSearch {
  search: SearchState;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
}

export function useSearch(): UseSearch {
  // Read state
  const search = useAtomValue(searchAtom);

  // Atomic operations
  const openSearch = useAtomSet(openSearchOp);
  const closeSearch = useAtomSet(closeSearchOp);
  const setSearchQuery = useAtomSet(setSearchQueryOp);

  return {
    search,
    openSearch,
    closeSearch,
    setSearchQuery,
  };
}
