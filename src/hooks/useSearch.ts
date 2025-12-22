/**
 * Hook for search state management
 */
import { useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  diffRowsAtom,
  filteredRowIndicesAtom,
  searchStateAtom,
  selectedRowAtom,
} from "../state/atoms.js";

export interface UseSearchReturn {
  readonly isSearchActive: boolean;
  readonly searchQuery: string;
  readonly filteredIndices: ReadonlyArray<number>;
  readonly matchCount: number;
  readonly openSearch: () => void;
  readonly closeSearch: () => void;
  readonly setSearchQuery: (query: string) => void;
  readonly nextMatch: () => void;
  readonly prevMatch: () => void;
  readonly nextDiff: () => void;
  readonly prevDiff: () => void;
}

export function useSearch(): UseSearchReturn {
  const [searchState, setSearchState] = useAtom(searchStateAtom);
  const filteredIndices = useAtomValue(filteredRowIndicesAtom);
  const diffRows = useAtomValue(diffRowsAtom);
  const [selectedRow, setSelectedRow] = useAtom(selectedRowAtom);

  const openSearch = useCallback(() => {
    setSearchState({ active: true, query: "" });
  }, [setSearchState]);

  const closeSearch = useCallback(() => {
    setSearchState({ active: false, query: "" });
  }, [setSearchState]);

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchState((prev) => ({ ...prev, query }));
    },
    [setSearchState]
  );

  const nextMatch = useCallback(() => {
    if (filteredIndices.length === 0) return;

    // Find next index after current selection
    const currentPos = filteredIndices.indexOf(selectedRow);
    if (currentPos === -1) {
      // Not in filtered set, jump to first match
      setSelectedRow(filteredIndices[0]!);
    } else {
      // Go to next, wrap around
      const nextPos = (currentPos + 1) % filteredIndices.length;
      setSelectedRow(filteredIndices[nextPos]!);
    }
  }, [filteredIndices, selectedRow, setSelectedRow]);

  const prevMatch = useCallback(() => {
    if (filteredIndices.length === 0) return;

    // Find prev index before current selection
    const currentPos = filteredIndices.indexOf(selectedRow);
    if (currentPos === -1) {
      // Not in filtered set, jump to last match
      setSelectedRow(filteredIndices[filteredIndices.length - 1]!);
    } else {
      // Go to prev, wrap around
      const prevPos =
        (currentPos - 1 + filteredIndices.length) % filteredIndices.length;
      setSelectedRow(filteredIndices[prevPos]!);
    }
  }, [filteredIndices, selectedRow, setSelectedRow]);

  // Navigate to next/prev row that is NOT identical (i.e., different or missing)
  const nextDiff = useCallback(() => {
    if (diffRows.length === 0) return;

    for (let i = 1; i <= diffRows.length; i++) {
      const idx = (selectedRow + i) % diffRows.length;
      const row = diffRows[idx];
      if (row && row.status !== "identical") {
        setSelectedRow(idx);
        return;
      }
    }
  }, [diffRows, selectedRow, setSelectedRow]);

  const prevDiff = useCallback(() => {
    if (diffRows.length === 0) return;

    for (let i = 1; i <= diffRows.length; i++) {
      const idx = (selectedRow - i + diffRows.length) % diffRows.length;
      const row = diffRows[idx];
      if (row && row.status !== "identical") {
        setSelectedRow(idx);
        return;
      }
    }
  }, [diffRows, selectedRow, setSelectedRow]);

  return {
    isSearchActive: searchState.active,
    searchQuery: searchState.query,
    filteredIndices,
    matchCount: filteredIndices.length,
    openSearch,
    closeSearch,
    setSearchQuery,
    nextMatch,
    prevMatch,
    nextDiff,
    prevDiff,
  };
}

