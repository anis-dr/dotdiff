/**
 * Atomic operations using Atom.fnSync
 *
 * Each operation reads only the atoms it needs and inlines the state logic directly.
 * This avoids the overhead of building a complete AppState snapshot for every operation.
 *
 * Usage in components:
 *   const upsertChange = useAtomSet(upsertChangeOp)
 *   upsertChange({ key: "FOO", fileIndex: 0, oldValue: "bar", newValue: "baz" })
 */
import { Atom } from "@effect-atom/atom-react";
import type { Clipboard, EditMode, EnvFile, ModalState, PendingChange } from "../types.js";
import {
  clipboardAtom,
  colWidthsAtom,
  conflictsAtom,
  currentRowAtom,
  editModeAtom,
  effectiveDiffRowsAtom,
  fileCountAtom,
  filesAtom,
  filteredRowIndicesAtom,
  messageAtom,
  modalAtom,
  pendingAtom,
  pendingKey,
  pendingListAtom,
  rowCountAtom,
  searchAtom,
  selectionAtom,
} from "./appState.js";

// =============================================================================
// Pending Changes Operations
// =============================================================================

/**
 * Upsert a pending change
 */
export const upsertChangeOp = Atom.fnSync((change: PendingChange, get) => {
  const pending = get(pendingAtom);
  const key = pendingKey(change.key, change.fileIndex);
  const newPending = new Map(pending);
  newPending.set(key, change);
  get.set(pendingAtom, newPending);
});

/**
 * Remove a specific pending change (also clears its conflict)
 */
export const removeChangeOp = Atom.fnSync(
  (args: { varKey: string; fileIndex: number; }, get) => {
    const pending = get(pendingAtom);
    const key = pendingKey(args.varKey, args.fileIndex);

    if (!pending.has(key)) return;

    const conflicts = get(conflictsAtom);
    const newPending = new Map(pending);
    newPending.delete(key);

    const newConflicts = new Set(conflicts);
    newConflicts.delete(key);

    get.set(pendingAtom, newPending);
    get.set(conflictsAtom, newConflicts);
  },
);

/**
 * Remove all pending changes for a key (all files), optionally excluding one file
 */
export const removeChangesForKeyOp = Atom.fnSync(
  (args: { varKey: string; excludeFileIndex?: number; }, get) => {
    const pending = get(pendingAtom);
    const newPending = new Map<string, PendingChange>();

    for (const [key, change] of pending) {
      if (change.key === args.varKey) {
        if (args.excludeFileIndex !== undefined && change.fileIndex === args.excludeFileIndex) {
          newPending.set(key, change);
        }
        // else: skip (remove)
      } else {
        newPending.set(key, change);
      }
    }

    get.set(pendingAtom, newPending);
  },
);

/**
 * Clear all pending changes and conflicts
 */
export const clearChangesOp = Atom.fnSync((_: void, get) => {
  get.set(pendingAtom, new Map());
  get.set(conflictsAtom, new Set());
});

/**
 * Undo the last pending change (LIFO)
 * Returns true if something was undone
 */
export const undoLastOp = Atom.fnSync((_: void, get): boolean => {
  const pending = get(pendingAtom);

  if (pending.size === 0) {
    return false;
  }

  // Map preserves insertion order, so we can get the last key
  const keys = Array.from(pending.keys());
  const lastKey = keys[keys.length - 1]!;

  const newPending = new Map(pending);
  newPending.delete(lastKey);
  get.set(pendingAtom, newPending);

  return true;
}, { initialValue: false });

/**
 * Add multiple changes at once
 */
export const addChangesOp = Atom.fnSync(
  (changes: ReadonlyArray<PendingChange>, get) => {
    const pending = get(pendingAtom);
    const newPending = new Map(pending);

    for (const change of changes) {
      const key = pendingKey(change.key, change.fileIndex);
      newPending.set(key, change);
    }

    get.set(pendingAtom, newPending);
  },
);

// =============================================================================
// Selection Operations
// =============================================================================

/**
 * Set selection row and column
 */
