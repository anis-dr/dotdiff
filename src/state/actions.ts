/**
 * Pure state transition functions for AppState
 *
 * All functions are pure: (state, ...args) => newState
 * No side effects, no I/O - just state transformations.
 */
import type { Clipboard, DiffRow, EditMode, EnvFile, ModalState, PendingChange, SearchState } from "../types.js";
import type { AppState } from "./appState.js";
import { pendingKey } from "./appState.js";

// =============================================================================
// File State
// =============================================================================

/** Initialize files (on load) */
export const setFiles = (state: AppState, files: ReadonlyArray<EnvFile>): AppState => ({
  ...state,
  files,
});

/** Update files after save (applies pending changes to ground truth) */
export const applyPendingToFiles = (state: AppState): AppState => {
  const newFiles = state.files.map((file, fileIndex) => {
    const newVariables = new Map(file.variables);

    for (const [, change] of state.pending) {
      if (change.fileIndex !== fileIndex) continue;

      if (change.newValue === null) {
        newVariables.delete(change.key);
      } else {
        newVariables.set(change.key, change.newValue);
      }
    }

    return { ...file, variables: newVariables };
  });

  return {
    ...state,
    files: newFiles,
    pending: new Map(), // Clear pending after applying
  };
};

// =============================================================================
// Pending Changes
// =============================================================================

/** Add or update a pending change */
export const upsertChange = (state: AppState, change: PendingChange): AppState => {
  const key = pendingKey(change.key, change.fileIndex);
  const newPending = new Map(state.pending);
  newPending.set(key, change);
  return { ...state, pending: newPending };
};

/** Remove a specific pending change (also clears its conflict) */
export const removeChange = (state: AppState, varKey: string, fileIndex: number): AppState => {
  const key = pendingKey(varKey, fileIndex);
  if (!state.pending.has(key)) return state;

  const newPending = new Map(state.pending);
  newPending.delete(key);

  const newConflicts = new Set(state.conflicts);
  newConflicts.delete(key);

  return { ...state, pending: newPending, conflicts: newConflicts };
};

/** Remove all pending changes for a key (all files) */
export const removeChangesForKey = (
  state: AppState,
  varKey: string,
  excludeFileIndex?: number
): AppState => {
  const newPending = new Map<string, PendingChange>();

  for (const [key, change] of state.pending) {
    if (change.key === varKey) {
      if (excludeFileIndex !== undefined && change.fileIndex === excludeFileIndex) {
        newPending.set(key, change);
      }
      // else: skip (remove)
    } else {
      newPending.set(key, change);
    }
  }

  return { ...state, pending: newPending };
};

/** Clear all pending changes */
export const clearChanges = (state: AppState): AppState => ({
  ...state,
  pending: new Map(),
  conflicts: new Set(),
});

/** Undo the last pending change (LIFO) */
export const undoLast = (state: AppState): { state: AppState; didUndo: boolean } => {
  if (state.pending.size === 0) {
    return { state, didUndo: false };
  }

  // Map preserves insertion order, so we can get the last key
  const keys = Array.from(state.pending.keys());
  const lastKey = keys[keys.length - 1]!;

  const newPending = new Map(state.pending);
  newPending.delete(lastKey);

  return { state: { ...state, pending: newPending }, didUndo: true };
};

/** Find a pending change by key and file index */
export const findChange = (
  state: AppState,
  varKey: string,
  fileIndex: number
): PendingChange | undefined => {
  const key = pendingKey(varKey, fileIndex);
  return state.pending.get(key);
};

/** Add multiple changes at once */
export const addChanges = (
  state: AppState,
  changes: ReadonlyArray<PendingChange>
): AppState => {
  const newPending = new Map(state.pending);
  for (const change of changes) {
    const key = pendingKey(change.key, change.fileIndex);
    newPending.set(key, change);
  }
  return { ...state, pending: newPending };
};

// =============================================================================
// Selection
// =============================================================================

/** Set selection row and column */
export const setSelection = (
  state: AppState,
  row: number,
  col: number
): AppState => ({
  ...state,
  selection: { row, col },
});

/** Move selection up (clamped to 0) */
export const moveUp = (state: AppState): AppState => ({
  ...state,
  selection: {
    ...state.selection,
    row: Math.max(0, state.selection.row - 1),
  },
});

/** Move selection down (clamped to rowCount - 1) */
export const moveDown = (state: AppState, rowCount: number): AppState => ({
  ...state,
  selection: {
    ...state.selection,
    row: Math.min(rowCount - 1, state.selection.row + 1),
  },
});

/** Move selection left (clamped to 0) */
export const moveLeft = (state: AppState): AppState => ({
  ...state,
  selection: {
    ...state.selection,
    col: Math.max(0, state.selection.col - 1),
  },
});

