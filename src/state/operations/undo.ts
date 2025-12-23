/**
 * Undo operations
 *
 * Operations for reverting pending changes.
 */
import { Atom } from "@effect-atom/atom-react";
import { AppMode, FileIndex } from "../../types.js";
import {
  appModeAtom,
  conflictsAtom,
  filesAtom,
  messageAtom,
  pendingAtom,
  pendingKey,
  selectionAtom,
} from "../atoms/base.js";
import { currentRowAtom } from "../atoms/derived.js";
import { type SaveResult, SaveResult as SR } from "../runtime.js";

/**
 * Revert pending change for current cell
 */
export const revertActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const selection = get(selectionAtom);
  const pending = get(pendingAtom);

  if (!currentRow) return;

  const fileIndex = FileIndex.make(selection.col);
  const pKey = pendingKey(currentRow.key, fileIndex);
  if (!pending.has(pKey)) {
    get.set(messageAtom, "⚠ No pending change to revert");
    return;
  }

  const conflicts = get(conflictsAtom);
  const newPending = new Map(pending);
  newPending.delete(pKey);

  const newConflicts = new Set(conflicts);
  newConflicts.delete(pKey);

  get.set(pendingAtom, newPending);
  get.set(conflictsAtom, newConflicts);
  get.set(messageAtom, "↩ Reverted to original");
});

/**
 * Undo last pending change (LIFO)
 */
export const undoActionOp = Atom.fnSync((_: void, get) => {
  const pending = get(pendingAtom);

  if (pending.size === 0) {
    get.set(messageAtom, "⚠ Nothing to undo");
    return;
  }

  const keys = Array.from(pending.keys());
  const lastKey = keys[keys.length - 1]!;

  const newPending = new Map(pending);
  newPending.delete(lastKey);
  get.set(pendingAtom, newPending);
  get.set(messageAtom, "↩ Undone");
});

/**
 * Undo all pending changes
 */
export const undoAllActionOp = Atom.fnSync((_: void, get) => {
  const pending = get(pendingAtom);

  if (pending.size === 0) {
    get.set(messageAtom, "⚠ Nothing to undo");
    return;
  }

  get.set(pendingAtom, new Map());
  get.set(conflictsAtom, new Set());
  get.set(messageAtom, "↩ All changes undone");
});

/**
 * Handle save completion - updates state based on save result
 */
export const onSaveCompleteOp = Atom.fnSync((result: SaveResult, get) => {
  SR.$match(result, {
    Success: ({ files }) => {
      get.set(filesAtom, files);
      get.set(pendingAtom, new Map());
      get.set(conflictsAtom, new Set());
      get.set(appModeAtom, AppMode.Normal());
      get.set(messageAtom, "💾 Saved!");
    },
    Failure: ({ message }) => {
      get.set(messageAtom, `⚠ Save failed: ${message}`);
    },
  });
});
