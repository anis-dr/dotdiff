/**
 * Clipboard operations
 *
 * Operations for copy/paste functionality.
 */
import { Atom } from "@effect-atom/atom-react";
import type { Clipboard } from "../../types.js";
import { FileIndex } from "../../types.js";
import { clipboardAtom, filesAtom, messageAtom, pendingAtom, pendingKey, selectionAtom } from "../atoms/base.js";
import { currentRowAtom, fileCountAtom } from "../atoms/derived.js";
import { getOriginalValue } from "./files.js";

/**
 * Set clipboard
 */
export const setClipboardOp = Atom.fnSync((clipboard: Clipboard, get) => {
  get.set(clipboardAtom, clipboard);
});

/**
 * Copy current cell value to clipboard
 */
export const copyActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const selection = get(selectionAtom);
  if (!currentRow) return;

  const value = currentRow.values[selection.col];
  if (value === null || value === undefined) {
    get.set(messageAtom, "⚠ Nothing to copy");
    return;
  }

  get.set(clipboardAtom, { key: currentRow.key, value });
  get.set(messageAtom, `📋 Copied ${currentRow.key}`);
});

/**
 * Paste clipboard value to current cell
 */
export const pasteActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const clipboard = get(clipboardAtom);
  const selection = get(selectionAtom);
  const files = get(filesAtom);

  if (!currentRow || !clipboard) {
    get.set(messageAtom, "⚠ Clipboard empty");
    return;
  }

  const fileIndex = FileIndex.make(selection.col);
  const originalValue = getOriginalValue(files, currentRow.key, fileIndex);
  if (clipboard.value === originalValue) {
    get.set(messageAtom, "⚠ Same value");
    return;
  }

  const pending = get(pendingAtom);
  const key = pendingKey(currentRow.key, fileIndex);
  const newPending = new Map(pending);
  newPending.set(key, {
    key: currentRow.key,
    fileIndex,
    oldValue: originalValue,
    newValue: clipboard.value,
  });
  get.set(pendingAtom, newPending);
  get.set(messageAtom, `📋 Pasted to ${currentRow.key}`);
});

/**
 * Paste clipboard value to all files for current row
 */
export const pasteAllActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const clipboard = get(clipboardAtom);
  const files = get(filesAtom);
  const fileCount = get(fileCountAtom);

  if (!currentRow || !clipboard) {
    get.set(messageAtom, "⚠ Clipboard empty");
    return;
  }

  const pending = get(pendingAtom);
  const newPending = new Map(pending);
  let changeCount = 0;

  for (let i = 0; i < fileCount; i++) {
    const fileIndex = FileIndex.make(i);
    const originalValue = getOriginalValue(files, currentRow.key, fileIndex);
    if (clipboard.value !== originalValue) {
      const key = pendingKey(currentRow.key, fileIndex);
      newPending.set(key, {
        key: currentRow.key,
        fileIndex,
        oldValue: originalValue,
        newValue: clipboard.value,
      });
      changeCount++;
    }
  }

  if (changeCount === 0) {
    get.set(messageAtom, "⚠ All files already have this value");
    return;
  }

  get.set(pendingAtom, newPending);
  get.set(messageAtom, `📋 Pasted to ${changeCount} files`);
});
