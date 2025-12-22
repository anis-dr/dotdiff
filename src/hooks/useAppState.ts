/**
 * Central hook for accessing and modifying app state
 *
 * This is the main interface for components to interact with state.
 * All state reads and writes go through this hook.
 */
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";
import type { Clipboard, DiffRow, EditMode, EnvFile, ModalState, PendingChange } from "../types.js";
import {
  appStateAtom,
  currentRowAtom,
  effectiveDiffRowsAtom,
  fileCountAtom,
  filteredRowIndicesAtom,
  pendingListAtom,
  rowCountAtom,
  statsAtom,
  type AppState,
} from "../state/appState.js";
import * as A from "../state/actions.js";

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
  const [state, setState] = useAtom(appStateAtom);
  const diffRows = useAtomValue(effectiveDiffRowsAtom);
  const currentRow = useAtomValue(currentRowAtom);
  const stats = useAtomValue(statsAtom);
  const pendingList = useAtomValue(pendingListAtom);
  const filteredRowIndices = useAtomValue(filteredRowIndicesAtom);
  const fileCount = useAtomValue(fileCountAtom);
  const rowCount = useAtomValue(rowCountAtom);

  // File actions
  const setFiles = useCallback(
    (files: ReadonlyArray<EnvFile>) => setState((s) => A.setFiles(s, files)),
    [setState]
  );

  const updateFileFromDisk = useCallback(
    (fileIndex: number, newVariables: ReadonlyMap<string, string>) =>
      setState((s) => A.updateFileFromDisk(s, fileIndex, newVariables)),
    [setState]
  );

  // Pending change actions
  const upsertChange = useCallback(
    (change: PendingChange) => setState((s) => A.upsertChange(s, change)),
    [setState]
  );

  const removeChange = useCallback(
    (varKey: string, fileIndex: number) =>
      setState((s) => A.removeChange(s, varKey, fileIndex)),
    [setState]
  );

  const removeChangesForKey = useCallback(
    (varKey: string, excludeFileIndex?: number) =>
      setState((s) => A.removeChangesForKey(s, varKey, excludeFileIndex)),
    [setState]
  );

  const clearChanges = useCallback(
    () => setState(A.clearChanges),
    [setState]
  );

  const undoLast = useCallback((): boolean => {
    let didUndo = false;
    setState((s) => {
      const result = A.undoLast(s);
      didUndo = result.didUndo;
      return result.state;
    });
    return didUndo;
  }, [setState]);

  const findChange = useCallback(
    (varKey: string, fileIndex: number): PendingChange | undefined =>
      A.findChange(state, varKey, fileIndex),
    [state]
  );

  const addChanges = useCallback(
    (changes: ReadonlyArray<PendingChange>) =>
      setState((s) => A.addChanges(s, changes)),
    [setState]
  );

  // Selection actions
  const moveUp = useCallback(
    () => setState(A.moveUp),
    [setState]
  );

  const moveDown = useCallback(
    () => setState((s) => A.moveDown(s, rowCount)),
    [setState, rowCount]
  );

  const moveLeft = useCallback(
    () => setState(A.moveLeft),
    [setState]
  );

  const moveRight = useCallback(
    () => setState((s) => A.moveRight(s, fileCount)),
    [setState, fileCount]
  );

  const cycleColumn = useCallback(
    () => setState((s) => A.cycleColumn(s, fileCount)),
    [setState, fileCount]
  );

  // Edit mode actions
  const enterEditMode = useCallback(
    (currentValue: string) => setState((s) => A.enterEditMode(s, currentValue)),
    [setState]
  );

  const enterAddMode = useCallback(
    () => setState(A.enterAddMode),
    [setState]
  );

  const updateEditInput = useCallback(
    (value: string) => setState((s) => A.updateEditInput(s, value)),
    [setState]
  );

  const exitEditMode = useCallback(
    () => setState(A.exitEditMode),
    [setState]
  );

  // Clipboard actions
  const setClipboard = useCallback(
    (clipboard: Clipboard) => setState((s) => A.setClipboard(s, clipboard)),
    [setState]
  );

  // Search actions
  const openSearch = useCallback(
    () => setState(A.openSearch),
    [setState]
  );

  const closeSearch = useCallback(
    () => setState(A.closeSearch),
    [setState]
  );

  const setSearchQuery = useCallback(
    (query: string) => setState((s) => A.setSearchQuery(s, query)),
    [setState]
  );

  const nextMatch = useCallback(() => {
    if (filteredRowIndices.length === 0) return;
    const selectedRow = state.selection.row;
    const currentPos = filteredRowIndices.indexOf(selectedRow);
    if (currentPos === -1) {
      setState((s) => A.setSelection(s, filteredRowIndices[0]!, s.selection.col));
    } else {
      const nextPos = (currentPos + 1) % filteredRowIndices.length;
      setState((s) => A.setSelection(s, filteredRowIndices[nextPos]!, s.selection.col));
    }
  }, [filteredRowIndices, state.selection.row, setState]);

  const prevMatch = useCallback(() => {
    if (filteredRowIndices.length === 0) return;
    const selectedRow = state.selection.row;
    const currentPos = filteredRowIndices.indexOf(selectedRow);
    if (currentPos === -1) {
      setState((s) => A.setSelection(s, filteredRowIndices[filteredRowIndices.length - 1]!, s.selection.col));
    } else {
      const prevPos = (currentPos - 1 + filteredRowIndices.length) % filteredRowIndices.length;
      setState((s) => A.setSelection(s, filteredRowIndices[prevPos]!, s.selection.col));
    }
  }, [filteredRowIndices, state.selection.row, setState]);

  const nextDiff = useCallback(() => {
    if (diffRows.length === 0) return;
    const selectedRow = state.selection.row;
    for (let i = 1; i <= diffRows.length; i++) {
      const idx = (selectedRow + i) % diffRows.length;
      const row = diffRows[idx];
      if (row && row.status !== "identical") {
        setState((s) => A.setSelection(s, idx, s.selection.col));
        return;
      }
    }
  }, [diffRows, state.selection.row, setState]);

  const prevDiff = useCallback(() => {
    if (diffRows.length === 0) return;
    const selectedRow = state.selection.row;
    for (let i = 1; i <= diffRows.length; i++) {
      const idx = (selectedRow - i + diffRows.length) % diffRows.length;
      const row = diffRows[idx];
      if (row && row.status !== "identical") {
        setState((s) => A.setSelection(s, idx, s.selection.col));
        return;
      }
    }
  }, [diffRows, state.selection.row, setState]);

  // Modal actions
  const openModal = useCallback(
    (modal: ModalState) => setState((s) => A.openModal(s, modal)),
    [setState]
  );

  const closeModal = useCallback(
    () => setState(A.closeModal),
    [setState]
  );

  // Message actions
  const showMessage = useCallback(
    (message: string, durationMs = 2000) => {
      setState((s) => A.setMessage(s, message));
      setTimeout(() => {
        setState((s) => {
          // Only clear if it's still the same message
          if (s.message === message) {
            return A.setMessage(s, null);
          }
          return s;
        });
      }, durationMs);
    },
    [setState]
  );

  // Layout actions
  const setColWidths = useCallback(
    (colWidths: ReadonlyArray<number>) =>
      setState((s) => A.setColWidths(s, colWidths)),
    [setState]
  );

  // Value helpers
  const getOriginalValue = useCallback(
    (varKey: string, fileIndex: number) =>
      A.getOriginalValue(state, varKey, fileIndex),
    [state]
  );

  return useMemo(
    () => ({
      state,
      diffRows,
      currentRow,
      stats,
      pendingList,
      filteredRowIndices,
      fileCount,
      rowCount,
      setFiles,
      updateFileFromDisk,
      upsertChange,
      removeChange,
      removeChangesForKey,
      clearChanges,
      undoLast,
      findChange,
      addChanges,
      moveUp,
      moveDown,
      moveLeft,
      moveRight,
      cycleColumn,
      enterEditMode,
      enterAddMode,
      updateEditInput,
      exitEditMode,
      setClipboard,
      openSearch,
      closeSearch,
      setSearchQuery,
      nextMatch,
      prevMatch,
      nextDiff,
      prevDiff,
      openModal,
      closeModal,
      showMessage,
      setColWidths,
      getOriginalValue,
    }),
    [
      state,
      diffRows,
      currentRow,
      stats,
      pendingList,
      filteredRowIndices,
      fileCount,
      rowCount,
      setFiles,
      updateFileFromDisk,
      upsertChange,
      removeChange,
      removeChangesForKey,
      clearChanges,
      undoLast,
      findChange,
      addChanges,
      moveUp,
      moveDown,
      moveLeft,
      moveRight,
      cycleColumn,
      enterEditMode,
      enterAddMode,
      updateEditInput,
      exitEditMode,
      setClipboard,
      openSearch,
      closeSearch,
      setSearchQuery,
      nextMatch,
      prevMatch,
      nextDiff,
      prevDiff,
      openModal,
      closeModal,
      showMessage,
      setColWidths,
      getOriginalValue,
    ]
  );
}

