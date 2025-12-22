/**
 * Utilities for working with pending changes
 */
import type { PendingChange } from "../types.js";

/**
 * Group pending changes by file index
 */
export const groupChangesByFile = (
  changes: ReadonlyArray<PendingChange>
): Map<number, PendingChange[]> => {
  const byFile = new Map<number, PendingChange[]>();
  for (const change of changes) {
    const existing = byFile.get(change.fileIndex) ?? [];
    existing.push(change);
    byFile.set(change.fileIndex, existing);
  }
  return byFile;
};

