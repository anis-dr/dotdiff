/**
 * Hook for undo-related actions
 *
 * Thin wrapper around atomic operations in atomicOps.ts
 */
import { useAtomSet } from "@effect-atom/atom-react";
import { redoOp, revertActionOp, undoAllOp, undoOp } from "../state/index.js";

export interface UseUndoActions {
  handleRevert: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleUndoAll: () => void;
}

export function useUndoActions(): UseUndoActions {
  const revert = useAtomSet(revertActionOp);
  const undo = useAtomSet(undoOp);
  const redo = useAtomSet(redoOp);
  const undoAll = useAtomSet(undoAllOp);

  return {
    handleRevert: revert,
    handleUndo: undo,
    handleRedo: redo,
    handleUndoAll: undoAll,
  };
}
