/**
 * Hook for edit-related actions (edit, save edit, cancel edit)
 */
import { useAtomValue } from "@effect-atom/atom-react";
import { useCallback } from "react";
import { currentRowAtom, selectionAtom } from "../state/appState.js";
import { useEditMode } from "./useEditMode.js";
import { useFiles } from "./useFiles.js";
import { useMessage } from "./useMessage.js";
import { usePendingChanges } from "./usePendingChanges.js";

export interface UseEditActions {
  handleEnterEditMode: () => void;
  handleEditInput: (value: string) => void;
  handleSaveEdit: (submittedValue?: string) => void;
  handleCancelEdit: () => void;
}

export function useEditActions(): UseEditActions {
  const currentRow = useAtomValue(currentRowAtom);
  const selection = useAtomValue(selectionAtom);

  const { editMode, enterEditMode, exitEditMode, updateEditInput } = useEditMode();
  const { removeChange, upsertChange } = usePendingChanges();
  const { getOriginalValue } = useFiles();
  const { showMessage } = useMessage();

  const selectedCol = selection.col;

  const handleEnterEditMode = useCallback(() => {
    if (!currentRow) return;
    const value = currentRow.values[selectedCol];
    enterEditMode(value ?? "");
  }, [currentRow, selectedCol, enterEditMode]);

  const handleEditInput = useCallback(
    (value: string) => {
      updateEditInput(value);
    },
    [updateEditInput],
  );

  const handleSaveEdit = useCallback(
    (submittedValue?: string) => {
      if (!currentRow || !editMode) {
        exitEditMode();
        return;
      }

      const inputValue = submittedValue ?? editMode.inputValue;

      // If user didn't type anything, just cancel
      if (!editMode.dirty) {
        exitEditMode();
        showMessage("⊘ Edit cancelled");
        return;
      }

      // Determine the new value
      let newValue: string | null;
      const trimmed = inputValue.trim();
      if (trimmed === "<null>" || trimmed === "<unset>") {
        newValue = null; // Explicit deletion
      } else if (trimmed === "\"\"" || trimmed === "''") {
        newValue = ""; // Explicit empty string
      } else {
        newValue = inputValue; // Use as-is (including empty string)
      }

      const originalValue = getOriginalValue(currentRow.key, selectedCol);

      // If value unchanged from original, remove any pending change
      if (newValue === originalValue) {
        removeChange(currentRow.key, selectedCol);
        exitEditMode();
        showMessage("⊘ No change");
        return;
      }

      upsertChange({
        key: currentRow.key,
        fileIndex: selectedCol,
        oldValue: originalValue,
        newValue,
      });
      exitEditMode();
      showMessage("✓ Value updated");
    },
    [currentRow, editMode, selectedCol, getOriginalValue, removeChange, upsertChange, exitEditMode, showMessage],
  );

  const handleCancelEdit = useCallback(() => {
    exitEditMode();
    showMessage("⊘ Edit cancelled");
  }, [exitEditMode, showMessage]);

  return {
    handleEnterEditMode,
    handleEditInput,
    handleSaveEdit,
    handleCancelEdit,
  };
}
