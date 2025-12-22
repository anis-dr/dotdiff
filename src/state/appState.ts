/**
 * Normalized application state - split into focused atoms for better performance
 *
 * Each atom slice only triggers re-renders for components that depend on it.
 * Derived atoms compute values from the base atoms.
 */
import { atom } from "jotai";
import type {
  Clipboard,
  DiffRow,
  EditMode,
  EnvFile,
  ModalState,
  PendingChange,
  SearchState,
} from "../types.js";
import { getVariableStatus } from "../types.js";

// =============================================================================
// Pending Change Key Helpers
// =============================================================================

/** Create a unique key for a pending change */
export const pendingKey = (varKey: string, fileIndex: number): string =>
  `${varKey}:${fileIndex}`;

// =============================================================================
// Base Atoms - Split by concern for granular re-renders
// =============================================================================

/** Files as loaded from disk */
export const filesAtom = atom<ReadonlyArray<EnvFile>>([]);

/** Pending changes - keyed by "${varKey}:${fileIndex}" */
export const pendingAtom = atom<ReadonlyMap<string, PendingChange>>(new Map());

/** Conflicts - set of pendingKey strings where disk value changed */
export const conflictsAtom = atom<ReadonlySet<string>>(new Set<string>());

/** Selection state */
export const selectionAtom = atom<{ readonly row: number; readonly col: number }>({
  row: 0,
  col: 0,
});

/** Edit mode state */
export const editModeAtom = atom<EditMode | null>(null);

/** Clipboard state */
export const clipboardAtom = atom<Clipboard | null>(null);

/** Search state */
export const searchAtom = atom<SearchState>({ active: false, query: "" });

/** Modal state */
export const modalAtom = atom<ModalState | null>(null);

/** Message state */
export const messageAtom = atom<string | null>(null);

/** Layout column widths */
export const colWidthsAtom = atom<ReadonlyArray<number>>([]);

// =============================================================================
// App State Type (composite for backward compatibility)
// =============================================================================

export interface AppState {
  // Ground truth - files as loaded from disk
  readonly files: ReadonlyArray<EnvFile>;

  // Pending changes - keyed by "${varKey}:${fileIndex}"
  readonly pending: ReadonlyMap<string, PendingChange>;

  // Conflicts - set of pendingKey strings where disk value changed
  readonly conflicts: ReadonlySet<string>;

  // UI State
  readonly selection: {
    readonly row: number;
    readonly col: number;
  };
  readonly editMode: EditMode | null;
  readonly clipboard: Clipboard | null;
  readonly search: SearchState;
  readonly modal: ModalState | null;
  readonly message: string | null;

  // Layout (computed from terminal width, stored for components)
  readonly colWidths: ReadonlyArray<number>;
}

// =============================================================================
// Initial State
// =============================================================================

export const initialAppState: AppState = {
  files: [],
  pending: new Map(),
  conflicts: new Set(),
  selection: { row: 0, col: 0 },
  editMode: null,
  clipboard: null,
  search: { active: false, query: "" },
  modal: null,
  message: null,
  colWidths: [],
};

// =============================================================================
// Composite App State Atom (backward compatible read/write)
// =============================================================================

/**
 * Composite atom that combines all base atoms into a single AppState.
 * This provides backward compatibility while still allowing granular subscriptions.
 */
export const appStateAtom = atom(
  // Getter: compose from base atoms
  (get): AppState => ({
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
  }),
  // Setter: dispatch updates to individual atoms
  (get, set, update: AppState | ((prev: AppState) => AppState)) => {
    const prev = get(appStateAtom);
    const next = typeof update === "function" ? update(prev) : update;

    // Only update atoms that actually changed
    if (next.files !== prev.files) set(filesAtom, next.files);
    if (next.pending !== prev.pending) set(pendingAtom, next.pending);
    if (next.conflicts !== prev.conflicts) set(conflictsAtom, next.conflicts);
    if (next.selection !== prev.selection) set(selectionAtom, next.selection);
    if (next.editMode !== prev.editMode) set(editModeAtom, next.editMode);
    if (next.clipboard !== prev.clipboard) set(clipboardAtom, next.clipboard);
    if (next.search !== prev.search) set(searchAtom, next.search);
    if (next.modal !== prev.modal) set(modalAtom, next.modal);
    if (next.message !== prev.message) set(messageAtom, next.message);
    if (next.colWidths !== prev.colWidths) set(colWidthsAtom, next.colWidths);
  }
);

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Computes diff rows from files + pending changes.
 * This is the "effective" view - what the user sees and what will be saved.
 */
export const effectiveDiffRowsAtom = atom((get): ReadonlyArray<DiffRow> => {
  const files = get(filesAtom);
  const pending = get(pendingAtom);

  if (files.length === 0) return [];

  // Collect all keys from all files
  const allKeys = new Set<string>();
  for (const file of files) {
    for (const key of file.variables.keys()) {
      allKeys.add(key);
    }
  }

  // Also include keys from pending changes (new keys)
  for (const change of pending.values()) {
    if (change.newValue !== null) {
      allKeys.add(change.key);
    }
  }

  // Build rows with effective values (original + pending overlay)
  const rows: DiffRow[] = [];

  for (const key of allKeys) {
    const values: (string | null)[] = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex]!;
      const originalValue = file.variables.get(key) ?? null;

      // Check for pending change
      const pKey = pendingKey(key, fileIndex);
      const pendingChange = pending.get(pKey);

      // Effective value: pending overrides original
      const effectiveValue = pendingChange !== undefined
        ? pendingChange.newValue
        : originalValue;

      values.push(effectiveValue);
    }

    const status = getVariableStatus(values);
    rows.push({ key, values, status });
  }

  // Sort alphabetically by key (stable order - rows don't jump when editing)
  rows.sort((a, b) => a.key.toLowerCase().localeCompare(b.key.toLowerCase()));

  return rows;
});

/**
 * The currently selected row with effective values
 */
export const currentRowAtom = atom((get): DiffRow | null => {
  const selection = get(selectionAtom);
  const rows = get(effectiveDiffRowsAtom);
  return rows[selection.row] ?? null;
});

/**
 * Stats: counts of identical/different/missing rows
 */
export const statsAtom = atom((get) => {
  const rows = get(effectiveDiffRowsAtom);
  const counts = { identical: 0, different: 0, missing: 0 };
  for (const row of rows) {
    counts[row.status]++;
  }
  return counts;
});

/**
 * Pending changes as a flat array (for iteration, save preview, etc.)
 */
export const pendingListAtom = atom((get): ReadonlyArray<PendingChange> => {
  const pending = get(pendingAtom);
  return Array.from(pending.values());
});

/**
 * Filtered row indices based on search query
 */
export const filteredRowIndicesAtom = atom((get): ReadonlyArray<number> => {
  const search = get(searchAtom);
  const rows = get(effectiveDiffRowsAtom);

  if (!search.active || search.query === "") {
    return rows.map((_, i) => i);
  }

  const lowerQuery = search.query.toLowerCase();
  return rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => row.key.toLowerCase().includes(lowerQuery))
    .map(({ i }) => i);
});

/**
 * File count (convenience)
 */
export const fileCountAtom = atom((get): number => {
  const files = get(filesAtom);
  return files.length;
});

/**
 * Row count (convenience)
 */
export const rowCountAtom = atom((get): number => {
  const rows = get(effectiveDiffRowsAtom);
  return rows.length;
});
