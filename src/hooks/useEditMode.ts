/**
 * Hook for edit mode state management
 */
import { useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { DiffRow, EditMode, PendingChange } from "../types.js";
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
  const [selectedRow, setSelectedRow] = useAtom(selectedRowAtom);

  const { upsertChange, findChange } = pendingChangesHook;

  const enterEditMode = useCallback(
    (row: DiffRow) => {
      // Check if there's a pending change - use that value instead of original
      const pending = findChange(row.key, selectedCol);
      const currentValue = pending?.newValue ?? row.values[selectedCol] ?? "";
      setEditMode({
        phase: "editValue",
        inputValue: currentValue,
        dirty: false,
      });
    },
    [selectedCol, findChange, setEditMode]
  );

  const enterAddMode = useCallback(() => {
    // Create placeholder row with empty key
    const placeholderRow: DiffRow = {
      key: "",
      values: files.map(() => null),
      status: "missing",
    };

    // Append to diffRows and select it
    setDiffRows((rows) => [...rows, placeholderRow]);
    setSelectedRow(diffRows.length); // Will be the index of the new row

    // Enter addKey phase
    setEditMode({
      phase: "addKey",
      inputValue: "",
      isNewRow: true,
      dirty: false,
    });
  }, [files, diffRows.length, setDiffRows, setSelectedRow, setEditMode]);

  const handleEditInput = useCallback(
    (value: string) => {
      setEditMode((prev) =>
        prev ? { ...prev, inputValue: value, dirty: true } : null
      );
    },
    [setEditMode]
  );

  const saveEditValue = useCallback(
    (row: DiffRow, submittedValue?: string): string | null => {
      if (!editMode) return null;

      const originalValue = row.values[selectedCol] ?? null;
      const rawValue =
        submittedValue !== undefined ? submittedValue : editMode.inputValue;
      const existingPending = findChange(row.key, selectedCol);

      // If user opened edit and submitted without typing, treat as no-op.
      // This fixes the \"missing -> empty string\" accidental change case.
      if (!editMode.dirty) {
        setEditMode(null);
        return "⚠ No change";
      }

      // Normalize edit input:
      // - blank input => empty string (KEY="") so empty values are representable on disk
      // - literal \"\" or '' => empty string
      // - <null> / <unset> => delete/unset (null)
      const normalized = rawValue.trim();
      const newValue: string | null =
        normalized === "<null>" || normalized === "<unset>"
          ? null
          : rawValue === "\"\"" || rawValue === "''"
            ? ""
            : rawValue;

      // If changing back to original value
      if (newValue === originalValue) {
        setEditMode(null);
        if (existingPending) {
          // Remove the pending change - we're reverting to original
          pendingChangesHook.removeChange(row.key, selectedCol);
          return "↩ Reverted to original";
        }
        return "⚠ No change";
      }

      const newChange: PendingChange = {
        key: row.key,
        fileIndex: selectedCol,
        oldValue: originalValue,
        newValue,
        isNew: row.values.every((v) => v === null), // Mark as new if all values are null
      };

      upsertChange(newChange);
      setEditMode(null);
      return "✓ Value updated";
    },
    [editMode, selectedCol, upsertChange, findChange, pendingChangesHook, setEditMode]
  );

  const saveAddKey = useCallback((): string | null => {
    if (!editMode) return null;

    const key = editMode.inputValue.trim();
    if (!key) {
      return "⚠ Key cannot be empty";
    }
    // Check for duplicates (excluding the placeholder row which has empty key)
    if (diffRows.some((r) => r.key === key)) {
      return "⚠ Key already exists";
    }

    // Update the placeholder row with the new key
    setDiffRows((rows) => {
      const newRows = [...rows];
      const lastIndex = newRows.length - 1;
      const lastRow = newRows[lastIndex];
      if (lastIndex >= 0 && lastRow && lastRow.key === "") {
        newRows[lastIndex] = { ...lastRow, key };
      }
      return newRows;
    });

    setEditMode(null);
    return `✓ Added ${key} — edit cells to set values`;
  }, [editMode, diffRows, setDiffRows, setEditMode]);

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
      }

      return null;
    },
    [editMode, saveEditValue, saveAddKey, setEditMode]
  );

  const cancelEdit = useCallback((): string => {
    // If we're cancelling a new row add, remove the placeholder row
    if (editMode?.isNewRow) {
      setDiffRows((rows) => {
        // Remove the last row if it's the placeholder (empty key)
        const lastRow = rows[rows.length - 1];
        if (rows.length > 0 && lastRow && lastRow.key === "") {
          return rows.slice(0, -1);
        }
        return rows;
      });
      // Move selection back if needed
      if (selectedRow >= diffRows.length - 1) {
        setSelectedRow(Math.max(0, diffRows.length - 2));
      }
    }

    setEditMode(null);
    return "↩ Cancelled";
  }, [editMode, diffRows.length, selectedRow, setDiffRows, setSelectedRow, setEditMode]);

  return {
    editMode,
    enterEditMode,
    enterAddMode,
    handleEditInput,
    saveEdit,
    cancelEdit,
  };
}
