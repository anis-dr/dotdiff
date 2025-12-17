/**
 * Hook for managing pending changes with upsert/remove/undo operations
 */
import { useCallback } from "react";
import { useAtom } from "jotai";
import type { PendingChange } from "../types.js";
import { pendingChangesAtom } from "../state/atoms.js";

export interface UsePendingChangesReturn {
  readonly pendingChanges: ReadonlyArray<PendingChange>;
  readonly upsertChange: (change: PendingChange) => void;
  readonly removeChange: (key: string, fileIndex: number) => void;
  readonly removeChangesForKey: (key: string, excludeFileIndex?: number) => void;
  readonly clearChanges: () => void;
  readonly undoLast: () => boolean;
  readonly findChange: (key: string, fileIndex: number) => PendingChange | undefined;
  readonly addChanges: (changes: ReadonlyArray<PendingChange>) => void;
}

export function usePendingChanges(): UsePendingChangesReturn {
  const [pendingChanges, setPendingChanges] = useAtom(pendingChangesAtom);

  const findChange = useCallback(
    (key: string, fileIndex: number): PendingChange | undefined =>
      pendingChanges.find((c) => c.key === key && c.fileIndex === fileIndex),
    [pendingChanges]
  );

  const upsertChange = useCallback(
    (change: PendingChange) => {
      setPendingChanges((changes) => {
        const idx = changes.findIndex(
          (c) => c.key === change.key && c.fileIndex === change.fileIndex
        );
        if (idx >= 0) {
          return [...changes.slice(0, idx), change, ...changes.slice(idx + 1)];
        }
        return [...changes, change];
      });
    },
    [setPendingChanges]
  );

  const removeChange = useCallback(
    (key: string, fileIndex: number) => {
      setPendingChanges((changes) =>
        changes.filter((c) => !(c.key === key && c.fileIndex === fileIndex))
      );
    },
    [setPendingChanges]
  );

  const removeChangesForKey = useCallback(
    (key: string, excludeFileIndex?: number) => {
      setPendingChanges((changes) =>
        changes.filter(
          (c) =>
            c.key !== key ||
            (excludeFileIndex !== undefined && c.fileIndex === excludeFileIndex)
        )
      );
    },
    [setPendingChanges]
  );

  const clearChanges = useCallback(() => {
    setPendingChanges([]);
  }, [setPendingChanges]);

  const undoLast = useCallback((): boolean => {
    let hadChanges = false;
    setPendingChanges((changes) => {
      hadChanges = changes.length > 0;
      return changes.slice(0, -1);
    });
    return hadChanges;
  }, [setPendingChanges]);

  const addChanges = useCallback(
    (newChanges: ReadonlyArray<PendingChange>) => {
      setPendingChanges((changes) => [...changes, ...newChanges]);
    },
    [setPendingChanges]
  );

  return {
    pendingChanges,
    upsertChange,
    removeChange,
    removeChangesForKey,
    clearChanges,
    undoLast,
    findChange,
    addChanges,
  };
}

