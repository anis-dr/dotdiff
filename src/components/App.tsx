/**
 * App component - main TUI with Jotai state management and keyboard handling
 */
import { useCallback, useEffect, useMemo } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useTerminalDimensions } from "@opentui/react";
import type { DiffRow, EnvFile, ModalState, PendingChange } from "../types.js";
import { Colors, getVariableStatus } from "../types.js";
import {
  colWidthsAtom,
  diffRowsAtom,
  filesAtom,
  messageAtom,
  modalStateAtom,
} from "../state/atoms.js";
import {
  usePendingChanges,
  useNavigation,
  useCurrentRow,
  useClipboard,
  useEditMode,
  useKeyBindings,
  useSearch,
} from "../hooks/index.js";
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
  readonly initialDiffRows: ReadonlyArray<DiffRow>;
  readonly onSave: (
    changes: ReadonlyArray<PendingChange>
  ) => Promise<ReadonlyArray<EnvFile>>;
  readonly onQuit: () => void;
}

export function App({
  initialFiles,
  initialDiffRows,
  onSave,
  onQuit,
}: AppProps) {
  const { width: terminalWidth } = useTerminalDimensions();

  // Core state
  const [files, setFiles] = useAtom(filesAtom);
  const [diffRows, setDiffRows] = useAtom(diffRowsAtom);
  const [message, setMessage] = useAtom(messageAtom);
  const setColWidths = useSetAtom(colWidthsAtom);

  const fileCount = files.length;
  const rowCount = diffRows.length;

  // Custom hooks
  const pendingChangesHook = usePendingChanges();
  const { pendingChanges, clearChanges, undoLast, upsertChange, removeChange, removeChangesForKey, addChanges, findChange } =
    pendingChangesHook;

  const navigation = useNavigation(rowCount, fileCount);
  const { selectedRow, selectedCol, setSelectedRow } = navigation;

  const { currentRow } = useCurrentRow();

  const clipboardHook = useClipboard(pendingChangesHook);
  const editModeHook = useEditMode(pendingChangesHook);
  const { editMode, handleEditInput, cancelEdit } = editModeHook;

  // Search state
  const searchHook = useSearch();
  const {
    isSearchActive,
    searchQuery,
    matchCount,
    openSearch,
    closeSearch,
    setSearchQuery,
    nextMatch,
    prevMatch,
    nextDiff,
    prevDiff,
  } = searchHook;

  // Modal state
  const [modalState, setModalState] = useAtom(modalStateAtom);

  // Initialize atoms from props on mount
  useEffect(() => {
    setFiles(initialFiles);
    setDiffRows(initialDiffRows);
  }, [initialFiles, initialDiffRows, setFiles, setDiffRows]);

  // Calculate and set column widths (2-file optimized layout)
  // Layout: [Key column] | [File A value] | [File B value]
  const colWidths = useMemo(() => {
    // Key column takes ~35% of width, value columns split the rest
    const separators = 2; // Two separators: key|valA|valB
    const available = Math.max(0, terminalWidth - separators);
    const keyColWidth = Math.max(20, Math.floor(available * 0.35));
    const valueWidth = Math.max(15, Math.floor((available - keyColWidth) / Math.max(1, fileCount)));
    const used = keyColWidth + valueWidth * fileCount;
    const remainder = Math.max(0, available - used);

    // Return [keyColWidth, ...valueWidths] - last value col gets remainder
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

  // Show message with auto-clear
  const showMessage = useCallback(
    (msg: string) => {
      setMessage(msg);
      setTimeout(() => setMessage(null), 2000);
    },
    [setMessage]
  );

  // Action handlers that use hooks and show messages
  const handleCopy = useCallback(() => {
    if (!currentRow) return;
    const msg = clipboardHook.copy(currentRow);
    if (msg) showMessage(msg);
  }, [currentRow, clipboardHook, showMessage]);

  const handlePaste = useCallback(() => {
    if (!currentRow) return;
    const msg = clipboardHook.paste(currentRow);
    if (msg) showMessage(msg);
  }, [currentRow, clipboardHook, showMessage]);

  const handlePasteAll = useCallback(() => {
    if (!currentRow) return;
    const msg = clipboardHook.pasteAll(currentRow, fileCount);
    if (msg) showMessage(msg);
  }, [currentRow, clipboardHook, fileCount, showMessage]);

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
    if (pendingChanges.length === 0) {
      showMessage("⚠ Nothing to undo");
      return;
    }
    clearChanges();
    showMessage("↩ All changes undone");
  }, [pendingChanges.length, clearChanges, showMessage]);

  const handleEnterEditMode = useCallback(() => {
    if (!currentRow) return;
    editModeHook.enterEditMode(currentRow);
  }, [currentRow, editModeHook]);

  const handleSaveEdit = useCallback(
    (submittedValue?: string) => {
      const msg = editModeHook.saveEdit(currentRow, submittedValue);
      if (msg) showMessage(msg);
    },
    [currentRow, editModeHook, showMessage]
  );

  const handleCancelEdit = useCallback(() => {
    const msg = cancelEdit();
    showMessage(msg);
  }, [cancelEdit, showMessage]);

  const handleDeleteVariable = useCallback(() => {
    if (!currentRow) return;
    const originalValue = currentRow.values[selectedCol] ?? null;
    const pending = findChange(currentRow.key, selectedCol);
    const effectiveValue = pending ? pending.newValue : originalValue;

    // If it's already missing (and no pending value), nothing to delete
    if (effectiveValue === null) {
      showMessage("⚠ Already missing in this file");
      return;
    }

    // If the value only exists due to a pending change and original was missing,
    // deleting should just revert the pending change.
    if (originalValue === null) {
      removeChange(currentRow.key, selectedCol);
      showMessage("↩ Reverted to missing");
      return;
    }

    // Otherwise mark for deletion
    upsertChange({
      key: currentRow.key,
      fileIndex: selectedCol,
      oldValue: originalValue,
      newValue: null,
    });
    showMessage(`✗ Marked ${currentRow.key} for deletion`);
  }, [currentRow, selectedCol, findChange, removeChange, upsertChange, showMessage]);

  const handleDeleteAll = useCallback(() => {
    if (!currentRow) return;

    const newChanges: PendingChange[] = [];
    for (let i = 0; i < fileCount; i++) {
      const currentValue = currentRow.values[i] ?? null;
      if (currentValue !== null) {
        newChanges.push({
          key: currentRow.key,
          fileIndex: i,
          oldValue: currentValue,
          newValue: null,
        });
      }
    }

    // If there are no original values to delete, we may still need to revert
    // pending values that were added to previously-missing files.
    if (newChanges.length === 0) {
      const hadPendingForKey = pendingChanges.some((c) => c.key === currentRow.key);
      if (hadPendingForKey) {
        removeChangesForKey(currentRow.key);
        showMessage("↩ Reverted pending values (now missing everywhere)");
      } else {
        showMessage("⚠ Already missing in all files");
      }
      return;
    }

    // Remove existing changes for this key (including pending adds), then apply deletions
    removeChangesForKey(currentRow.key);
    addChanges(newChanges);
    showMessage(
      `✗ Marked ${currentRow.key} for deletion in ${newChanges.length} files`
    );
  }, [currentRow, fileCount, pendingChanges, removeChangesForKey, addChanges, showMessage]);

  // Open save preview modal
  const handleSave = useCallback(() => {
    if (pendingChanges.length === 0) {
      showMessage("⚠ No changes to save");
      return;
    }
    setModalState({ type: "save" });
  }, [pendingChanges.length, showMessage, setModalState]);

  // Actually perform the save
  const doSave = useCallback(async () => {
    try {
      const updatedFiles = await onSave(pendingChanges);
      setFiles(updatedFiles);

      setDiffRows((rows) => {
        const newRows = rows.map((row) => {
          const rowChanges = pendingChanges.filter((c) => c.key === row.key);
          if (rowChanges.length === 0) return row;

          const newValues = [...row.values];
          for (const change of rowChanges) {
            newValues[change.fileIndex] = change.newValue;
          }

          const status = getVariableStatus(newValues);
          return { ...row, values: newValues, status };
        });

        return newRows.filter((row) => row.values.some((v) => v !== null));
      });

      clearChanges();
      setModalState(null);
      showMessage("💾 Saved!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showMessage(`⚠ Save failed: ${msg}`);
    }
  }, [
    pendingChanges,
    onSave,
    setFiles,
    setDiffRows,
    clearChanges,
    setModalState,
    showMessage,
  ]);

  // Open quit confirmation modal if dirty, otherwise quit
  const handleQuit = useCallback(() => {
    if (pendingChanges.length > 0) {
      setModalState({ type: "quit" });
    } else {
      onQuit();
    }
  }, [pendingChanges.length, setModalState, onQuit]);

  // Open help modal
  const handleHelp = useCallback(() => {
    setModalState({ type: "help" });
  }, [setModalState]);

  // Close modal
  const closeModal = useCallback(() => {
    setModalState(null);
  }, [setModalState]);

  // Directional sync: copy left value to right
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
      oldValue: rightValue,
      newValue: leftValue,
    });
    showMessage("→ Synced to right");
  }, [currentRow, fileCount, upsertChange, showMessage]);

  // Directional sync: copy right value to left
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
      oldValue: leftValue,
      newValue: rightValue,
    });
    showMessage("← Synced to left");
  }, [currentRow, fileCount, upsertChange, showMessage]);

  // Keyboard bindings
  useKeyBindings(editMode, isSearchActive, modalState, {
    ...navigation,
    copy: handleCopy,
    paste: handlePaste,
    pasteAll: handlePasteAll,
    revert: handleRevert,
    undo: handleUndo,
    undoAll: handleUndoAll,
    save: handleSave,
    enterEditMode: handleEnterEditMode,
    enterAddMode: editModeHook.enterAddMode,
    deleteVariable: handleDeleteVariable,
    deleteAll: handleDeleteAll,
    quit: handleQuit,
    cancelEdit: handleCancelEdit,
    // New actions
    openSearch,
    closeSearch,
    nextMatch,
    prevMatch,
    nextDiff,
    prevDiff,
    openHelp: handleHelp,
    closeModal,
    confirmModal: () => {
      if (modalState?.type === "quit") onQuit();
      else if (modalState?.type === "save") doSave();
      else closeModal();
    },
    syncToLeft: handleSyncToLeft,
    syncToRight: handleSyncToRight,
  });

  // Count stats in single pass
  const statusCounts = useMemo(() => {
    const counts = { identical: 0, different: 0, missing: 0 };
    for (const row of diffRows) {
      counts[row.status]++;
    }
    return counts;
  }, [diffRows]);

  // Handle search input
  const handleSearchInput = useCallback(
    (value: string) => {
      setSearchQuery(value);
    },
    [setSearchQuery]
  );

  const handleSearchSubmit = useCallback(() => {
    // When submitting search, jump to next match and close search input
    nextMatch();
    closeSearch();
  }, [nextMatch, closeSearch]);

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
          {isSearchActive && searchQuery && (
            <>
              <span fg={Colors.dimText}> │ </span>
              <span fg={Colors.selectedBg}>/{searchQuery}</span>
              <span fg={Colors.dimText}> ({matchCount})</span>
            </>
          )}
        </text>
        <text>
          <span fg={Colors.identical}>● {statusCounts.identical}</span>
          <span fg={Colors.dimText}> </span>
          <span fg={Colors.different}>◐ {statusCounts.different}</span>
          <span fg={Colors.dimText}> </span>
          <span fg={Colors.missing}>○ {statusCounts.missing}</span>
        </text>
      </box>

      {/* Search overlay (when active) */}
      {isSearchActive && (
        <SearchOverlay
          query={searchQuery}
          matchCount={matchCount}
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
        <scrollbox focused={!editMode && !isSearchActive && !modalState} style={{ flexGrow: 1 }}>
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

      {/* Inspector - shows full values and old->new for selected row */}
      <Inspector row={currentRow} />

      {/* Footer with status and keybindings */}
      <Footer />

      {/* Modals */}
      {modalState?.type === "help" && <HelpOverlay onClose={closeModal} />}
      {modalState?.type === "quit" && (
        <QuitConfirmModal
          pendingCount={pendingChanges.length}
          onConfirm={onQuit}
          onCancel={closeModal}
        />
      )}
      {modalState?.type === "save" && (
        <SavePreviewModal
          files={files}
          changes={pendingChanges}
          onConfirm={doSave}
          onCancel={closeModal}
        />
      )}
    </box>
  );
}
