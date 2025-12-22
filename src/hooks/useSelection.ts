/**
 * Hook for selection state management
 */
import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import {
  selectionAtom,
  effectiveDiffRowsAtom,
  fileCountAtom,
  rowCountAtom,
  filteredRowIndicesAtom,
} from "../state/appState.js";

export interface UseSelection {
  selection: { readonly row: number; readonly col: number };
  moveUp: () => void;
  moveDown: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  cycleColumn: () => void;
  setSelection: (row: number, col: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  nextDiff: () => void;
  prevDiff: () => void;
}

export function useSelection(): UseSelection {
  const [selection, setSelectionAtom] = useAtom(selectionAtom);
  const fileCount = useAtomValue(fileCountAtom);
  const rowCount = useAtomValue(rowCountAtom);
  const filteredRowIndices = useAtomValue(filteredRowIndicesAtom);
  const diffRows = useAtomValue(effectiveDiffRowsAtom);

  const moveUp = useCallback(() => {
    setSelectionAtom((s) => ({
      ...s,
      row: Math.max(0, s.row - 1),
    }));
  }, [setSelectionAtom]);

  const moveDown = useCallback(() => {
    setSelectionAtom((s) => ({
      ...s,
      row: Math.min(rowCount - 1, s.row + 1),
    }));
  }, [setSelectionAtom, rowCount]);

  const moveLeft = useCallback(() => {
    setSelectionAtom((s) => ({
      ...s,
      col: Math.max(0, s.col - 1),
    }));
  }, [setSelectionAtom]);

  const moveRight = useCallback(() => {
    setSelectionAtom((s) => ({
      ...s,
      col: Math.min(fileCount - 1, s.col + 1),
    }));
  }, [setSelectionAtom, fileCount]);

  const cycleColumn = useCallback(() => {
    setSelectionAtom((s) => ({
      ...s,
      col: (s.col + 1) % fileCount,
    }));
  }, [setSelectionAtom, fileCount]);

  const setSelection = useCallback(
    (row: number, col: number) => {
      setSelectionAtom({ row, col });
    },
    [setSelectionAtom]
  );

  const nextMatch = useCallback(() => {
    if (filteredRowIndices.length === 0) return;
    const currentPos = filteredRowIndices.indexOf(selection.row);
    if (currentPos === -1) {
      setSelectionAtom((s) => ({ ...s, row: filteredRowIndices[0]! }));
    } else {
      const nextPos = (currentPos + 1) % filteredRowIndices.length;
      setSelectionAtom((s) => ({ ...s, row: filteredRowIndices[nextPos]! }));
    }
  }, [filteredRowIndices, selection.row, setSelectionAtom]);

  const prevMatch = useCallback(() => {
    if (filteredRowIndices.length === 0) return;
    const currentPos = filteredRowIndices.indexOf(selection.row);
    if (currentPos === -1) {
      setSelectionAtom((s) => ({
        ...s,
        row: filteredRowIndices[filteredRowIndices.length - 1]!,
      }));
    } else {
      const prevPos =
        (currentPos - 1 + filteredRowIndices.length) % filteredRowIndices.length;
      setSelectionAtom((s) => ({ ...s, row: filteredRowIndices[prevPos]! }));
    }
  }, [filteredRowIndices, selection.row, setSelectionAtom]);

  const nextDiff = useCallback(() => {
    if (diffRows.length === 0) return;
    for (let i = 1; i <= diffRows.length; i++) {
      const idx = (selection.row + i) % diffRows.length;
      const row = diffRows[idx];
      if (row && row.status !== "identical") {
        setSelectionAtom((s) => ({ ...s, row: idx }));
        return;
      }
    }
  }, [diffRows, selection.row, setSelectionAtom]);

  const prevDiff = useCallback(() => {
    if (diffRows.length === 0) return;
    for (let i = 1; i <= diffRows.length; i++) {
      const idx = (selection.row - i + diffRows.length) % diffRows.length;
      const row = diffRows[idx];
      if (row && row.status !== "identical") {
        setSelectionAtom((s) => ({ ...s, row: idx }));
        return;
      }
    }
  }, [diffRows, selection.row, setSelectionAtom]);

  return {
    selection,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    cycleColumn,
    setSelection,
    nextMatch,
    prevMatch,
    nextDiff,
    prevDiff,
  };
}

