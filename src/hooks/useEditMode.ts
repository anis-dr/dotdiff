/**
 * Hook for edit mode state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import type { EditMode } from "../types.js";
import { editModeAtom } from "../state/appState.js";
import {
  enterEditModeOp,
  enterAddModeOp,
  updateEditInputOp,
  exitEditModeOp,
} from "../state/atomicOps.js";

export interface UseEditMode {
  editMode: EditMode | null;
  enterEditMode: (currentValue: string) => void;
  enterAddMode: () => void;
  updateEditInput: (value: string) => void;
  exitEditMode: () => void;
}

export function useEditMode(): UseEditMode {
  // Read state
  const editMode = useAtomValue(editModeAtom);

  // Atomic operations
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
