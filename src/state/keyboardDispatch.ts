/**
 * Keyboard dispatch using AppMode state machine
 *
 * This module provides mode transition operations and a simplified dispatch pattern.
 * The actual action handlers (copy, paste, navigation, etc.) remain in atomicOps.ts
 * and are wired via callbacks in useKeyBindings.
 */
import { Atom } from "@effect-atom/atom-react";
import { AppMode, type ModalType } from "../types.js";
import { appModeAtom, currentRowAtom, messageAtom, selectionAtom } from "./appState.js";

// =============================================================================
// Mode Transition Operations
// =============================================================================

/** Enter normal mode */
export const enterNormalModeOp = Atom.fnSync((_: void, get) => {
  get.set(appModeAtom, AppMode.Normal());
});

/** Enter search mode */
export const enterSearchModeOp = Atom.fnSync((_: void, get) => {
  get.set(appModeAtom, AppMode.Search({ query: "" }));
});

/** Update search query (only works in Search mode) */
export const setSearchQueryOp = Atom.fnSync((query: string, get) => {
  const mode = get(appModeAtom);
  if (mode._tag === "Search") {
    get.set(appModeAtom, AppMode.Search({ query }));
  }
});

/** Close search and return to normal */
export const closeSearchOp = Atom.fnSync((_: void, get) => {
  get.set(appModeAtom, AppMode.Normal());
});

/** Enter edit mode for current cell */
export const enterEditModeActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const selection = get(selectionAtom);
  if (!currentRow) return;

  const value = currentRow.values[selection.col];
  get.set(
    appModeAtom,
    AppMode.Edit({
      phase: "editValue",
      value: value ?? "",
      dirty: false,
    }),
  );
});

/** Enter edit mode with a specific value */
export const enterEditModeOp = Atom.fnSync((value: string, get) => {
  get.set(
    appModeAtom,
    AppMode.Edit({
      phase: "editValue",
      value,
      dirty: false,
    }),
  );
});

/** Enter add mode (new variable) */
export const enterAddModeOp = Atom.fnSync((_: void, get) => {
  get.set(
    appModeAtom,
    AppMode.Edit({
      phase: "addKey",
      value: "",
      dirty: false,
      isNewRow: true,
    }),
  );
});

/** Update edit input value (only works in Edit mode) */
export const updateEditInputOp = Atom.fnSync((value: string, get) => {
  const mode = get(appModeAtom);
  if (mode._tag === "Edit") {
    get.set(
      appModeAtom,
      AppMode.Edit({
        ...mode,
        value,
        dirty: true,
      }),
    );
  }
});

/** Exit edit mode and return to normal */
export const exitEditModeOp = Atom.fnSync((_: void, get) => {
  get.set(appModeAtom, AppMode.Normal());
});

/** Cancel edit with message */
export const cancelEditOp = Atom.fnSync((_: void, get) => {
  get.set(appModeAtom, AppMode.Normal());
  get.set(messageAtom, "⊘ Edit cancelled");
});

/** Open a modal */
export const openModalOp = Atom.fnSync((modalType: ModalType, get) => {
  get.set(appModeAtom, AppMode.Modal({ modalType }));
});

/** Close modal and return to normal */
export const closeModalOp = Atom.fnSync((_: void, get) => {
  get.set(appModeAtom, AppMode.Normal());
});
