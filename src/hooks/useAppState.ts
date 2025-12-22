/**
 * Central hook for accessing and modifying app state
 *
 * This is the main interface for components to interact with state.
 * It composes the focused hooks for backward compatibility.
 *
 * For new code, prefer using the focused hooks directly:
 * - useSelection, usePendingChanges, useSearch, useModal, useEditMode,
 *   useClipboard, useMessage, useFiles, useLayout
 */
import { useAtomValue } from "jotai";
import { useCallback, useMemo, useRef, useEffect } from "react";
import type { Clipboard, DiffRow, EnvFile, ModalState, PendingChange } from "../types.js";
import {
  appStateAtom,
  currentRowAtom,
  effectiveDiffRowsAtom,
  filteredRowIndicesAtom,
  pendingKey,
  pendingListAtom,
  rowCountAtom,
  statsAtom,
  type AppState,
} from "../state/appState.js";
import { useSelection } from "./useSelection.js";
import { usePendingChanges } from "./usePendingChanges.js";
import { useSearch } from "./useSearch.js";
import { useModal } from "./useModal.js";
import { useEditMode } from "./useEditMode.js";
import { useClipboard } from "./useClipboard.js";
import { useMessage } from "./useMessage.js";
import { useFiles } from "./useFiles.js";
import { useLayout } from "./useLayout.js";

export interface UseAppState {
  // Core state
  state: AppState;

  // Derived values (read-only)
  diffRows: ReadonlyArray<DiffRow>;
  currentRow: DiffRow | null;
  stats: { identical: number; different: number; missing: number };
  pendingList: ReadonlyArray<PendingChange>;
  filteredRowIndices: ReadonlyArray<number>;
  fileCount: number;
  rowCount: number;

  // Files
  setFiles: (files: ReadonlyArray<EnvFile>) => void;
  updateFileFromDisk: (fileIndex: number, newVariables: ReadonlyMap<string, string>) => void;

  // Pending Changes
  upsertChange: (change: PendingChange) => void;
  removeChange: (varKey: string, fileIndex: number) => void;
  removeChangesForKey: (varKey: string, excludeFileIndex?: number) => void;
  clearChanges: () => void;
  undoLast: () => boolean;
  findChange: (varKey: string, fileIndex: number) => PendingChange | undefined;
  addChanges: (changes: ReadonlyArray<PendingChange>) => void;

  // Selection
  moveUp: () => void;
  moveDown: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  cycleColumn: () => void;

  // Edit Mode
  enterEditMode: (currentValue: string) => void;
  enterAddMode: () => void;
  updateEditInput: (value: string) => void;
  exitEditMode: () => void;

  // Clipboard
  setClipboard: (clipboard: Clipboard) => void;

  // Search
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  nextDiff: () => void;
  prevDiff: () => void;

  // Modal
  openModal: (modal: ModalState) => void;
  closeModal: () => void;

  // Message
  showMessage: (message: string, durationMs?: number) => void;

  // Layout
  setColWidths: (colWidths: ReadonlyArray<number>) => void;

  // Value helpers
  getOriginalValue: (varKey: string, fileIndex: number) => string | null;
}

export function useAppState(): UseAppState {
  // Read composite state for backward compatibility
  const state = useAtomValue(appStateAtom);

  // Derived atoms
  const diffRows = useAtomValue(effectiveDiffRowsAtom);
  const currentRow = useAtomValue(currentRowAtom);
  const stats = useAtomValue(statsAtom);
  const pendingList = useAtomValue(pendingListAtom);
  const filteredRowIndices = useAtomValue(filteredRowIndicesAtom);
  const rowCount = useAtomValue(rowCountAtom);

  // Compose focused hooks
  const selectionHook = useSelection();
  const pendingHook = usePendingChanges();
  const searchHook = useSearch();
  const modalHook = useModal();
  const editModeHook = useEditMode();
  const clipboardHook = useClipboard();
  const messageHook = useMessage();
  const filesHook = useFiles();
  const layoutHook = useLayout();

  return useMemo(
    () => ({
      state,
      diffRows,
      currentRow,
      stats,
      pendingList,
      filteredRowIndices,
      fileCount: filesHook.fileCount,
      rowCount,

      // Files
      setFiles: filesHook.setFiles,
      updateFileFromDisk: filesHook.updateFileFromDisk,
      getOriginalValue: filesHook.getOriginalValue,

      // Pending Changes
      upsertChange: pendingHook.upsertChange,
      removeChange: pendingHook.removeChange,
      removeChangesForKey: pendingHook.removeChangesForKey,
      clearChanges: pendingHook.clearChanges,
      undoLast: pendingHook.undoLast,
      findChange: pendingHook.findChange,
      addChanges: pendingHook.addChanges,

      // Selection
      moveUp: selectionHook.moveUp,
      moveDown: selectionHook.moveDown,
      moveLeft: selectionHook.moveLeft,
      moveRight: selectionHook.moveRight,
      cycleColumn: selectionHook.cycleColumn,
      nextMatch: selectionHook.nextMatch,
      prevMatch: selectionHook.prevMatch,
      nextDiff: selectionHook.nextDiff,
      prevDiff: selectionHook.prevDiff,

      // Edit Mode
      enterEditMode: editModeHook.enterEditMode,
      enterAddMode: editModeHook.enterAddMode,
      updateEditInput: editModeHook.updateEditInput,
      exitEditMode: editModeHook.exitEditMode,

      // Clipboard
      setClipboard: clipboardHook.setClipboard,

      // Search
      openSearch: searchHook.openSearch,
      closeSearch: searchHook.closeSearch,
      setSearchQuery: searchHook.setSearchQuery,

      // Modal
      openModal: modalHook.openModal,
      closeModal: modalHook.closeModal,

      // Message
      showMessage: messageHook.showMessage,

      // Layout
      setColWidths: layoutHook.setColWidths,
    }),
    [
      state,
      diffRows,
      currentRow,
      stats,
      pendingList,
      filteredRowIndices,
      rowCount,
      filesHook,
      pendingHook,
      selectionHook,
      editModeHook,
      clipboardHook,
      searchHook,
      modalHook,
      messageHook,
      layoutHook,
    ]
  );
}
