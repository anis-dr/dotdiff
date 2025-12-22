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
  editModeAtom,
  effectiveDiffRowsAtom,
  fileCountAtom,
  filesAtom,
  filteredRowIndicesAtom,
  messageAtom,
  modalAtom,
  pendingAtom,
  pendingKey,
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