export const setSelectionOp = Atom.fnSync(
  (args: { row: number; col: number; }, get) => {
    get.set(selectionAtom, { row: args.row, col: args.col });
  },
);

/**
 * Move selection up (clamped to 0)
 */
export const moveUpOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const newRow = Math.max(0, selection.row - 1);
  get.set(selectionAtom, { ...selection, row: newRow });
});

/**
 * Move selection down (clamped to rowCount - 1)
 */
export const moveDownOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const rowCount = get(rowCountAtom);
  const newRow = Math.min(rowCount - 1, selection.row + 1);
  get.set(selectionAtom, { ...selection, row: newRow });
});

/**
 * Move selection left (clamped to 0)
 */
export const moveLeftOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const newCol = Math.max(0, selection.col - 1);
  get.set(selectionAtom, { ...selection, col: newCol });
});

/**
 * Move selection right (clamped to fileCount - 1)
 */
export const moveRightOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const fileCount = get(fileCountAtom);
  const newCol = Math.min(fileCount - 1, selection.col + 1);
  get.set(selectionAtom, { ...selection, col: newCol });
});

/**
 * Cycle column (wrap around)
 */
export const cycleColumnOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const fileCount = get(fileCountAtom);
  const newCol = (selection.col + 1) % fileCount;
  get.set(selectionAtom, { ...selection, col: newCol });
});

/**
 * Jump to next search match
 */
export const nextMatchOp = Atom.fnSync((_: void, get) => {
  const filteredRowIndices = get(filteredRowIndicesAtom);
  if (filteredRowIndices.length === 0) return;

  const selection = get(selectionAtom);
  const currentPos = filteredRowIndices.indexOf(selection.row);

  if (currentPos === -1) {
    get.set(selectionAtom, { ...selection, row: filteredRowIndices[0]! });
  } else {
    const nextPos = (currentPos + 1) % filteredRowIndices.length;
    get.set(selectionAtom, { ...selection, row: filteredRowIndices[nextPos]! });
  }
});

/**
 * Jump to previous search match
 */
export const prevMatchOp = Atom.fnSync((_: void, get) => {
  const filteredRowIndices = get(filteredRowIndicesAtom);
  if (filteredRowIndices.length === 0) return;

  const selection = get(selectionAtom);
  const currentPos = filteredRowIndices.indexOf(selection.row);

  if (currentPos === -1) {
    get.set(selectionAtom, {
      ...selection,
      row: filteredRowIndices[filteredRowIndices.length - 1]!,
    });
  } else {
    const prevPos = (currentPos - 1 + filteredRowIndices.length) % filteredRowIndices.length;
    get.set(selectionAtom, { ...selection, row: filteredRowIndices[prevPos]! });
  }
});

/**
 * Jump to next diff (non-identical row)
 */
export const nextDiffOp = Atom.fnSync((_: void, get) => {
  const diffRows = get(effectiveDiffRowsAtom);
  if (diffRows.length === 0) return;

  const selection = get(selectionAtom);

  for (let i = 1; i <= diffRows.length; i++) {
    const idx = (selection.row + i) % diffRows.length;
    const row = diffRows[idx];
    if (row && row.status !== "identical") {
      get.set(selectionAtom, { ...selection, row: idx });
      return;
    }
  }
});

/**
 * Jump to previous diff (non-identical row)
 */
export const prevDiffOp = Atom.fnSync((_: void, get) => {
  const diffRows = get(effectiveDiffRowsAtom);
  if (diffRows.length === 0) return;

  const selection = get(selectionAtom);

  for (let i = 1; i <= diffRows.length; i++) {
    const idx = (selection.row - i + diffRows.length) % diffRows.length;
    const row = diffRows[idx];
    if (row && row.status !== "identical") {
      get.set(selectionAtom, { ...selection, row: idx });
      return;
    }
  }
});

// =============================================================================
// File Operations
// =============================================================================

/**
 * Set files (initial load)
 */
export const setFilesOp = Atom.fnSync(
  (files: ReadonlyArray<EnvFile>, get) => {
    get.set(filesAtom, files);
  },
);

/**
 * Update a file from disk and detect conflicts
 */
