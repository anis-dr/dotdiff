/**
 * Normalized application state - single source of truth
 *
 * All display data is derived from this state. What you see = what you save.
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
  VariableStatus,
} from "../types.js";
import { getVariableStatus } from "../types.js";

// =============================================================================
// Pending Change Key Helpers
// =============================================================================

/** Create a unique key for a pending change */
export const pendingKey = (varKey: string, fileIndex: number): string =>
  `${varKey}:${fileIndex}`;

// =============================================================================
// App State Type
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
// Main App State Atom
// =============================================================================

export const appStateAtom = atom<AppState>(initialAppState);

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Computes diff rows from files + pending changes.
 * This is the "effective" view - what the user sees and what will be saved.
 */
export const effectiveDiffRowsAtom = atom((get): ReadonlyArray<DiffRow> => {
  const state = get(appStateAtom);
  const { files, pending } = state;

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
  const state = get(appStateAtom);
  const rows = get(effectiveDiffRowsAtom);
  const { row } = state.selection;
  return rows[row] ?? null;
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
  const state = get(appStateAtom);
  return Array.from(state.pending.values());
});

/**
 * Filtered row indices based on search query
 */
export const filteredRowIndicesAtom = atom((get): ReadonlyArray<number> => {
  const state = get(appStateAtom);
  const rows = get(effectiveDiffRowsAtom);
  const { search } = state;

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
  const state = get(appStateAtom);
  return state.files.length;
});

/**
 * Row count (convenience)
 */
export const rowCountAtom = atom((get): number => {
  const rows = get(effectiveDiffRowsAtom);
  return rows.length;
});



