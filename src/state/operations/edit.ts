/**
 * Edit operations
 *
 * Operations for editing values in cells.
 */
import { Atom } from "@effect-atom/atom-react";
import { AppMode, FileIndex } from "../../types.js";
import {
  appModeAtom,
  editModeAtom,
  filesAtom,
  messageAtom,
  pendingAtom,
  pendingKey,
  selectionAtom,
} from "../atoms/base.js";
import { currentRowAtom } from "../atoms/derived.js";
import { getOriginalValue } from "./files.js";

/**
 * Update edit input value
 */
export const editInputActionOp = Atom.fnSync((value: string, get) => {
  const editMode = get(editModeAtom);
  if (!editMode) return;

  get.set(
    appModeAtom,
    AppMode.Edit({
      ...editMode,
      value,
      dirty: true,
    }),
  );
});

/**
 * Save edit - full logic: validates, computes newValue, upserts/removes change, sets message
 */
export const saveEditActionOp = Atom.fnSync(
  (args: { submittedValue?: string; }, get) => {
    const currentRow = get(currentRowAtom);
    const editMode = get(editModeAtom);
    const selection = get(selectionAtom);
    const files = get(filesAtom);

    if (!currentRow || !editMode) {
      get.set(appModeAtom, AppMode.Normal());
      return;
    }

    const inputValue = args.submittedValue ?? editMode.value;

    // If user didn't type anything, just cancel
    if (!editMode.dirty) {
      get.set(appModeAtom, AppMode.Normal());
      get.set(messageAtom, "⊘ Edit cancelled");
      return;
    }

    // Compute newValue (null for deletion, "" for empty, etc.)
    let newValue: string | null;
    const trimmed = inputValue.trim();
    if (trimmed === "<null>" || trimmed === "<unset>") {
      newValue = null;
    } else if (trimmed === "\"\"" || trimmed === "''") {
      newValue = "";
    } else {
      newValue = inputValue;
    }

    const fileIndex = FileIndex.make(selection.col);
    const originalValue = getOriginalValue(files, currentRow.key, fileIndex);

    if (newValue === originalValue) {
      // Remove pending change
      const pending = get(pendingAtom);
      const key = pendingKey(currentRow.key, fileIndex);
      const newPending = new Map(pending);
      newPending.delete(key);
      get.set(pendingAtom, newPending);
      get.set(appModeAtom, AppMode.Normal());
      get.set(messageAtom, "⊘ No change");
      return;
    }

    // Upsert change
    const pending = get(pendingAtom);
    const key = pendingKey(currentRow.key, fileIndex);
    const newPending = new Map(pending);
    newPending.set(key, {
      key: currentRow.key,
      fileIndex,
      oldValue: originalValue,
      newValue,
    });
    get.set(pendingAtom, newPending);
    get.set(appModeAtom, AppMode.Normal());
    get.set(messageAtom, "✓ Value updated");
  },
);

/**
 * Cancel edit - exits edit mode and shows message
 */
export const cancelEditActionOp = Atom.fnSync((_: void, get) => {
  get.set(appModeAtom, AppMode.Normal());
  get.set(messageAtom, "⊘ Edit cancelled");
});
