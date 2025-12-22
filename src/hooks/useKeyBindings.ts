/**
 * Hook for keyboard bindings
 */
import { useKeyboard } from "@opentui/react";
import type { EditMode, ModalState } from "../types.js";

export interface KeyBindingActions {
  readonly moveUp: () => void;
  readonly moveDown: () => void;
  readonly moveLeft: () => void;
  readonly moveRight: () => void;
  readonly cycleColumn: () => void;
  readonly copy: () => void;
  readonly paste: () => void;
  readonly pasteAll: () => void;
  readonly revert: () => void;
  readonly undo: () => void;
  readonly undoAll: () => void;
  readonly save: () => void;
  readonly enterEditMode: () => void;
  readonly enterAddMode: () => void;
  readonly deleteVariable: () => void;
  readonly deleteAll: () => void;
  readonly quit: () => void;
  readonly cancelEdit: () => void;
  readonly openSearch: () => void;
  readonly closeSearch: () => void;
  readonly nextMatch: () => void;
  readonly prevMatch: () => void;
  readonly nextDiff: () => void;
  readonly prevDiff: () => void;
  readonly openHelp: () => void;
  readonly closeModal: () => void;
  readonly confirmModal: () => void;
  readonly syncToLeft: () => void;
  readonly syncToRight: () => void;
}

export function useKeyBindings(
  editMode: EditMode | null,
  isSearchActive: boolean,
  modalState: ModalState | null,
  actions: KeyBindingActions
): void {
  useKeyboard((key) => {
    // Modal mode: handle y/n/escape
    if (modalState) {
      if (key.name === "escape" || key.name === "n") {
        actions.closeModal();
      } else if (key.name === "y") {
        actions.confirmModal();
      } else if (key.name === "?" && modalState.type === "help") {
        actions.closeModal();
      }
      return;
    }

    // Search mode: escape closes, n/N navigates
    if (isSearchActive) {
      if (key.name === "escape") {
        actions.closeSearch();
      }
      // Note: n/N for next/prev match handled when search is closed but query active
      return;
    }

    // Edit mode: only escape works
    if (editMode) {
      if (key.name === "escape") {
        actions.cancelEdit();
      }
      return;
    }

    // Normal mode
    switch (key.name) {
      case "up":
      case "k":
        actions.moveUp();
        break;
      case "down":
      case "j":
        actions.moveDown();
        break;
      case "left":
      case "h":
        actions.moveLeft();
        break;
      case "right":
      case "l":
        actions.moveRight();
        break;
      case "tab":
        actions.cycleColumn();
        break;
      case "c":
        actions.copy();
        break;
      case "v":
        if (key.shift) {
          actions.pasteAll();
        } else {
          actions.paste();
        }
        break;
      case "r":
        actions.revert();
        break;
      case "u":
        if (key.shift) {
          actions.undoAll();
        } else {
          actions.undo();
        }
        break;
      case "s":
        actions.save();
        break;
      case "e":
      case "return":
        actions.enterEditMode();
        break;
      case "a":
        actions.enterAddMode();
        break;
      case "d":
        if (key.shift) {
          actions.deleteAll();
        } else {
          actions.deleteVariable();
        }
        break;
      case "q":
        actions.quit();
        break;
      case "/":
        actions.openSearch();
        break;
      case "n":
        if (key.shift) {
          actions.prevMatch();
        } else {
          actions.nextMatch();
        }
        break;
      case "]":
        actions.nextDiff();
        break;
      case "[":
        actions.prevDiff();
        break;
      case "?":
        actions.openHelp();
        break;
      case "<":
        actions.syncToLeft();
        break;
      case ">":
        actions.syncToRight();
        break;
    }
  });
}

