/**
 * Hook for edit mode state management
 */
import { useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { DiffRow, EditMode, EnvFile, PendingChange } from "../types.js";
import {
  diffRowsAtom,
  editModeAtom,
  filesAtom,
  selectedColAtom,
  selectedRowAtom,
} from "../state/atoms.js";
import type { UsePendingChangesReturn } from "./usePendingChanges.js";

export interface UseEditModeReturn {
  readonly editMode: EditMode | null;
  readonly enterEditMode: (row: DiffRow) => void;
  readonly enterAddMode: () => void;
  readonly handleEditInput: (value: string) => void;
  readonly saveEdit: (
    row: DiffRow | null,
    submittedValue?: string
  ) => string | null;
  readonly cancelEdit: () => string;
}

export function useEditMode(
  pendingChangesHook: UsePendingChangesReturn
): UseEditModeReturn {
  const [editMode, setEditMode] = useAtom(editModeAtom);
  const [diffRows, setDiffRows] = useAtom(diffRowsAtom);
  const files = useAtomValue(filesAtom);
  const selectedCol = useAtomValue(selectedColAtom);
  const setSelectedRow = useSetAtom(selectedRowAtom);

  const { pendingChanges, upsertChange, addChanges, findChange } =
    pendingChangesHook;

  const enterEditMode = useCallback(
    (row: DiffRow) => {
      // Check if there's a pending change - use that value instead of original
      const pending = findChange(row.key, selectedCol);
      const currentValue = pending?.newValue ?? row.values[selectedCol] ?? "";
      setEditMode({
        phase: "editValue",
        inputValue: currentValue,
      });
    },
    [selectedCol, findChange, setEditMode]
  );

  const enterAddMode = useCallback(() => {
    setEditMode({
      phase: "addKey",
      inputValue: "",
    });
  }, [setEditMode]);

  const handleEditInput = useCallback(
    (value: string) => {
      setEditMode((prev) => (prev ? { ...prev, inputValue: value } : null));
    },
    [setEditMode]
  );

  const saveEditValue = useCallback(
    (row: DiffRow, submittedValue?: string): string | null => {
      if (!editMode) return null;

      const originalValue = row.values[selectedCol] ?? null;
      const newValue =
        submittedValue !== undefined ? submittedValue : editMode.inputValue;

      if (newValue === originalValue) {
        setEditMode(null);
        return "⚠ No change";
      }

      const newChange: PendingChange = {
        key: row.key,
        fileIndex: selectedCol,
        oldValue: originalValue,
        newValue,
      };

      upsertChange(newChange);
      setEditMode(null);
      return "✓ Value updated";
    },
    [editMode, selectedCol, upsertChange, setEditMode]
  );

  const saveAddKey = useCallback((): string | null => {
    if (!editMode) return null;

    const key = editMode.inputValue.trim();
    if (!key) {
      return "⚠ Key cannot be empty";
    }
    if (diffRows.some((r) => r.key === key)) {
      return "⚠ Key already exists";
    }
    setEditMode({
      phase: "addValue",
      inputValue: "",
      newKey: key,
    });
    return null; // No message, continue to next phase
  }, [editMode, diffRows, setEditMode]);

  const saveAddValue = useCallback((): string | null => {
    if (!editMode || !editMode.newKey) return null;

    const key = editMode.newKey;
    const value = editMode.inputValue;

    const newChanges: PendingChange[] = files.map((_, i) => ({
      key,
      fileIndex: i,
      oldValue: null,
      newValue: value,
      isNew: true,
    }));

    addChanges(newChanges);

    const newRow: DiffRow = {
      key,
      values: files.map(() => null),
      status: "missing",
    };
    setDiffRows((rows) => [...rows, newRow]);
    setSelectedRow(diffRows.length);

    setEditMode(null);
    return `✓ Added ${key}`;
  }, [editMode, files, diffRows.length, addChanges, setDiffRows, setSelectedRow, setEditMode]);

  const saveEdit = useCallback(
    (row: DiffRow | null, submittedValue?: string): string | null => {
      if (!editMode) return null;

      if (editMode.phase === "editValue") {
        if (!row) {
          setEditMode(null);
          return null;
        }
        return saveEditValue(row, submittedValue);
      } else if (editMode.phase === "addKey") {
        return saveAddKey();
      } else if (editMode.phase === "addValue") {
        return saveAddValue();
      }

      return null;
    },
    [editMode, saveEditValue, saveAddKey, saveAddValue, setEditMode]
  );

  const cancelEdit = useCallback((): string => {
    setEditMode(null);
    return "↩ Cancelled";
  }, [setEditMode]);

  return {
    editMode,
    enterEditMode,
    enterAddMode,
    handleEditInput,
    saveEdit,
    cancelEdit,
  };
}

