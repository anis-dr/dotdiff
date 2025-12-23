/**
 * Hook for edit mode state management
 *
 * Uses atomic operations from keyboardDispatch.ts for mode transitions.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import {
  cancelEditOp,
  editModeAtom,
  enterAddModeOp,
  enterEditModeOp,
  exitEditModeOp,
  updateEditInputOp,
} from "../state/index.js";
import type { AppMode } from "../types.js";

/** Edit mode state (null if not in edit mode) */
export type EditModeState = Extract<AppMode, { readonly _tag: "Edit"; }> | null;

export interface UseEditMode {
  editMode: EditModeState;
  enterEditMode: (currentValue: string) => void;
  enterAddMode: () => void;
  updateEditInput: (value: string) => void;
  exitEditMode: () => void;
}

export function useEditMode(): UseEditMode {
  // Read state (derived atom returns Edit mode or null)
  const editMode = useAtomValue(editModeAtom);

  // Mode transition operations
  const enterEditMode = useAtomSet(enterEditModeOp);
  const enterAddMode = useAtomSet(enterAddModeOp);
  const updateEditInput = useAtomSet(updateEditInputOp);
  const exitEditMode = useAtomSet(exitEditModeOp);

  return {
    editMode,
    enterEditMode,
    enterAddMode,
    updateEditInput,
    exitEditMode,
  };
}

/** Hook that also provides cancel with message */
export function useEditActions() {
  const { editMode, enterAddMode, enterEditMode, exitEditMode, updateEditInput } = useEditMode();
  const cancelEdit = useAtomSet(cancelEditOp);

  return {
    cancelEdit,
    editMode,
    enterAddMode,
    enterEditMode,
    exitEditMode,
    updateEditInput,
  };
}
