/**
 * Hook for undo-related actions
 *
 * Thin wrapper around atomic operations in atomicOps.ts
 */
import { useAtomSet } from "@effect-atom/atom-react";
import { revertActionOp, undoActionOp, undoAllActionOp } from "../state/index.js";

export interface UseUndoActions {
  handleRevert: () => void;
  handleUndo: () => void;
  handleUndoAll: () => void;
}

export function useUndoActions(): UseUndoActions {
  const revert = useAtomSet(revertActionOp);
  const undo = useAtomSet(undoActionOp);
  const undoAll = useAtomSet(undoAllActionOp);

  return {
    handleRevert: revert,
    handleUndo: undo,
    handleUndoAll: undoAll,
  };
}