/** Move selection right (clamped to fileCount - 1) */
export const moveRight = (state: AppState, fileCount: number): AppState => ({
  ...state,
  selection: {
    ...state.selection,
    col: Math.min(fileCount - 1, state.selection.col + 1),
  },
});

/** Cycle column (wrap around) */
export const cycleColumn = (state: AppState, fileCount: number): AppState => ({
  ...state,
  selection: {
    ...state.selection,
    col: (state.selection.col + 1) % fileCount,
  },
});

// =============================================================================
// Edit Mode
// =============================================================================

/** Enter edit mode for a value */
export const enterEditMode = (
  state: AppState,
  currentValue: string
): AppState => ({
  ...state,
  editMode: {
    phase: "editValue",
    inputValue: currentValue,
    dirty: false,
  },
});

/** Enter add mode (new variable) */
export const enterAddMode = (state: AppState): AppState => ({
  ...state,
  editMode: {
    phase: "addKey",
    inputValue: "",
    isNewRow: true,
    dirty: false,
  },
});

/** Update edit input value */
export const updateEditInput = (state: AppState, value: string): AppState => {
  if (!state.editMode) return state;
  return {
    ...state,
    editMode: {
      ...state.editMode,
      inputValue: value,
      dirty: true,
    },
  };
};

/** Exit edit mode */
export const exitEditMode = (state: AppState): AppState => ({
  ...state,
  editMode: null,
});

// =============================================================================
// Clipboard
// =============================================================================

/** Set clipboard */
export const setClipboard = (state: AppState, clipboard: Clipboard): AppState => ({
  ...state,
  clipboard,
});

/** Clear clipboard */
export const clearClipboard = (state: AppState): AppState => ({
  ...state,
  clipboard: null,
});

// =============================================================================
// Search
// =============================================================================

/** Open search */
export const openSearch = (state: AppState): AppState => ({
  ...state,
  search: { active: true, query: "" },
});

/** Close search */
export const closeSearch = (state: AppState): AppState => ({
  ...state,
  search: { active: false, query: "" },
});

/** Update search query */
export const setSearchQuery = (state: AppState, query: string): AppState => ({
  ...state,
  search: { ...state.search, query },
});

// =============================================================================
// Modal
// =============================================================================

/** Open a modal */
export const openModal = (state: AppState, modal: ModalState): AppState => ({
  ...state,
  modal,
});

/** Close modal */
export const closeModal = (state: AppState): AppState => ({
  ...state,
  modal: null,
});

// =============================================================================
// Message
// =============================================================================

/** Set message */
export const setMessage = (state: AppState, message: string | null): AppState => ({
  ...state,
  message,
});

// =============================================================================
// Layout
// =============================================================================

/** Set column widths */
export const setColWidths = (
  state: AppState,
  colWidths: ReadonlyArray<number>
): AppState => ({
  ...state,
  colWidths,
});

// =============================================================================
// Composite Actions
// =============================================================================

/**
 * Get effective value for a cell (original + pending overlay)
 */
export const getEffectiveValue = (
  state: AppState,
  varKey: string,
  fileIndex: number
): string | null => {
  const pending = findChange(state, varKey, fileIndex);
  if (pending !== undefined) {
    return pending.newValue;
  }

  const file = state.files[fileIndex];
  if (!file) return null;

  return file.variables.get(varKey) ?? null;
};

/**
 * Get original value for a cell (ignores pending)
 */
export const getOriginalValue = (
  state: AppState,
  varKey: string,
  fileIndex: number
): string | null => {
  const file = state.files[fileIndex];
  if (!file) return null;
  return file.variables.get(varKey) ?? null;
};

// =============================================================================
// File Watcher Actions
// =============================================================================

/**
 * Update a single file from disk and detect conflicts.
 * Called when file watcher detects external change.
 */
export const updateFileFromDisk = (
  state: AppState,
  fileIndex: number,
  newVariables: ReadonlyMap<string, string>
): AppState => {
  const file = state.files[fileIndex];
  if (!file) return state;

  // Detect conflicts: pending changes where oldValue no longer matches disk
  const newConflicts = new Set(state.conflicts);

  for (const [pKey, change] of state.pending) {
    if (change.fileIndex !== fileIndex) continue;

    const diskValue = newVariables.get(change.key) ?? null;
    const wasConflict = state.conflicts.has(pKey);

    // Conflict if disk value differs from what we recorded as oldValue
    const isConflict = diskValue !== change.oldValue;

    if (isConflict && !wasConflict) {
      newConflicts.add(pKey);
    } else if (!isConflict && wasConflict) {
      newConflicts.delete(pKey);
    }
  }

  // Update the file in state
  const newFiles = state.files.map((f, i) =>
    i === fileIndex ? { ...f, variables: newVariables } : f
  );

  return {
    ...state,
    files: newFiles,
    conflicts: newConflicts,
  };
};


