/**
 * Hook for edit-related actions (edit, save edit, cancel edit)
 *
 * Thin wrapper around atomic operations
 */
import { useAtomSet } from "@effect-atom/atom-react";
import { useCallback } from "react";
import { cancelEditActionOp, editInputActionOp, enterEditModeActionOp, saveEditActionOp } from "../state/index.js";

export interface UseEditActions {
  handleEnterEditMode: () => void;
  handleEditInput: (value: string) => void;
  handleSaveEdit: (submittedValue?: string) => void;
  handleCancelEdit: () => void;
}

export function useEditActions(): UseEditActions {
  const enterEditMode = useAtomSet(enterEditModeActionOp);
  const editInput = useAtomSet(editInputActionOp);
  const saveEdit = useAtomSet(saveEditActionOp);
  const cancelEdit = useAtomSet(cancelEditActionOp);

  const handleSaveEdit = useCallback(
    (submittedValue?: string) => {
      if (submittedValue !== undefined) {
        saveEdit({ submittedValue });
      } else {
        saveEdit({});
      }
    },
    [saveEdit],
  );

  return {
    handleCancelEdit: cancelEdit,
    handleEditInput: editInput,
    handleEnterEditMode: enterEditMode,
    handleSaveEdit,
  };
}
