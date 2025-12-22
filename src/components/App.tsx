/**
 * App component - main TUI with unified state management
 */
import { useCallback, useEffect, useMemo } from "react";
import { useTerminalDimensions } from "@opentui/react";
import type { EnvFile, PendingChange } from "../types.js";
import { Colors } from "../types.js";
import { useAppState } from "../hooks/useAppState.js";
import { useKeyBindings } from "../hooks/useKeyBindings.js";
import { Header } from "./Header.js";
import { EnvRow } from "./EnvRow.js";
import { Footer } from "./Footer.js";
import { HelpOverlay } from "./HelpOverlay.js";
import { QuitConfirmModal } from "./QuitConfirmModal.js";
import { SavePreviewModal } from "./SavePreviewModal.js";
import { SearchOverlay } from "./SearchOverlay.js";
import { Inspector } from "./Inspector.js";

interface AppProps {
  readonly initialFiles: ReadonlyArray<EnvFile>;
  readonly onSave: (
    changes: ReadonlyArray<PendingChange>
  ) => Promise<ReadonlyArray<EnvFile>>;
  readonly onQuit: () => void;
}

export function App({ initialFiles, onSave, onQuit }: AppProps) {
  const { width: terminalWidth } = useTerminalDimensions();

  // Get all state and actions from the central hook
  const app = useAppState();
  const {
    state,
    diffRows,
    currentRow,
    stats,
    pendingList,
    filteredRowIndices,
    fileCount,
    rowCount,
    setFiles,
    upsertChange,
    removeChange,
    removeChangesForKey,
    clearChanges,
    undoLast,
    findChange,
    addChanges,
    setSelection,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    cycleColumn,
    enterEditMode: enterEditModeAction,
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
    applyPendingToFiles,
  } = app;

  const { editMode, clipboard, search, modal, selection } = state;
  const selectedCol = selection.col;

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
      Math.floor((available - keyColWidth) / Math.max(1, fileCount))
    );
    const used = keyColWidth + valueWidth * fileCount;
    const remainder = Math.max(0, available - used);

    return [
      keyColWidth,
      ...Array.from({ length: fileCount }, (_, i) =>
        i === fileCount - 1 ? valueWidth + remainder : valueWidth
      ),
    ];
  }, [terminalWidth, fileCount]);

  useEffect(() => {
    setColWidths(colWidths);
  }, [colWidths, setColWidths]);

  // Action handlers
  const handleCopy = useCallback(() => {
    if (!currentRow) return;
    const value = currentRow.values[selectedCol];
    if (value === null || value === undefined) {
      showMessage("⚠ Nothing to copy");
      return;
    }
    setClipboard({ key: currentRow.key, value });
    showMessage(`📋 Copied ${currentRow.key}`);
  }, [currentRow, selectedCol, setClipboard, showMessage]);

  const handlePaste = useCallback(() => {
    if (!currentRow || !clipboard) {
      showMessage("⚠ Clipboard empty");
      return;
    }
    const originalValue = getOriginalValue(currentRow.key, selectedCol);
    if (clipboard.value === originalValue) {
      showMessage("⚠ Same value");
      return;
    }
    upsertChange({
      key: currentRow.key,
      fileIndex: selectedCol,
      oldValue: originalValue,
      newValue: clipboard.value,
    });
    showMessage(`📋 Pasted to ${currentRow.key}`);
  }, [currentRow, clipboard, selectedCol, getOriginalValue, upsertChange, showMessage]);

  const handlePasteAll = useCallback(() => {
    if (!currentRow || !clipboard) {
      showMessage("⚠ Clipboard empty");
      return;
    }
    const changes: PendingChange[] = [];
    for (let i = 0; i < fileCount; i++) {
      const originalValue = getOriginalValue(currentRow.key, i);
      if (clipboard.value !== originalValue) {
        changes.push({
          key: currentRow.key,
          fileIndex: i,
          oldValue: originalValue,
          newValue: clipboard.value,
        });
      }
    }
    if (changes.length === 0) {
      showMessage("⚠ All files already have this value");
      return;
    }
    addChanges(changes);
    showMessage(`📋 Pasted to ${changes.length} files`);
  }, [currentRow, clipboard, fileCount, getOriginalValue, addChanges, showMessage]);

  const handleRevert = useCallback(() => {
    if (!currentRow) return;
    if (!findChange(currentRow.key, selectedCol)) {
      showMessage("⚠ No pending change to revert");
      return;
    }
    removeChange(currentRow.key, selectedCol);
    showMessage("↩ Reverted to original");
  }, [currentRow, selectedCol, findChange, removeChange, showMessage]);

  const handleUndo = useCallback(() => {
    if (undoLast()) {
      showMessage("↩ Undone");
    } else {
      showMessage("⚠ Nothing to undo");
    }
  }, [undoLast, showMessage]);

  const handleUndoAll = useCallback(() => {
    if (pendingList.length === 0) {
      showMessage("⚠ Nothing to undo");
      return;
    }
    clearChanges();
    showMessage("↩ All changes undone");
  }, [pendingList.length, clearChanges, showMessage]);

  const handleEnterEditMode = useCallback(() => {
    if (!currentRow) return;
    const value = currentRow.values[selectedCol];
    enterEditModeAction(value ?? "");
  }, [currentRow, selectedCol, enterEditModeAction]);

  const handleEditInput = useCallback(
    (value: string) => {
      updateEditInput(value);
    },
    [updateEditInput]
  );

  const handleSaveEdit = useCallback(
    (submittedValue?: string) => {
      if (!currentRow || !editMode) {
        exitEditMode();
        return;
      }

      const inputValue = submittedValue ?? editMode.inputValue;

      // If user didn't type anything, just cancel
      if (!editMode.dirty) {
        exitEditMode();
        showMessage("⊘ Edit cancelled");
        return;
      }

      // Determine the new value
      let newValue: string | null;
      const trimmed = inputValue.trim();
      if (trimmed === "<null>" || trimmed === "<unset>") {
        newValue = null; // Explicit deletion
      } else if (trimmed === '""' || trimmed === "''") {
        newValue = ""; // Explicit empty string
      } else {
        newValue = inputValue; // Use as-is (including empty string)
      }

      const originalValue = getOriginalValue(currentRow.key, selectedCol);

      // If value unchanged from original, remove any pending change
      if (newValue === originalValue) {
        removeChange(currentRow.key, selectedCol);
        exitEditMode();
        showMessage("⊘ No change");
        return;
      }

      upsertChange({
        key: currentRow.key,
        fileIndex: selectedCol,
        oldValue: originalValue,
        newValue,
      });
      exitEditMode();
      showMessage("✓ Value updated");
    },
    [currentRow, editMode, selectedCol, getOriginalValue, removeChange, upsertChange, exitEditMode, showMessage]
  );

  const handleCancelEdit = useCallback(() => {
    exitEditMode();
    showMessage("⊘ Edit cancelled");
  }, [exitEditMode, showMessage]);

  const handleDeleteVariable = useCallback(() => {
    if (!currentRow) return;
    const originalValue = getOriginalValue(currentRow.key, selectedCol);
    const pending = findChange(currentRow.key, selectedCol);
    const effectiveValue = pending ? pending.newValue : originalValue;

    if (effectiveValue === null) {
      showMessage("⚠ Already missing in this file");
      return;
    }

    if (originalValue === null) {
      // Value only exists due to pending change, revert it
      removeChange(currentRow.key, selectedCol);
      showMessage("↩ Reverted to missing");
      return;
    }

    upsertChange({
      key: currentRow.key,
      fileIndex: selectedCol,
      oldValue: originalValue,
      newValue: null,
    });
    showMessage(`✗ Marked ${currentRow.key} for deletion`);
  }, [currentRow, selectedCol, getOriginalValue, findChange, removeChange, upsertChange, showMessage]);

  const handleDeleteAll = useCallback(() => {
    if (!currentRow) return;

    const newChanges: PendingChange[] = [];
    for (let i = 0; i < fileCount; i++) {
      const originalValue = getOriginalValue(currentRow.key, i);
      if (originalValue !== null) {
        newChanges.push({
          key: currentRow.key,
          fileIndex: i,
          oldValue: originalValue,
          newValue: null,
        });
      }
    }

    if (newChanges.length === 0) {
      const hadPendingForKey = pendingList.some((c) => c.key === currentRow.key);
      if (hadPendingForKey) {
        removeChangesForKey(currentRow.key);
        showMessage("↩ Reverted pending values (now missing everywhere)");
      } else {
        showMessage("⚠ Already missing in all files");
      }
      return;
    }

    removeChangesForKey(currentRow.key);
    addChanges(newChanges);
    showMessage(`✗ Marked ${currentRow.key} for deletion in ${newChanges.length} files`);
  }, [currentRow, fileCount, getOriginalValue, pendingList, removeChangesForKey, addChanges, showMessage]);

  // Open save preview modal
  const handleSave = useCallback(() => {
    if (pendingList.length === 0) {
      showMessage("⚠ No changes to save");
      return;
    }
    openModal({ type: "save" });
  }, [pendingList.length, showMessage, openModal]);

  // Actually perform the save
  const doSave = useCallback(async () => {
    try {
      const updatedFiles = await onSave(pendingList);
      setFiles(updatedFiles);
      clearChanges();
      closeModal();
      showMessage("💾 Saved!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showMessage(`⚠ Save failed: ${msg}`);
    }
  }, [pendingList, onSave, setFiles, clearChanges, closeModal, showMessage]);

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

  // Directional sync
  const handleSyncToRight = useCallback(() => {
    if (!currentRow || fileCount !== 2) return;
    const leftValue = currentRow.values[0] ?? null;
    if (leftValue === null) {
      showMessage("⚠ Left value is missing");
      return;
    }
    const rightValue = currentRow.values[1] ?? null;
    if (leftValue === rightValue) {
      showMessage("⚠ Values already match");
      return;
    }
    upsertChange({
      key: currentRow.key,
      fileIndex: 1,
      oldValue: getOriginalValue(currentRow.key, 1),
      newValue: leftValue,
    });
    showMessage("→ Synced to right");
  }, [currentRow, fileCount, getOriginalValue, upsertChange, showMessage]);

  const handleSyncToLeft = useCallback(() => {
    if (!currentRow || fileCount !== 2) return;
    const rightValue = currentRow.values[1] ?? null;
    if (rightValue === null) {
      showMessage("⚠ Right value is missing");
      return;
    }
    const leftValue = currentRow.values[0] ?? null;
    if (rightValue === leftValue) {
      showMessage("⚠ Values already match");
      return;
    }
    upsertChange({
      key: currentRow.key,
      fileIndex: 0,
      oldValue: getOriginalValue(currentRow.key, 0),
      newValue: rightValue,
    });
    showMessage("← Synced to left");
  }, [currentRow, fileCount, getOriginalValue, upsertChange, showMessage]);

  // Search handlers
  const handleSearchInput = useCallback(
    (value: string) => setSearchQuery(value),
    [setSearchQuery]
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
          <span fg={Colors.dimText}> │ {fileCount} files</span>
          {search.active && search.query && (
            <>
              <span fg={Colors.dimText}> │ </span>
              <span fg={Colors.selectedBg}>/{search.query}</span>
              <span fg={Colors.dimText}> ({filteredRowIndices.length})</span>
            </>
          )}
        </text>
        <text>
          <span fg={Colors.identical}>● {stats.identical}</span>
          <span fg={Colors.dimText}> </span>
          <span fg={Colors.different}>◐ {stats.different}</span>
          <span fg={Colors.dimText}> </span>
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
          files={state.files}
          changes={pendingList}
          onConfirm={doSave}
          onCancel={closeModal}
        />
      )}
    </box>
  );
}
