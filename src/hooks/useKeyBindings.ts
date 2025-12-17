/**
 * Hook for keyboard bindings
 */
import { useKeyboard } from "@opentui/react";
import type { EditMode } from "../types.js";

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
}

export function useKeyBindings(
  editMode: EditMode | null,
  actions: KeyBindingActions
): void {
  useKeyboard((key) => {
    if (editMode) {
      if (key.name === "escape") {
        actions.cancelEdit();
      }
      return;
    }

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
    }
  });
}

