/**
 * Hook for pending changes state management
 */
import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import type { PendingChange } from "../types.js";
import {
  pendingAtom,
  conflictsAtom,
  pendingKey,
  pendingListAtom,
} from "../state/appState.js";

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
  const [pending, setPending] = useAtom(pendingAtom);
  const [conflicts, setConflicts] = useAtom(conflictsAtom);
  const pendingList = useAtomValue(pendingListAtom);

  const upsertChange = useCallback(
    (change: PendingChange) => {
      const key = pendingKey(change.key, change.fileIndex);
      setPending((prev) => {
        const next = new Map(prev);
        next.set(key, change);
        return next;
      });
    },
    [setPending]
  );

  const removeChange = useCallback(
    (varKey: string, fileIndex: number) => {
      const key = pendingKey(varKey, fileIndex);
      setPending((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setConflicts((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    [setPending, setConflicts]
  );

  const removeChangesForKey = useCallback(
    (varKey: string, excludeFileIndex?: number) => {
      setPending((prev) => {
        const next = new Map<string, PendingChange>();
        for (const [key, change] of prev) {
          if (change.key === varKey) {
            if (excludeFileIndex !== undefined && change.fileIndex === excludeFileIndex) {
              next.set(key, change);
            }
          } else {
            next.set(key, change);
          }
        }
        return next;
      });
    },
    [setPending]
  );

  const clearChanges = useCallback(() => {
    setPending(new Map());
    setConflicts(new Set());
  }, [setPending, setConflicts]);

  const undoLast = useCallback((): boolean => {
    let didUndo = false;
    setPending((prev) => {
      if (prev.size === 0) return prev;
      const keys = Array.from(prev.keys());
      const lastKey = keys[keys.length - 1]!;
      const next = new Map(prev);
      next.delete(lastKey);
      didUndo = true;
      return next;
    });
    return didUndo;
  }, [setPending]);

  const findChange = useCallback(
    (varKey: string, fileIndex: number): PendingChange | undefined => {
      const key = pendingKey(varKey, fileIndex);
      return pending.get(key);
    },
    [pending]
  );

  const addChanges = useCallback(
    (changes: ReadonlyArray<PendingChange>) => {
      setPending((prev) => {
        const next = new Map(prev);
        for (const change of changes) {
          const key = pendingKey(change.key, change.fileIndex);
          next.set(key, change);
        }
        return next;
      });
    },
    [setPending]
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