export const updateFileFromDiskOp = Atom.fnSync(
  (args: { fileIndex: number; newVariables: ReadonlyMap<string, string>; }, get) => {
    const files = get(filesAtom);
    const file = files[args.fileIndex];
    if (!file) return;

    const pending = get(pendingAtom);
    const conflicts = get(conflictsAtom);

    // Detect conflicts: pending changes where oldValue no longer matches disk
    const newConflicts = new Set(conflicts);

    for (const [pKey, change] of pending) {
      if (change.fileIndex !== args.fileIndex) continue;

      const diskValue = args.newVariables.get(change.key) ?? null;
      const wasConflict = conflicts.has(pKey);

      // Conflict if disk value differs from what we recorded as oldValue
      const isConflict = diskValue !== change.oldValue;

      if (isConflict && !wasConflict) {
        newConflicts.add(pKey);
      } else if (!isConflict && wasConflict) {
        newConflicts.delete(pKey);
      }
    }

    // Update the file in state
    const newFiles = files.map((f, i) => i === args.fileIndex ? { ...f, variables: args.newVariables } : f);

    get.set(filesAtom, newFiles);
    get.set(conflictsAtom, newConflicts);
  },
);

// =============================================================================
// Edit Mode Operations
// =============================================================================

/**
 * Enter edit mode for a value
 */
export const enterEditModeOp = Atom.fnSync((currentValue: string, get) => {
  const editMode: EditMode = {
    phase: "editValue",
    inputValue: currentValue,
    dirty: false,
  };
  get.set(editModeAtom, editMode);
});

/**
 * Enter add mode (new variable)
 */
export const enterAddModeOp = Atom.fnSync((_: void, get) => {
  const editMode: EditMode = {
    phase: "addKey",
    inputValue: "",
    isNewRow: true,
    dirty: false,
  };
  get.set(editModeAtom, editMode);
});

/**
 * Update edit input value
 */
export const updateEditInputOp = Atom.fnSync((value: string, get) => {
  const editMode = get(editModeAtom);
  if (!editMode) return;

  get.set(editModeAtom, {
    ...editMode,
    inputValue: value,
    dirty: true,
  });
});

/**
 * Exit edit mode
 */
export const exitEditModeOp = Atom.fnSync((_: void, get) => {
  get.set(editModeAtom, null);
});

// =============================================================================
// Clipboard Operations
// =============================================================================

/**
 * Set clipboard
 */
export const setClipboardOp = Atom.fnSync((clipboard: Clipboard, get) => {
  get.set(clipboardAtom, clipboard);
});

// =============================================================================
// Search Operations
// =============================================================================

/**
 * Open search
 */
export const openSearchOp = Atom.fnSync((_: void, get) => {
  get.set(searchAtom, { active: true, query: "" });
});

/**
 * Close search
 */
export const closeSearchOp = Atom.fnSync((_: void, get) => {
  get.set(searchAtom, { active: false, query: "" });
});

/**
 * Update search query
 */
export const setSearchQueryOp = Atom.fnSync((query: string, get) => {
  const search = get(searchAtom);
  get.set(searchAtom, { ...search, query });
});

// =============================================================================
// Modal Operations
// =============================================================================

/**
 * Open a modal
 */
export const openModalOp = Atom.fnSync((modal: ModalState, get) => {
  get.set(modalAtom, modal);
});

/**
 * Close modal
 */
export const closeModalOp = Atom.fnSync((_: void, get) => {
  get.set(modalAtom, null);
});

// =============================================================================
// Message Operations
// =============================================================================

/**
 * Set message (for flash messages)
 */
export const setMessageOp = Atom.fnSync((message: string | null, get) => {
  get.set(messageAtom, message);
});

// =============================================================================
// Layout Operations
// =============================================================================

/**
 * Set column widths
 */
export const setColWidthsOp = Atom.fnSync(
  (colWidths: ReadonlyArray<number>, get) => {
    get.set(colWidthsAtom, colWidths);
  },
);

// =============================================================================
// Action Operations
// =============================================================================
// High-level operations that combine reads, business logic, and writes.
// These move business logic from React hooks into atoms for better testability
// and elimination of stale closure issues.

