/**
 * Normalized application state - split into focused atoms for better performance
 *
 * Each atom slice only triggers re-renders for components that depend on it.
 * Derived atoms compute values from the base atoms.
 */
import { Atom } from "@effect-atom/atom-react";
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
export const filesAtom = Atom.make<ReadonlyArray<EnvFile>>([]).pipe(Atom.keepAlive);

/** Pending changes - keyed by "${varKey}:${fileIndex}" */
export const pendingAtom = Atom.make<ReadonlyMap<string, PendingChange>>(new Map()).pipe(Atom.keepAlive);

/** Conflicts - set of pendingKey strings where disk value changed */
export const conflictsAtom = Atom.make<ReadonlySet<string>>(new Set<string>()).pipe(Atom.keepAlive);

/** Selection state */
export const selectionAtom = Atom.make<{ readonly row: number; readonly col: number }>({
  row: 0,
  col: 0,
}).pipe(Atom.keepAlive);

/** Edit mode state */
export const editModeAtom = Atom.make<EditMode | null>(null).pipe(Atom.keepAlive);

/** Clipboard state */
export const clipboardAtom = Atom.make<Clipboard | null>(null).pipe(Atom.keepAlive);

/** Search state */
export const searchAtom = Atom.make<SearchState>({ active: false, query: "" }).pipe(Atom.keepAlive);

/** Modal state */
export const modalAtom = Atom.make<ModalState | null>(null).pipe(Atom.keepAlive);

/** Message state */
export const messageAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive);

/** Layout column widths */
export const colWidthsAtom = Atom.make<ReadonlyArray<number>>([]).pipe(Atom.keepAlive);

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
// Composite App State Atom (backward compatible read-only)
// =============================================================================

/**
 * Composite atom that combines all base atoms into a single AppState.
 * This provides backward compatibility for reading state.
 * For writing, use the individual atoms directly.
 */
export const appStateAtom = Atom.make((get): AppState => ({
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
}));

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Computes diff rows from files + pending changes.
 * This is the "effective" view - what the user sees and what will be saved.
 */
export const effectiveDiffRowsAtom = Atom.make((get): ReadonlyArray<DiffRow> => {
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
export const currentRowAtom = Atom.make((get): DiffRow | null => {
  const selection = get(selectionAtom);
  const rows = get(effectiveDiffRowsAtom);
  return rows[selection.row] ?? null;
});

/**
 * Stats: counts of identical/different/missing rows
 */
export const statsAtom = Atom.make((get) => {
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
export const pendingListAtom = Atom.map(pendingAtom, (pending): ReadonlyArray<PendingChange> =>
  Array.from(pending.values())
);

/**
 * Filtered row indices based on search query
 */
export const filteredRowIndicesAtom = Atom.make((get): ReadonlyArray<number> => {
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
export const fileCountAtom = Atom.map(filesAtom, (files): number => files.length);

/**
 * Row count (convenience)
 */
export const rowCountAtom = Atom.map(effectiveDiffRowsAtom, (rows): number => rows.length);
