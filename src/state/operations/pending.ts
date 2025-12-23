/**
 * Pending changes operations
 *
 * Operations for managing the pending changes map.
 */
import { Atom } from "@effect-atom/atom-react";
import type { EnvKey, FileIndex, PendingChange } from "../../types.js";
import { conflictsAtom, pendingAtom, pendingKey } from "../atoms/base.js";

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
  (args: { varKey: EnvKey; fileIndex: FileIndex; }, get) => {
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
  (args: { varKey: EnvKey; excludeFileIndex?: FileIndex; }, get) => {
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