/**
 * Helper to get original value from files
 */
const getOriginalValue = (
  files: ReadonlyArray<EnvFile>,
  varKey: string,
  fileIndex: number,
): string | null => {
  const file = files[fileIndex];
  return file?.variables.get(varKey) ?? null;
};

// -----------------------------------------------------------------------------
// Edit Actions
// -----------------------------------------------------------------------------

/**
 * Enter edit mode for the current cell
 */
export const enterEditModeActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const selection = get(selectionAtom);
  if (!currentRow) return;

  const value = currentRow.values[selection.col];
  const editMode: EditMode = {
    phase: "editValue",
    inputValue: value ?? "",
    dirty: false,
  };
  get.set(editModeAtom, editMode);
});

/**
 * Update edit input value (delegates to existing updateEditInputOp logic)
 */
export const editInputActionOp = Atom.fnSync((value: string, get) => {
  const editMode = get(editModeAtom);
  if (!editMode) return;

  get.set(editModeAtom, {
    ...editMode,
    inputValue: value,
    dirty: true,
  });
});

/**
 * Save edit - full logic: validates, computes newValue, upserts/removes change, sets message
 */
export const saveEditActionOp = Atom.fnSync(
  (args: { submittedValue?: string; }, get) => {
    const currentRow = get(currentRowAtom);
    const editMode = get(editModeAtom);
    const selection = get(selectionAtom);
    const files = get(filesAtom);

    if (!currentRow || !editMode) {
      get.set(editModeAtom, null);
      return;
    }

    const inputValue = args.submittedValue ?? editMode.inputValue;

    // If user didn't type anything, just cancel
    if (!editMode.dirty) {
      get.set(editModeAtom, null);
      get.set(messageAtom, "⊘ Edit cancelled");
      return;
    }

    // Compute newValue (null for deletion, "" for empty, etc.)
    let newValue: string | null;
    const trimmed = inputValue.trim();
    if (trimmed === "<null>" || trimmed === "<unset>") {
      newValue = null;
    } else if (trimmed === "\"\"" || trimmed === "''") {
      newValue = "";
    } else {
      newValue = inputValue;
    }

    const originalValue = getOriginalValue(files, currentRow.key, selection.col);

    if (newValue === originalValue) {
      // Remove pending change
      const pending = get(pendingAtom);
      const key = pendingKey(currentRow.key, selection.col);
      const newPending = new Map(pending);
      newPending.delete(key);
      get.set(pendingAtom, newPending);
      get.set(editModeAtom, null);
      get.set(messageAtom, "⊘ No change");
      return;
    }

    // Upsert change
    const pending = get(pendingAtom);
    const key = pendingKey(currentRow.key, selection.col);
    const newPending = new Map(pending);
    newPending.set(key, {
      key: currentRow.key,
      fileIndex: selection.col,
      oldValue: originalValue,
      newValue,
    });
    get.set(pendingAtom, newPending);
    get.set(editModeAtom, null);
    get.set(messageAtom, "✓ Value updated");
  },
);

/**
 * Cancel edit - exits edit mode and shows message
 */
export const cancelEditActionOp = Atom.fnSync((_: void, get) => {
  get.set(editModeAtom, null);
  get.set(messageAtom, "⊘ Edit cancelled");
});

// -----------------------------------------------------------------------------
// Clipboard Actions
// -----------------------------------------------------------------------------

/**
 * Copy current cell value to clipboard
 */
export const copyActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const selection = get(selectionAtom);
  if (!currentRow) return;

  const value = currentRow.values[selection.col];
  if (value === null || value === undefined) {
    get.set(messageAtom, "⚠ Nothing to copy");
    return;
  }

  get.set(clipboardAtom, { key: currentRow.key, value });
  get.set(messageAtom, `📋 Copied ${currentRow.key}`);
});

/**
 * Paste clipboard value to current cell
 */
