/**
 * Atomic operations using Atom.fnSync
 *
 * These operations wrap the pure action functions from actions.ts to provide
 * atomic state updates via effect-atom's FnContext.
 *
 * The pure actions in actions.ts remain the single source of truth for state logic.
 * This file simply bridges them to the atom layer.
 *
 * Usage in components:
 *   const upsertChange = useAtomSet(upsertChangeOp)
 *   upsertChange({ key: "FOO", fileIndex: 0, oldValue: "bar", newValue: "baz" })
 */
import { Atom } from "@effect-atom/atom-react";
import type { PendingChange, EnvFile, Clipboard, ModalState } from "../types.js";
import {
  pendingAtom,
  conflictsAtom,
  selectionAtom,
  filesAtom,
  clipboardAtom,
  modalAtom,
  searchAtom,
  editModeAtom,
  messageAtom,
  colWidthsAtom,
  fileCountAtom,
  rowCountAtom,
  effectiveDiffRowsAtom,
  filteredRowIndicesAtom,
  pendingKey,
  type AppState,
} from "./appState.js";
import * as A from "./actions.js";

// =============================================================================
// Helper: Build AppState snapshot from atoms for pure action functions
// =============================================================================

const buildState = (get: Atom.FnContext): AppState => ({
  files: get(filesAtom),
  pending: get(pendingAtom),
  conflicts: get(conflictsAtom),
  selection: get(selectionAtom),
  editMode: get(editModeAtom),
  clipboard: get(clipboardAtom),
  search: get(searchAtom),
  modal: get(modalAtom),
  message: get(messageAtom),
  colWidths: get(colWidthsAtom),
});

// =============================================================================
// Pending Changes Operations
// =============================================================================

/**
 * Upsert a pending change
 */
export const upsertChangeOp = Atom.fnSync((change: PendingChange, get) => {
  const state = buildState(get);
  const newState = A.upsertChange(state, change);
  get.set(pendingAtom, newState.pending);
});

/**
 * Remove a specific pending change (also clears its conflict)
 */
export const removeChangeOp = Atom.fnSync(
  (args: { varKey: string; fileIndex: number }, get) => {
    const state = buildState(get);
    const newState = A.removeChange(state, args.varKey, args.fileIndex);
    Atom.batch(() => {
      get.set(pendingAtom, newState.pending);
      get.set(conflictsAtom, newState.conflicts);
    });
  }
);

/**
 * Remove all pending changes for a key (all files), optionally excluding one file
 */
export const removeChangesForKeyOp = Atom.fnSync(
  (args: { varKey: string; excludeFileIndex?: number }, get) => {
    const state = buildState(get);
    const newState = A.removeChangesForKey(state, args.varKey, args.excludeFileIndex);
    get.set(pendingAtom, newState.pending);
  }
);

/**
 * Clear all pending changes and conflicts
 */
export const clearChangesOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const newState = A.clearChanges(state);
  Atom.batch(() => {
    get.set(pendingAtom, newState.pending);
    get.set(conflictsAtom, newState.conflicts);
  });
});

/**
 * Undo the last pending change (LIFO)
 * Returns true if something was undone
 */
export const undoLastOp = Atom.fnSync((_: void, get): boolean => {
  const state = buildState(get);
  const { state: newState, didUndo } = A.undoLast(state);
  if (didUndo) {
    get.set(pendingAtom, newState.pending);
  }
  return didUndo;
}, { initialValue: false });

/**
 * Add multiple changes at once
 */
export const addChangesOp = Atom.fnSync(
  (changes: ReadonlyArray<PendingChange>, get) => {
    const state = buildState(get);
    const newState = A.addChanges(state, changes);
    get.set(pendingAtom, newState.pending);
  }
);

// =============================================================================
// Selection Operations
// =============================================================================

/**
 * Set selection row and column
 */
export const setSelectionOp = Atom.fnSync(
  (args: { row: number; col: number }, get) => {
    const state = buildState(get);
    const newState = A.setSelection(state, args.row, args.col);
    get.set(selectionAtom, newState.selection);
  }
);

/**
 * Move selection up (clamped to 0)
 */
export const moveUpOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const newState = A.moveUp(state);
  get.set(selectionAtom, newState.selection);
});

/**
 * Move selection down (clamped to rowCount - 1)
 */
