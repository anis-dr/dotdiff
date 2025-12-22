/**
 * Hook for edit mode state management
 */
import { useAtom } from "jotai";
import { useCallback } from "react";
import type { EditMode } from "../types.js";
import { editModeAtom } from "../state/appState.js";

export interface UseEditMode {
  editMode: EditMode | null;
  enterEditMode: (currentValue: string) => void;
  enterAddMode: () => void;
  updateEditInput: (value: string) => void;
  exitEditMode: () => void;
}

export function useEditMode(): UseEditMode {
  const [editMode, setEditMode] = useAtom(editModeAtom);

  const enterEditMode = useCallback(
    (currentValue: string) => {
      setEditMode({
        phase: "editValue",
        inputValue: currentValue,
        dirty: false,
      });
    },
    [setEditMode]
  );

  const enterAddMode = useCallback(() => {
    setEditMode({
      phase: "addKey",
      inputValue: "",
      isNewRow: true,
      dirty: false,
    });
  }, [setEditMode]);

  const updateEditInput = useCallback(
    (value: string) => {
      setEditMode((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          inputValue: value,
          dirty: true,
        };
      });
    },
    [setEditMode]
  );

  const exitEditMode = useCallback(() => {
    setEditMode(null);
  }, [setEditMode]);

  return {
    editMode,
    enterEditMode,
    enterAddMode,
    updateEditInput,
    exitEditMode,
  };
}

