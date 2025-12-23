/**
 * Hook for search state management
 *
 * Uses atomic operations from keyboardDispatch.ts for mode transitions.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { isSearchActiveAtom, searchQueryAtom } from "../state/appState.js";
import { closeSearchOp, enterSearchModeOp, setSearchQueryOp } from "../state/keyboardDispatch.js";

export interface SearchState {
  readonly active: boolean;
  readonly query: string;
}

export interface UseSearch {
  search: SearchState;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
}

export function useSearch(): UseSearch {
  // Read state from derived atoms
  const active = useAtomValue(isSearchActiveAtom);
  const query = useAtomValue(searchQueryAtom);

  // Mode transition operations
  const openSearch = useAtomSet(enterSearchModeOp);
  const closeSearch = useAtomSet(closeSearchOp);
  const setSearchQuery = useAtomSet(setSearchQueryOp);

  return {
    search: { active, query },
    openSearch,
    closeSearch,
    setSearchQuery,
  };
}
