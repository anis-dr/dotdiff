/**
 * Hook for clipboard operations (copy/paste)
 */
import { useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { Clipboard, DiffRow, PendingChange } from "../types.js";
import { clipboardAtom, filesAtom, selectedColAtom } from "../state/atoms.js";
import type { UsePendingChangesReturn } from "./usePendingChanges.js";

export interface UseClipboardReturn {
  readonly clipboard: Clipboard | null;
  readonly copy: (row: DiffRow) => string | null;
  readonly paste: (row: DiffRow) => string | null;
  readonly pasteAll: (row: DiffRow, fileCount: number) => string | null;
}

export function useClipboard(
  pendingChangesHook: UsePendingChangesReturn
): UseClipboardReturn {
  const [clipboard, setClipboard] = useAtom(clipboardAtom);
  const files = useAtomValue(filesAtom);
  const selectedCol = useAtomValue(selectedColAtom);

  const {
    pendingChanges,
    upsertChange,
    removeChange,
    removeChangesForKey,
    addChanges,
    findChange,
  } = pendingChangesHook;

  /** Validate clipboard before paste operations, returns clipboard if valid */
  const getValidClipboard = (
    row: DiffRow
  ): { clipboard: Clipboard } | { error: string } => {
    if (!clipboard) return { error: "⚠ Clipboard empty" };
    if (clipboard.key !== row.key)
      return { error: `⚠ Can only paste to ${clipboard.key}` };
    return { clipboard };
  };

  const copy = useCallback(
    (row: DiffRow): string | null => {
      // Use pending change value if exists, otherwise original
      const pending = findChange(row.key, selectedCol);
      const value = pending?.newValue ?? row.values[selectedCol];

      if (value === null || value === undefined) {
        return "⚠ Cannot copy missing value";
      }

      setClipboard({ key: row.key, value });
      return `✓ Copied ${row.key}`;
    },
    [selectedCol, findChange, setClipboard]
  );

  const paste = useCallback(
    (row: DiffRow): string | null => {
      const result = getValidClipboard(row);
      if ("error" in result) return result.error;
      const { clipboard: cb } = result;

      const originalValue = row.values[selectedCol] ?? null;

      if (cb.value === originalValue) {
        const existing = pendingChanges.find(
          (c) => c.key === row.key && c.fileIndex === selectedCol
        );
        if (existing) {
          removeChange(row.key, selectedCol);
          return "↩ Reverted to original";
        }
        return "⚠ Already at original value";
      }

      const newChange: PendingChange = {
        key: row.key,
        fileIndex: selectedCol,
        oldValue: originalValue,
        newValue: cb.value,
      };

      upsertChange(newChange);
      return `✓ Pasted to ${files[selectedCol]?.filename}`;
    },
    [clipboard, selectedCol, pendingChanges, files, upsertChange, removeChange]
  );

  const pasteAll = useCallback(
    (row: DiffRow, fileCount: number): string | null => {
      const result = getValidClipboard(row);
      if ("error" in result) return result.error;
      const { clipboard: cb } = result;

      const newChanges: PendingChange[] = [];
      let revertedCount = 0;

      for (let i = 0; i < fileCount; i++) {
        if (i === selectedCol) continue;

        const originalValue = row.values[i] ?? null;

        if (cb.value !== originalValue) {
          newChanges.push({
            key: row.key,
            fileIndex: i,
            oldValue: originalValue,
            newValue: cb.value,
          });
        } else {
          revertedCount++;
        }
      }

      // Remove existing changes for this key (except current column)
      removeChangesForKey(row.key, selectedCol);
      // Add new changes
      addChanges(newChanges);

      const changedCount = newChanges.length;
      if (changedCount > 0 && revertedCount > 0) {
        return `✓ ${changedCount} changed, ${revertedCount} already matching`;
      } else if (changedCount > 0) {
        return `✓ Pasted to ${changedCount} files`;
      }
      return "⚠ All files already have this value";
    },
    [clipboard, selectedCol, removeChangesForKey, addChanges]
  );

  return {
    clipboard,
    copy,
    paste,
    pasteAll,
  };
}