export const pasteActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const clipboard = get(clipboardAtom);
  const selection = get(selectionAtom);
  const files = get(filesAtom);

  if (!currentRow || !clipboard) {
    get.set(messageAtom, "⚠ Clipboard empty");
    return;
  }

  const originalValue = getOriginalValue(files, currentRow.key, selection.col);
  if (clipboard.value === originalValue) {
    get.set(messageAtom, "⚠ Same value");
    return;
  }

  const pending = get(pendingAtom);
  const key = pendingKey(currentRow.key, selection.col);
  const newPending = new Map(pending);
  newPending.set(key, {
    key: currentRow.key,
    fileIndex: selection.col,
    oldValue: originalValue,
    newValue: clipboard.value,
  });
  get.set(pendingAtom, newPending);
  get.set(messageAtom, `📋 Pasted to ${currentRow.key}`);
});

/**
 * Paste clipboard value to all files for current row
 */
export const pasteAllActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const clipboard = get(clipboardAtom);
  const files = get(filesAtom);
  const fileCount = get(fileCountAtom);

  if (!currentRow || !clipboard) {
    get.set(messageAtom, "⚠ Clipboard empty");
    return;
  }

  const pending = get(pendingAtom);
  const newPending = new Map(pending);
  let changeCount = 0;

  for (let i = 0; i < fileCount; i++) {
    const originalValue = getOriginalValue(files, currentRow.key, i);
    if (clipboard.value !== originalValue) {
      const key = pendingKey(currentRow.key, i);
      newPending.set(key, {
        key: currentRow.key,
        fileIndex: i,
        oldValue: originalValue,
        newValue: clipboard.value,
      });
      changeCount++;
    }
  }

  if (changeCount === 0) {
    get.set(messageAtom, "⚠ All files already have this value");
    return;
  }

  get.set(pendingAtom, newPending);
  get.set(messageAtom, `📋 Pasted to ${changeCount} files`);
});

// -----------------------------------------------------------------------------
// Delete Actions
// -----------------------------------------------------------------------------

/**
 * Mark current cell variable for deletion
 */
export const deleteVariableActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const selection = get(selectionAtom);
  const files = get(filesAtom);
  const pending = get(pendingAtom);

  if (!currentRow) return;

  const originalValue = getOriginalValue(files, currentRow.key, selection.col);
  const pKey = pendingKey(currentRow.key, selection.col);
  const pendingChange = pending.get(pKey);
  const effectiveValue = pendingChange ? pendingChange.newValue : originalValue;

  if (effectiveValue === null) {
    get.set(messageAtom, "⚠ Already missing in this file");
    return;
  }

  if (originalValue === null) {
    // Value only exists due to pending change, revert it
    const newPending = new Map(pending);
    newPending.delete(pKey);
    get.set(pendingAtom, newPending);
    get.set(messageAtom, "↩ Reverted to missing");
    return;
  }

  const newPending = new Map(pending);
  newPending.set(pKey, {
    key: currentRow.key,
    fileIndex: selection.col,
    oldValue: originalValue,
    newValue: null,
  });
  get.set(pendingAtom, newPending);
  get.set(messageAtom, `✗ Marked ${currentRow.key} for deletion`);
});

/**
 * Mark current row variable for deletion in all files
 */
export const deleteAllActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const files = get(filesAtom);
  const fileCount = get(fileCountAtom);
  const pending = get(pendingAtom);
  const pendingList = get(pendingListAtom);

  if (!currentRow) return;

  const newPending = new Map<string, PendingChange>();
  let deleteCount = 0;

  // First, copy pending changes that are NOT for this key
  for (const [key, change] of pending) {
    if (change.key !== currentRow.key) {
      newPending.set(key, change);
    }
  }

  // Now add deletion changes for all files where original exists
  for (let i = 0; i < fileCount; i++) {
    const originalValue = getOriginalValue(files, currentRow.key, i);
    if (originalValue !== null) {
      const key = pendingKey(currentRow.key, i);
      newPending.set(key, {
        key: currentRow.key,
        fileIndex: i,
        oldValue: originalValue,
        newValue: null,
      });
      deleteCount++;
    }
  }

  if (deleteCount === 0) {
    const hadPendingForKey = pendingList.some((c) => c.key === currentRow.key);
    if (hadPendingForKey) {
      get.set(pendingAtom, newPending);
      get.set(messageAtom, "↩ Reverted pending values (now missing everywhere)");
    } else {
      get.set(messageAtom, "⚠ Already missing in all files");
    }
    return;
  }

  get.set(pendingAtom, newPending);
  get.set(messageAtom, `✗ Marked ${currentRow.key} for deletion in ${deleteCount} files`);
});