export const moveDownOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const rowCount = get(rowCountAtom);
  const newState = A.moveDown(state, rowCount);
  get.set(selectionAtom, newState.selection);
});

/**
 * Move selection left (clamped to 0)
 */
export const moveLeftOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const newState = A.moveLeft(state);
  get.set(selectionAtom, newState.selection);
});

/**
 * Move selection right (clamped to fileCount - 1)
 */
export const moveRightOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const fileCount = get(fileCountAtom);
  const newState = A.moveRight(state, fileCount);
  get.set(selectionAtom, newState.selection);
});

/**
 * Cycle column (wrap around)
 */
export const cycleColumnOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const fileCount = get(fileCountAtom);
  const newState = A.cycleColumn(state, fileCount);
  get.set(selectionAtom, newState.selection);
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
    const state = buildState(get);
    const newState = A.setFiles(state, files);
    get.set(filesAtom, newState.files);
  }
);

/**
 * Update a file from disk and detect conflicts
 */
export const updateFileFromDiskOp = Atom.fnSync(
  (args: { fileIndex: number; newVariables: ReadonlyMap<string, string> }, get) => {
    const state = buildState(get);
    const newState = A.updateFileFromDisk(state, args.fileIndex, args.newVariables);
    Atom.batch(() => {
      get.set(filesAtom, newState.files);
      get.set(conflictsAtom, newState.conflicts);
    });
  }
);

// =============================================================================
// Edit Mode Operations
// =============================================================================

/**
 * Enter edit mode for a value
 */
export const enterEditModeOp = Atom.fnSync((currentValue: string, get) => {
  const state = buildState(get);
  const newState = A.enterEditMode(state, currentValue);
  get.set(editModeAtom, newState.editMode);
});

/**
 * Enter add mode (new variable)
 */
export const enterAddModeOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const newState = A.enterAddMode(state);
  get.set(editModeAtom, newState.editMode);
});

/**
 * Update edit input value
 */
export const updateEditInputOp = Atom.fnSync((value: string, get) => {
  const state = buildState(get);
  const newState = A.updateEditInput(state, value);
  get.set(editModeAtom, newState.editMode);
});

/**
 * Exit edit mode
 */
export const exitEditModeOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const newState = A.exitEditMode(state);
  get.set(editModeAtom, newState.editMode);
});

// =============================================================================
// Clipboard Operations
// =============================================================================

/**
 * Set clipboard
 */
export const setClipboardOp = Atom.fnSync((clipboard: Clipboard, get) => {
  const state = buildState(get);
  const newState = A.setClipboard(state, clipboard);
  get.set(clipboardAtom, newState.clipboard);
});

// =============================================================================
// Search Operations
// =============================================================================

/**
 * Open search
 */
export const openSearchOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const newState = A.openSearch(state);
  get.set(searchAtom, newState.search);
});

/**
 * Close search
 */
export const closeSearchOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const newState = A.closeSearch(state);
  get.set(searchAtom, newState.search);
});

/**
 * Update search query
 */
export const setSearchQueryOp = Atom.fnSync((query: string, get) => {
  const state = buildState(get);
  const newState = A.setSearchQuery(state, query);
  get.set(searchAtom, newState.search);
});

// =============================================================================
// Modal Operations
// =============================================================================

/**
 * Open a modal
 */
export const openModalOp = Atom.fnSync((modal: ModalState, get) => {
  const state = buildState(get);
  const newState = A.openModal(state, modal);
  get.set(modalAtom, newState.modal);
});

/**
 * Close modal
 */
export const closeModalOp = Atom.fnSync((_: void, get) => {
  const state = buildState(get);
  const newState = A.closeModal(state);
  get.set(modalAtom, newState.modal);
});

// =============================================================================
// Message Operations
// =============================================================================

/**
 * Set message (for flash messages)
 */
export const setMessageOp = Atom.fnSync((message: string | null, get) => {
  const state = buildState(get);
  const newState = A.setMessage(state, message);
  get.set(messageAtom, newState.message);
});

// =============================================================================
// Layout Operations
// =============================================================================

/**
 * Set column widths
 */
export const setColWidthsOp = Atom.fnSync(
  (colWidths: ReadonlyArray<number>, get) => {
    const state = buildState(get);
    const newState = A.setColWidths(state, colWidths);
    get.set(colWidthsAtom, newState.colWidths);
  }
);
