/**
 * Delete operations
 *
 * Operations for marking variables for deletion.
 */
import { Atom } from "@effect-atom/atom-react";
import type { PendingChange } from "../../types.js";
import { FileIndex } from "../../types.js";
import { conflictsAtom, filesAtom, messageAtom, pendingAtom, pendingKey, selectionAtom } from "../atoms/base.js";
import { currentRowAtom, fileCountAtom, pendingListAtom } from "../atoms/derived.js";
import { historyAtom } from "../atoms/history.js";
import { getOriginalValue } from "./files.js";
import { createHistoryPush } from "./undo.js";

/**
 * Mark current cell variable for deletion
 */
export const deleteVariableActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const selection = get(selectionAtom);
  const files = get(filesAtom);
  const pending = get(pendingAtom);
  const conflicts = get(conflictsAtom);
  const history = get(historyAtom);

  if (!currentRow) return;

  const fileIndex = FileIndex.make(selection.col);
  const originalValue = getOriginalValue(files, currentRow.key, fileIndex);
  const pKey = pendingKey(currentRow.key, fileIndex);
  const pendingChange = pending.get(pKey);
  const effectiveValue = pendingChange ? pendingChange.newValue : originalValue;

  if (effectiveValue === null) {
    get.set(messageAtom, "⚠ Already missing in this file");
    return;
  }

  get.set(historyAtom, createHistoryPush(pending, conflicts, history));

  if (originalValue === null) {
    // Value only exists due to pending change, revert it
    const newPending = new Map(pending);
    newPending.delete(pKey);
    get.set(pendingAtom, newPending);
    get.set(messageAtom, "↩ Reverted to missing");
    return;
  }

  const newPending = new Map(pending);
  newPending.set(pKey, {
    key: currentRow.key,
    fileIndex,
    oldValue: originalValue,
    newValue: null,
  });
  get.set(pendingAtom, newPending);
  get.set(messageAtom, `✗ Marked ${currentRow.key} for deletion`);
});

/**
 * Mark current row variable for deletion in all files
 */
export const deleteAllActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const files = get(filesAtom);
  const fileCount = get(fileCountAtom);
  const pending = get(pendingAtom);
  const conflicts = get(conflictsAtom);
  const history = get(historyAtom);
  const pendingList = get(pendingListAtom);

  if (!currentRow) return;

  const newPending = new Map<string, PendingChange>();
  let deleteCount = 0;

  // First, copy pending changes that are NOT for this key
  for (const [key, change] of pending) {
    if (change.key !== currentRow.key) {
      newPending.set(key, change);
    }
  }

  // Now add deletion changes for all files where original exists
  for (let i = 0; i < fileCount; i++) {
    const fileIndex = FileIndex.make(i);
    const originalValue = getOriginalValue(files, currentRow.key, fileIndex);
    if (originalValue !== null) {
      const key = pendingKey(currentRow.key, fileIndex);
      newPending.set(key, {
        key: currentRow.key,
        fileIndex,
        oldValue: originalValue,
        newValue: null,
      });
      deleteCount++;
    }
  }

  if (deleteCount === 0) {
    const hadPendingForKey = pendingList.some((c) => c.key === currentRow.key);
    if (hadPendingForKey) {
      get.set(historyAtom, createHistoryPush(pending, conflicts, history));
      get.set(pendingAtom, newPending);
      get.set(messageAtom, "↩ Reverted pending values (now missing everywhere)");
    } else {
      get.set(messageAtom, "⚠ Already missing in all files");
    }
    return;
  }

  get.set(historyAtom, createHistoryPush(pending, conflicts, history));
  get.set(pendingAtom, newPending);
  get.set(messageAtom, `✗ Marked ${currentRow.key} for deletion in ${deleteCount} files`);
});
