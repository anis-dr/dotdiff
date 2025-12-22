/**
 * Hook for delete-related actions
 */
import { useCallback } from "react";
import { useAtomValue } from "jotai";
import type { PendingChange } from "../types.js";
import { currentRowAtom, fileCountAtom, pendingListAtom, selectionAtom } from "../state/appState.js";
import { usePendingChanges } from "./usePendingChanges.js";
import { useFiles } from "./useFiles.js";
import { useMessage } from "./useMessage.js";

export interface UseDeleteActions {
  handleDeleteVariable: () => void;
  handleDeleteAll: () => void;
}

export function useDeleteActions(): UseDeleteActions {
  const currentRow = useAtomValue(currentRowAtom);
  const selection = useAtomValue(selectionAtom);
  const fileCount = useAtomValue(fileCountAtom);
  const pendingList = useAtomValue(pendingListAtom);

  const { upsertChange, removeChange, removeChangesForKey, findChange, addChanges } = usePendingChanges();
  const { getOriginalValue } = useFiles();
  const { showMessage } = useMessage();

  const selectedCol = selection.col;

  const handleDeleteVariable = useCallback(() => {
    if (!currentRow) return;
    const originalValue = getOriginalValue(currentRow.key, selectedCol);
    const pending = findChange(currentRow.key, selectedCol);
    const effectiveValue = pending ? pending.newValue : originalValue;

    if (effectiveValue === null) {
      showMessage("⚠ Already missing in this file");
      return;
    }

    if (originalValue === null) {
      // Value only exists due to pending change, revert it
      removeChange(currentRow.key, selectedCol);
      showMessage("↩ Reverted to missing");
      return;
    }

    upsertChange({
      key: currentRow.key,
      fileIndex: selectedCol,
      oldValue: originalValue,
      newValue: null,
    });
    showMessage(`✗ Marked ${currentRow.key} for deletion`);
  }, [currentRow, selectedCol, getOriginalValue, findChange, removeChange, upsertChange, showMessage]);

  const handleDeleteAll = useCallback(() => {
    if (!currentRow) return;

    const newChanges: PendingChange[] = [];
    for (let i = 0; i < fileCount; i++) {
      const originalValue = getOriginalValue(currentRow.key, i);
      if (originalValue !== null) {
        newChanges.push({
          key: currentRow.key,
          fileIndex: i,
          oldValue: originalValue,
          newValue: null,
        });
      }
    }

    if (newChanges.length === 0) {
      const hadPendingForKey = pendingList.some((c) => c.key === currentRow.key);
      if (hadPendingForKey) {
        removeChangesForKey(currentRow.key);
        showMessage("↩ Reverted pending values (now missing everywhere)");
      } else {
        showMessage("⚠ Already missing in all files");
      }
      return;
    }

    removeChangesForKey(currentRow.key);
    addChanges(newChanges);
    showMessage(`✗ Marked ${currentRow.key} for deletion in ${newChanges.length} files`);
  }, [currentRow, fileCount, getOriginalValue, pendingList, removeChangesForKey, addChanges, showMessage]);

  return {
    handleDeleteVariable,
    handleDeleteAll,
  };
}

