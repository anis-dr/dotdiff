/**
 * Sync operations
 *
 * Operations for syncing values between files (2-file mode).
 */
import { Atom } from "@effect-atom/atom-react";
import { FileIndex } from "../../types.js";
import { conflictsAtom, filesAtom, messageAtom, pendingAtom, pendingKey } from "../atoms/base.js";
import { currentRowAtom, fileCountAtom } from "../atoms/derived.js";
import { historyAtom } from "../atoms/history.js";
import { getOriginalValue } from "./files.js";
import { createHistoryPush } from "./undo.js";

/**
 * Sync value from left file to right file (2-file mode only)
 */
export const syncToRightActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const fileCount = get(fileCountAtom);
  const files = get(filesAtom);
  const pending = get(pendingAtom);
  const conflicts = get(conflictsAtom);
  const history = get(historyAtom);

  if (!currentRow || fileCount !== 2) return;

  const leftValue = currentRow.values[0] ?? null;
  if (leftValue === null) {
    get.set(messageAtom, "⚠ Left value is missing");
    return;
  }

  const rightValue = currentRow.values[1] ?? null;
  if (leftValue === rightValue) {
    get.set(messageAtom, "⚠ Values already match");
    return;
  }

  get.set(historyAtom, createHistoryPush(pending, conflicts, history));
  const rightIndex = FileIndex.make(1);
  const key = pendingKey(currentRow.key, rightIndex);
  const newPending = new Map(pending);
  newPending.set(key, {
    key: currentRow.key,
    fileIndex: rightIndex,
    oldValue: getOriginalValue(files, currentRow.key, rightIndex),
    newValue: leftValue,
  });
  get.set(pendingAtom, newPending);
  get.set(messageAtom, "→ Synced to right");
});

/**
 * Sync value from right file to left file (2-file mode only)
 */
export const syncToLeftActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const fileCount = get(fileCountAtom);
  const files = get(filesAtom);
  const pending = get(pendingAtom);
  const conflicts = get(conflictsAtom);
  const history = get(historyAtom);

  if (!currentRow || fileCount !== 2) return;

  const rightValue = currentRow.values[1] ?? null;
  if (rightValue === null) {
    get.set(messageAtom, "⚠ Right value is missing");
    return;
  }

  const leftValue = currentRow.values[0] ?? null;
  if (rightValue === leftValue) {
    get.set(messageAtom, "⚠ Values already match");
    return;
  }

  get.set(historyAtom, createHistoryPush(pending, conflicts, history));
  const leftIndex = FileIndex.make(0);
  const key = pendingKey(currentRow.key, leftIndex);
  const newPending = new Map(pending);
  newPending.set(key, {
    key: currentRow.key,
    fileIndex: leftIndex,
    oldValue: getOriginalValue(files, currentRow.key, leftIndex),
    newValue: rightValue,
  });
  get.set(pendingAtom, newPending);
  get.set(messageAtom, "← Synced to left");
});
