/**
 * File operations
 *
 * Operations for managing the files state.
 */
import { Atom } from "@effect-atom/atom-react";
import type { EnvFile, EnvKey, FileIndex } from "../../types.js";
import { conflictsAtom, filesAtom, pendingAtom } from "../atoms/base.js";

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
  (args: { fileIndex: FileIndex; newVariables: ReadonlyMap<string, string>; }, get) => {
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

/**
 * Helper to get original value from files
 */
export const getOriginalValue = (
  files: ReadonlyArray<EnvFile>,
  varKey: EnvKey,
  fileIndex: FileIndex,
): string | null => {
  const file = files[fileIndex];
  return file?.variables.get(varKey) ?? null;
};
