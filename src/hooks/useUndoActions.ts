/**
 * Hook for undo-related actions
 */
import { useCallback } from "react";
import { useAtomValue } from "@effect-atom/atom-react";
import { currentRowAtom, pendingListAtom, selectionAtom } from "../state/appState.js";
import { usePendingChanges } from "./usePendingChanges.js";
import { useMessage } from "./useMessage.js";

export interface UseUndoActions {
  handleRevert: () => void;
  handleUndo: () => void;
  handleUndoAll: () => void;
}

export function useUndoActions(): UseUndoActions {
  const currentRow = useAtomValue(currentRowAtom);
  const selection = useAtomValue(selectionAtom);
  const pendingList = useAtomValue(pendingListAtom);

  const { removeChange, clearChanges, undoLast, findChange } = usePendingChanges();
  const { showMessage } = useMessage();

  const selectedCol = selection.col;

  const handleRevert = useCallback(() => {
    if (!currentRow) return;
    if (!findChange(currentRow.key, selectedCol)) {
      showMessage("⚠ No pending change to revert");
      return;
    }
    removeChange(currentRow.key, selectedCol);
    showMessage("↩ Reverted to original");
  }, [currentRow, selectedCol, findChange, removeChange, showMessage]);

  const handleUndo = useCallback(() => {
    if (undoLast()) {
      showMessage("↩ Undone");
    } else {
      showMessage("⚠ Nothing to undo");
    }
  }, [undoLast, showMessage]);

  const handleUndoAll = useCallback(() => {
    if (pendingList.length === 0) {
      showMessage("⚠ Nothing to undo");
      return;
    }
    clearChanges();
    showMessage("↩ All changes undone");
  }, [pendingList.length, clearChanges, showMessage]);

  return {
    handleRevert,
    handleUndo,
    handleUndoAll,
  };
}

