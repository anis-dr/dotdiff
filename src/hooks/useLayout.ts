/**
 * Hook for layout state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { colWidthsAtom } from "../state/appState.js";
import { setColWidthsOp } from "../state/atomicOps.js";

export interface UseLayout {
  colWidths: ReadonlyArray<number>;
  setColWidths: (colWidths: ReadonlyArray<number>) => void;
}

export function useLayout(): UseLayout {
  // Read state
  const colWidths = useAtomValue(colWidthsAtom);

  // Atomic operations
  const setColWidths = useAtomSet(setColWidthsOp);

  return {
    colWidths,
    setColWidths,
  };
}