// -----------------------------------------------------------------------------
// Sync Actions
// -----------------------------------------------------------------------------

/**
 * Sync value from left file to right file (2-file mode only)
 */
export const syncToRightActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const fileCount = get(fileCountAtom);
  const files = get(filesAtom);

  if (!currentRow || fileCount !== 2) return;

  const leftValue = currentRow.values[0] ?? null;
  if (leftValue === null) {
    get.set(messageAtom, "⚠ Left value is missing");
    return;
  }

  const rightValue = currentRow.values[1] ?? null;
  if (leftValue === rightValue) {
    get.set(messageAtom, "⚠ Values already match");
    return;
  }

  const pending = get(pendingAtom);
  const key = pendingKey(currentRow.key, 1);
  const newPending = new Map(pending);
  newPending.set(key, {
    key: currentRow.key,
    fileIndex: 1,
    oldValue: getOriginalValue(files, currentRow.key, 1),
    newValue: leftValue,
  });
  get.set(pendingAtom, newPending);
  get.set(messageAtom, "→ Synced to right");
});

/**
 * Sync value from right file to left file (2-file mode only)
 */
export const syncToLeftActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const fileCount = get(fileCountAtom);
  const files = get(filesAtom);

  if (!currentRow || fileCount !== 2) return;

  const rightValue = currentRow.values[1] ?? null;
  if (rightValue === null) {
    get.set(messageAtom, "⚠ Right value is missing");
    return;
  }

  const leftValue = currentRow.values[0] ?? null;
  if (rightValue === leftValue) {
    get.set(messageAtom, "⚠ Values already match");
    return;
  }

  const pending = get(pendingAtom);
  const key = pendingKey(currentRow.key, 0);
  const newPending = new Map(pending);
  newPending.set(key, {
    key: currentRow.key,
    fileIndex: 0,
    oldValue: getOriginalValue(files, currentRow.key, 0),
    newValue: rightValue,
  });
  get.set(pendingAtom, newPending);
  get.set(messageAtom, "← Synced to left");
});

// -----------------------------------------------------------------------------
// Undo Actions
// -----------------------------------------------------------------------------

/**
 * Revert pending change for current cell
 */
export const revertActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const selection = get(selectionAtom);
  const pending = get(pendingAtom);

  if (!currentRow) return;

  const pKey = pendingKey(currentRow.key, selection.col);
  if (!pending.has(pKey)) {
    get.set(messageAtom, "⚠ No pending change to revert");
    return;
  }

  const conflicts = get(conflictsAtom);
  const newPending = new Map(pending);
  newPending.delete(pKey);

  const newConflicts = new Set(conflicts);
  newConflicts.delete(pKey);

  get.set(pendingAtom, newPending);
  get.set(conflictsAtom, newConflicts);
  get.set(messageAtom, "↩ Reverted to original");
});

/**
 * Undo last pending change (LIFO)
 */
export const undoActionOp = Atom.fnSync((_: void, get) => {
  const pending = get(pendingAtom);

  if (pending.size === 0) {
    get.set(messageAtom, "⚠ Nothing to undo");
    return;
  }

  const keys = Array.from(pending.keys());
  const lastKey = keys[keys.length - 1]!;

  const newPending = new Map(pending);
  newPending.delete(lastKey);
  get.set(pendingAtom, newPending);
  get.set(messageAtom, "↩ Undone");
});

/**
 * Undo all pending changes
 */
export const undoAllActionOp = Atom.fnSync((_: void, get) => {
  const pending = get(pendingAtom);

  if (pending.size === 0) {
    get.set(messageAtom, "⚠ Nothing to undo");
    return;
  }

  get.set(pendingAtom, new Map());
  get.set(conflictsAtom, new Set());
  get.set(messageAtom, "↩ All changes undone");
});
