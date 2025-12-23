/**
 * Hook for selection state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useCallback } from "react";
import {
  cycleColumnOp,
  moveDownOp,
  moveLeftOp,
  moveRightOp,
  moveUpOp,
  nextDiffOp,
  nextMatchOp,
  prevDiffOp,
  prevMatchOp,
  selectionAtom,
  setSelectionOp,
} from "../state/index.js";

export interface UseSelection {
  selection: { readonly row: number; readonly col: number; };
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
  // Read state
  const selection = useAtomValue(selectionAtom);

  // Atomic operations
  const doSetSelection = useAtomSet(setSelectionOp);
  const moveUp = useAtomSet(moveUpOp);
  const moveDown = useAtomSet(moveDownOp);
  const moveLeft = useAtomSet(moveLeftOp);
  const moveRight = useAtomSet(moveRightOp);
  const cycleColumn = useAtomSet(cycleColumnOp);
  const nextMatch = useAtomSet(nextMatchOp);
  const prevMatch = useAtomSet(prevMatchOp);
  const nextDiff = useAtomSet(nextDiffOp);
  const prevDiff = useAtomSet(prevDiffOp);

  // Wrapper to match expected signature
  const setSelection = useCallback(
    (row: number, col: number) => {
      doSetSelection({ row, col });
    },
    [doSetSelection],
  );

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
