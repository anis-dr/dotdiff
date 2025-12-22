/**
 * Hook for pending changes state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { useCallback } from "react";
import type { PendingChange } from "../types.js";
import {
  pendingAtom,
  conflictsAtom,
  pendingKey,
  pendingListAtom,
} from "../state/appState.js";
import {
  upsertChangeOp,
  removeChangeOp,
  removeChangesForKeyOp,
  clearChangesOp,
  undoLastOp,
  addChangesOp,
} from "../state/atomicOps.js";

export interface UsePendingChanges {
  pending: ReadonlyMap<string, PendingChange>;
  pendingList: ReadonlyArray<PendingChange>;
  conflicts: ReadonlySet<string>;
  upsertChange: (change: PendingChange) => void;
  removeChange: (varKey: string, fileIndex: number) => void;
  removeChangesForKey: (varKey: string, excludeFileIndex?: number) => void;
  clearChanges: () => void;
  undoLast: () => boolean;
  findChange: (varKey: string, fileIndex: number) => PendingChange | undefined;
  addChanges: (changes: ReadonlyArray<PendingChange>) => void;
}

export function usePendingChanges(): UsePendingChanges {
  // Read state
  const pending = useAtomValue(pendingAtom);
  const conflicts = useAtomValue(conflictsAtom);
  const pendingList = useAtomValue(pendingListAtom);

  // Atomic operations
  const upsertChange = useAtomSet(upsertChangeOp);
  const doRemoveChange = useAtomSet(removeChangeOp);
  const doRemoveChangesForKey = useAtomSet(removeChangesForKeyOp);
  const clearChanges = useAtomSet(clearChangesOp);
  const doUndoLast = useAtomSet(undoLastOp);
  const addChanges = useAtomSet(addChangesOp);

  // Wrapper for removeChange to match expected signature
  const removeChange = useCallback(
    (varKey: string, fileIndex: number) => {
      doRemoveChange({ varKey, fileIndex });
    },
    [doRemoveChange]
  );

  // Wrapper for removeChangesForKey to match expected signature
  const removeChangesForKey = useCallback(
    (varKey: string, excludeFileIndex?: number) => {
      if (excludeFileIndex !== undefined) {
        doRemoveChangesForKey({ varKey, excludeFileIndex });
          } else {
        doRemoveChangesForKey({ varKey });
          }
    },
    [doRemoveChangesForKey]
  );

  // Check size first, then execute to avoid race condition
  const undoLast = useCallback((): boolean => {
    const hadChanges = pending.size > 0;
    if (hadChanges) doUndoLast();
    return hadChanges;
  }, [doUndoLast, pending.size]);

  // findChange is a pure read operation, doesn't need atomic op
  const findChange = useCallback(
    (varKey: string, fileIndex: number): PendingChange | undefined => {
      const key = pendingKey(varKey, fileIndex);
      return pending.get(key);
    },
    [pending]
  );

  return {
    pending,
    pendingList,
    conflicts,
    upsertChange,
    removeChange,
    removeChangesForKey,
    clearChanges,
    undoLast,
    findChange,
    addChanges,
  };
}
