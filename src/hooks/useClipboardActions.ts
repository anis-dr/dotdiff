/**
 * Hook for clipboard-related actions (copy, paste, paste all)
 */
import { useAtomValue } from "@effect-atom/atom-react";
import { useCallback } from "react";
import { currentRowAtom, fileCountAtom, selectionAtom } from "../state/appState.js";
import type { PendingChange } from "../types.js";
import { useClipboard } from "./useClipboard.js";
import { useFiles } from "./useFiles.js";
import { useMessage } from "./useMessage.js";
import { usePendingChanges } from "./usePendingChanges.js";

export interface UseClipboardActions {
  handleCopy: () => void;
  handlePaste: () => void;
  handlePasteAll: () => void;
}

export function useClipboardActions(): UseClipboardActions {
  const currentRow = useAtomValue(currentRowAtom);
  const selection = useAtomValue(selectionAtom);
  const fileCount = useAtomValue(fileCountAtom);

  const { clipboard, setClipboard } = useClipboard();
  const { addChanges, upsertChange } = usePendingChanges();
  const { getOriginalValue } = useFiles();
  const { showMessage } = useMessage();

  const selectedCol = selection.col;

  const handleCopy = useCallback(() => {
    if (!currentRow) return;
    const value = currentRow.values[selectedCol];
    if (value === null || value === undefined) {
      showMessage("⚠ Nothing to copy");
      return;
    }
    setClipboard({ key: currentRow.key, value });
    showMessage(`📋 Copied ${currentRow.key}`);
  }, [currentRow, selectedCol, setClipboard, showMessage]);

  const handlePaste = useCallback(() => {
    if (!currentRow || !clipboard) {
      showMessage("⚠ Clipboard empty");
      return;
    }
    const originalValue = getOriginalValue(currentRow.key, selectedCol);
    if (clipboard.value === originalValue) {
      showMessage("⚠ Same value");
      return;
    }
    upsertChange({
      key: currentRow.key,
      fileIndex: selectedCol,
      oldValue: originalValue,
      newValue: clipboard.value,
    });
    showMessage(`📋 Pasted to ${currentRow.key}`);
  }, [currentRow, clipboard, selectedCol, getOriginalValue, upsertChange, showMessage]);

  const handlePasteAll = useCallback(() => {
    if (!currentRow || !clipboard) {
      showMessage("⚠ Clipboard empty");
      return;
    }
    const changes: Array<PendingChange> = [];
    for (let i = 0; i < fileCount; i++) {
      const originalValue = getOriginalValue(currentRow.key, i);
      if (clipboard.value !== originalValue) {
        changes.push({
          key: currentRow.key,
          fileIndex: i,
          oldValue: originalValue,
          newValue: clipboard.value,
        });
      }
    }
    if (changes.length === 0) {
      showMessage("⚠ All files already have this value");
      return;
    }
    addChanges(changes);
    showMessage(`📋 Pasted to ${changes.length} files`);
  }, [currentRow, clipboard, fileCount, getOriginalValue, addChanges, showMessage]);

  return {
    handleCopy,
    handlePaste,
    handlePasteAll,
  };
}
