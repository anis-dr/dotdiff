/**
 * App component - main TUI with unified state management
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useMemo } from "react";
import {
  useClipboardActions,
  useDeleteActions,
  useEditActions,
  useEditMode,
  useFiles,
  useFileWatcher,
  useKeyBindings,
  useLayout,
  useMessage,
  useModal,
  usePendingChanges,
  useSearch,
  useSelection,
  useSyncActions,
  useUndoActions,
} from "../hooks/index.js";
import {
  currentRowAtom,
  effectiveDiffRowsAtom,
  filteredRowIndicesAtom,
  pendingListAtom,
  rowCountAtom,
  statsAtom,
} from "../state/appState.js";
import { saveChangesAtom } from "../state/runtime.js";
import type { EnvFile } from "../types.js";
import { Colors } from "../types.js";
import { EnvRow } from "./EnvRow.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { HelpOverlay } from "./HelpOverlay.js";
import { Inspector } from "./Inspector.js";
import { QuitConfirmModal } from "./QuitConfirmModal.js";
import { SavePreviewModal } from "./SavePreviewModal.js";
import { SearchOverlay } from "./SearchOverlay.js";

interface AppProps {
  readonly initialFiles: ReadonlyArray<EnvFile>;
  readonly onQuit: () => void;
}

export function App({ initialFiles, onQuit }: AppProps) {
  const { width: terminalWidth } = useTerminalDimensions();

  // Derived atoms
  const diffRows = useAtomValue(effectiveDiffRowsAtom);
  const currentRow = useAtomValue(currentRowAtom);
  const stats = useAtomValue(statsAtom);
  const pendingList = useAtomValue(pendingListAtom);
  const filteredRowIndices = useAtomValue(filteredRowIndicesAtom);
  const rowCount = useAtomValue(rowCountAtom);

  // Focused hooks
  const { fileCount, files, setFiles } = useFiles();
  const { cycleColumn, moveDown, moveLeft, moveRight, moveUp, nextDiff, nextMatch, prevDiff, prevMatch } =
    useSelection();
  const { closeSearch, openSearch, search, setSearchQuery } = useSearch();
  const { closeModal, modal, openModal } = useModal();
  const { editMode, enterAddMode } = useEditMode();
  const { showMessage } = useMessage();
  const { setColWidths } = useLayout();
  const { clearChanges } = usePendingChanges();

  // Subscribe to file watcher events via PubSub
  useFileWatcher();

  // Effectful save action from the runtime - use "promise" mode to await result
  const saveChanges = useAtomSet(saveChangesAtom, { mode: "promise" });

  // Action hooks
  const { handleCopy, handlePaste, handlePasteAll } = useClipboardActions();
  const { handleSyncToLeft, handleSyncToRight } = useSyncActions();
  const { handleCancelEdit, handleEditInput, handleEnterEditMode, handleSaveEdit } = useEditActions();
  const { handleDeleteAll, handleDeleteVariable } = useDeleteActions();
  const { handleRevert, handleUndo, handleUndoAll } = useUndoActions();

  // Initialize files on mount
  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles, setFiles]);

  // Calculate column widths (2-file optimized layout)
  const colWidths = useMemo(() => {
    const separators = 2;
    const available = Math.max(0, terminalWidth - separators);
    const keyColWidth = Math.max(20, Math.floor(available * 0.35));
    const valueWidth = Math.max(
      15,
      Math.floor((available - keyColWidth) / Math.max(1, fileCount)),
    );
    const used = keyColWidth + valueWidth * fileCount;
    const remainder = Math.max(0, available - used);

    return [
      keyColWidth,
      ...Array.from({ length: fileCount }, (_, i) => i === fileCount - 1 ? valueWidth + remainder : valueWidth),
    ];
  }, [terminalWidth, fileCount]);

  useEffect(() => {
    setColWidths(colWidths);
  }, [colWidths, setColWidths]);

  // Open save preview modal
  const handleSave = useCallback(() => {
    if (pendingList.length === 0) {
      showMessage("⚠ No changes to save");
      return;
    }
    openModal({ type: "save" });
  }, [pendingList.length, showMessage, openModal]);

  // Actually perform the save using the effectful saveChangesAtom
  const doSave = useCallback(async () => {
    try {
      // saveChanges is an Atom.fn with promise mode - returns the updated files
      const updatedFiles = await saveChanges({ files, changes: pendingList });
      setFiles(updatedFiles);
      clearChanges();
      closeModal();
      showMessage("💾 Saved!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showMessage(`⚠ Save failed: ${msg}`);
    }
  }, [files, pendingList, saveChanges, setFiles, clearChanges, closeModal, showMessage]);

  // Open quit confirmation modal if dirty
  const handleQuit = useCallback(() => {
    if (pendingList.length > 0) {
      openModal({ type: "quit" });
    } else {
      onQuit();
    }
  }, [pendingList.length, openModal, onQuit]);

  const handleHelp = useCallback(() => {
    openModal({ type: "help" });
  }, [openModal]);

  // Search handlers
  const handleSearchInput = useCallback(
    (value: string) => setSearchQuery(value),
    [setSearchQuery],
  );

  const handleSearchSubmit = useCallback(() => {
    nextMatch();
    closeSearch();
  }, [nextMatch, closeSearch]);

  // Keyboard bindings
  useKeyBindings(editMode, search.active, modal, {
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    cycleColumn,
    copy: handleCopy,
    paste: handlePaste,
    pasteAll: handlePasteAll,
    revert: handleRevert,
    undo: handleUndo,
    undoAll: handleUndoAll,
    save: handleSave,
    enterEditMode: handleEnterEditMode,
    enterAddMode,
    deleteVariable: handleDeleteVariable,
    deleteAll: handleDeleteAll,
    quit: handleQuit,
    cancelEdit: handleCancelEdit,
    openSearch,
    closeSearch,
    nextMatch,
    prevMatch,
    nextDiff,
    prevDiff,
    openHelp: handleHelp,
    closeModal,
    confirmModal: () => {
      if (modal?.type === "quit") onQuit();
      else if (modal?.type === "save") doSave();
      else closeModal();
    },
    syncToLeft: handleSyncToLeft,
    syncToRight: handleSyncToRight,
  });

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={Colors.background}
    >
      {/* Title bar */}
      <box
        height={1}
        backgroundColor={Colors.surface}
        paddingLeft={1}
        flexDirection="row"
        justifyContent="space-between"
        paddingRight={1}
      >
        <text>
          <b>
            <span fg={Colors.selectedBg}>envy</span>
          </b>
          <span fg={Colors.dimText}>│ {fileCount} files</span>
          {search.active && search.query && (
            <>
              <span fg={Colors.dimText}>│</span>
              <span fg={Colors.selectedBg}>/{search.query}</span>
              <span fg={Colors.dimText}>({filteredRowIndices.length})</span>
            </>
          )}
        </text>
        <text>
          <span fg={Colors.identical}>● {stats.identical}</span>
          <span fg={Colors.dimText}></span>
          <span fg={Colors.different}>◐ {stats.different}</span>
          <span fg={Colors.dimText}></span>
          <span fg={Colors.missing}>○ {stats.missing}</span>
        </text>
      </box>

      {/* Search overlay */}
      {search.active && (
        <SearchOverlay
          query={search.query}
          matchCount={filteredRowIndices.length}
          totalCount={rowCount}
          onInput={handleSearchInput}
          onSubmit={handleSearchSubmit}
          onCancel={closeSearch}
        />
      )}

      {/* Header with file names */}
      <Header />

      {/* Main diff view */}
      <box flexDirection="column" flexGrow={1} overflow="hidden">
        <scrollbox focused={!editMode && !search.active && !modal} style={{ flexGrow: 1 }}>
          {diffRows.map((row, index) => (
            <EnvRow
              key={row.key || `new-${index}`}
              row={row}
              rowIndex={index}
              onEditInput={handleEditInput}
              onEditSubmit={handleSaveEdit}
            />
          ))}
        </scrollbox>
      </box>

      {/* Inspector */}
      <Inspector row={currentRow} />

      {/* Footer */}
      <Footer />

      {/* Modals */}
      {modal?.type === "help" && <HelpOverlay onClose={closeModal} />}
      {modal?.type === "quit" && (
        <QuitConfirmModal
          pendingCount={pendingList.length}
          onConfirm={onQuit}
          onCancel={closeModal}
        />
      )}
      {modal?.type === "save" && (
        <SavePreviewModal
          files={files}
          changes={pendingList}
          onConfirm={doSave}
          onCancel={closeModal}
        />
      )}
    </box>
  );
}
