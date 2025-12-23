/**
 * Derived atoms - computed from base atoms
 *
 * These provide the "effective" view of the application state,
 * combining ground truth with pending changes.
 */
import { Atom } from "@effect-atom/atom-react";
import type { DiffRow, PendingChange } from "../../types.js";
import { EnvKey, FileIndex, getVariableStatus } from "../../types.js";
import { filesAtom, isSearchActiveAtom, pendingAtom, pendingKey, searchQueryAtom, selectionAtom } from "./base.js";

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
  const rows: Array<DiffRow> = [];

  for (const key of allKeys) {
    const values: Array<string | null> = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex]!;
      const originalValue = file.variables.get(key) ?? null;

      // Check for pending change
      const pKey = pendingKey(EnvKey.make(key), FileIndex.make(fileIndex));
      const pendingChange = pending.get(pKey);

      // Effective value: pending overrides original
      const effectiveValue = pendingChange !== undefined
        ? pendingChange.newValue
        : originalValue;

      values.push(effectiveValue);
    }

    const status = getVariableStatus(values);
    rows.push({ key: EnvKey.make(key), values, status });
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
export const pendingListAtom = Atom.map(
  pendingAtom,
  (pending): ReadonlyArray<PendingChange> => Array.from(pending.values()),
);

/**
 * Filtered row indices based on search query
 */
export const filteredRowIndicesAtom = Atom.make((get): ReadonlyArray<number> => {
  const isSearchActive = get(isSearchActiveAtom);
  const query = get(searchQueryAtom);
  const rows = get(effectiveDiffRowsAtom);

  if (!isSearchActive || query === "") {
    return rows.map((_, i) => i);
  }

  const lowerQuery = query.toLowerCase();
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

/**
 * Whether there are any pending changes
 */
export const hasPendingChangesAtom = Atom.map(pendingAtom, (pending): boolean => pending.size > 0);
