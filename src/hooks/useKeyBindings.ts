/**
 * Hook for keyboard bindings using AppMode state machine
 *
 * Uses AppMode.$match for clean mode-based dispatch.
 * Actions are still passed as callbacks to allow async operations (save, quit).
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useKeyboard } from "@opentui/react";
import { appModeAtom, pendingListAtom } from "../state/appState.js";
import {
  copyActionOp,
  cycleColumnOp,
  deleteAllActionOp,
  deleteVariableActionOp,
  moveDownOp,
  moveLeftOp,
  moveRightOp,
  moveUpOp,
  nextDiffOp,
  nextMatchOp,
  pasteActionOp,
  pasteAllActionOp,
  prevDiffOp,
  prevMatchOp,
  revertActionOp,
  setMessageOp,
  syncToLeftActionOp,
  syncToRightActionOp,
  undoActionOp,
  undoAllActionOp,
} from "../state/atomicOps.js";
import {
  cancelEditOp,
  closeModalOp,
  closeSearchOp,
  enterAddModeOp,
  enterEditModeActionOp,
  enterSearchModeOp,
  openModalOp,
} from "../state/keyboardDispatch.js";
import { AppMode } from "../types.js";

export interface KeyBindingCallbacks {
  /** Called when quit is confirmed (no pending changes or after modal confirm) */
  readonly onQuit: () => void;
  /** Called when save modal is confirmed */
  readonly onConfirmSave: () => void;
}

export function useKeyBindings(callbacks: KeyBindingCallbacks): void {
  const { onConfirmSave, onQuit } = callbacks;
  const mode = useAtomValue(appModeAtom);
  const pendingList = useAtomValue(pendingListAtom);

  // Mode transitions
  const cancelEdit = useAtomSet(cancelEditOp);
  const closeModal = useAtomSet(closeModalOp);
  const closeSearch = useAtomSet(closeSearchOp);
  const enterAddMode = useAtomSet(enterAddModeOp);
  const enterEditMode = useAtomSet(enterEditModeActionOp);
  const openSearch = useAtomSet(enterSearchModeOp);
  const openModal = useAtomSet(openModalOp);
  const showMessage = useAtomSet(setMessageOp);

  // Navigation
  const moveUp = useAtomSet(moveUpOp);
  const moveDown = useAtomSet(moveDownOp);
  const moveLeft = useAtomSet(moveLeftOp);
  const moveRight = useAtomSet(moveRightOp);
  const cycleColumn = useAtomSet(cycleColumnOp);
  const nextMatch = useAtomSet(nextMatchOp);
  const prevMatch = useAtomSet(prevMatchOp);
  const nextDiff = useAtomSet(nextDiffOp);
  const prevDiff = useAtomSet(prevDiffOp);

  // Actions
  const copy = useAtomSet(copyActionOp);
  const paste = useAtomSet(pasteActionOp);
  const pasteAll = useAtomSet(pasteAllActionOp);
  const revert = useAtomSet(revertActionOp);
  const undo = useAtomSet(undoActionOp);
  const undoAll = useAtomSet(undoAllActionOp);
  const deleteVariable = useAtomSet(deleteVariableActionOp);
  const deleteAll = useAtomSet(deleteAllActionOp);
  const syncToLeft = useAtomSet(syncToLeftActionOp);
  const syncToRight = useAtomSet(syncToRightActionOp);

  useKeyboard((key) => {
    AppMode.$match(mode, {
      Modal: (m) => {
        // Modal mode: y/n/escape
        if (key.name === "escape" || key.name === "n") {
          closeModal();
        } else if (key.name === "y") {
          if (m.modalType === "quit") {
            closeModal();
            onQuit();
          } else if (m.modalType === "save") {
            onConfirmSave();
          } else {
            closeModal();
          }
        } else if (key.name === "?" && m.modalType === "help") {
          closeModal();
        }
      },

      Search: () => {
        // Search mode: fzf-style navigation within filtered results
        if (key.name === "escape") {
          closeSearch();
        } else if (key.name === "up" || (key.ctrl && key.name === "p")) {
          prevMatch();
        } else if (key.name === "down" || (key.ctrl && key.name === "n")) {
          nextMatch();
        } else if (key.name === "return") {
          closeSearch();
        }
      },

      Edit: () => {
        // Edit mode: escape cancels (text input handled by input component)
        if (key.name === "escape") {
          cancelEdit();
        }
      },

      Normal: () => {
        // Normal mode: full keyboard navigation and actions
        switch (key.name) {
          // Navigation
          case "up":
          case "k":
            moveUp();
            break;
          case "down":
          case "j":
            moveDown();
            break;
          case "left":
          case "h":
            moveLeft();
            break;
          case "right":
          case "l":
            moveRight();
            break;
          case "tab":
            cycleColumn();
            break;

          // Clipboard
          case "c":
            copy();
            break;
          case "v":
            if (key.shift) {
              pasteAll();
            } else {
              paste();
            }
            break;

          // Undo/Revert
          case "r":
            revert();
            break;
          case "u":
            if (key.shift) {
              undoAll();
            } else {
              undo();
            }
            break;

          // Save
          case "s":
            if (pendingList.length === 0) {
              showMessage("⚠ No changes to save");
            } else {
              openModal("save");
            }
            break;

          // Edit mode
          case "e":
          case "return":
            enterEditMode();
            break;
          case "a":
            enterAddMode();
            break;

          // Delete
          case "d":
            if (key.shift) {
              deleteAll();
            } else {
              deleteVariable();
            }
            break;

          // Quit
          case "q":
            if (pendingList.length > 0) {
              openModal("quit");
            } else {
              onQuit();
            }
            break;

          // Search
          case "/":
            openSearch();
            break;

          // Diff navigation
          case "]":
            nextDiff();
            break;
          case "[":
            prevDiff();
            break;

          // Help
          case "?":
            openModal("help");
            break;

          // Sync (2-file mode)
          case "<":
            syncToLeft();
            break;
          case ">":
            syncToRight();
            break;
        }
      },
    });
  });
}
