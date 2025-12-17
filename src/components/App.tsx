/**
 * App component - main TUI with Jotai state management and keyboard handling
 */
import { useCallback, useEffect, useMemo } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useTerminalDimensions } from "@opentui/react";
import type { DiffRow, EnvFile, PendingChange } from "../types.js";
import { Colors, getVariableStatus } from "../types.js";
import {
  colWidthsAtom,
  diffRowsAtom,
  filesAtom,
  messageAtom,
} from "../state/atoms.js";
import {
  usePendingChanges,
  useNavigation,
  useCurrentRow,
  useClipboard,
  useEditMode,
  useKeyBindings,
} from "../hooks/index.js";
import { Header } from "./Header.js";
import { EnvRow } from "./EnvRow.js";
import { Footer } from "./Footer.js";

interface AppProps {
  readonly initialFiles: ReadonlyArray<EnvFile>;
  readonly initialDiffRows: ReadonlyArray<DiffRow>;
  readonly onSave: (changes: ReadonlyArray<PendingChange>) => void;
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

  // Initialize atoms from props on mount
  useEffect(() => {
    setFiles(initialFiles);
    setDiffRows(initialDiffRows);
  }, [initialFiles, initialDiffRows, setFiles, setDiffRows]);

  // Calculate and set column widths
  const colWidths = useMemo(() => {
    const separators = Math.max(0, fileCount - 1);
    const available = Math.max(0, terminalWidth - separators);
    const base = Math.max(10, Math.floor(available / Math.max(1, fileCount)));
    const used = base * Math.max(1, fileCount);
    const remainder = Math.max(0, available - used);

    return Array.from({ length: fileCount }, (_, i) =>
      i === fileCount - 1 ? base + remainder : base
    );
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
    const currentValue = currentRow.values[selectedCol] ?? null;
    if (currentValue === null) {
      showMessage("⚠ Already missing in this file");
      return;
    }

    upsertChange({
      key: currentRow.key,
      fileIndex: selectedCol,
      oldValue: currentValue,
      newValue: null,
    });
    showMessage(`✗ Marked ${currentRow.key} for deletion`);
  }, [currentRow, selectedCol, upsertChange, showMessage]);

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

    if (newChanges.length === 0) {
      showMessage("⚠ Already missing in all files");
      return;
    }

    removeChangesForKey(currentRow.key);
    addChanges(newChanges);
    showMessage(
      `✗ Marked ${currentRow.key} for deletion in ${newChanges.length} files`
    );
  }, [currentRow, fileCount, removeChangesForKey, addChanges, showMessage]);

  const handleSave = useCallback(() => {
    if (pendingChanges.length === 0) {
      showMessage("⚠ No changes to save");
      return;
    }

    onSave(pendingChanges);

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
    showMessage("💾 Saved!");
  }, [pendingChanges, onSave, setDiffRows, clearChanges, showMessage]);

  const handleQuit = useCallback(() => {
    if (pendingChanges.length > 0) {
      showMessage("⚠ Unsaved changes! Press q again");
    }
    onQuit();
  }, [pendingChanges.length, onQuit, showMessage]);

  // Keyboard bindings
  useKeyBindings(editMode, {
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
  });

  // Count stats in single pass
  const statusCounts = useMemo(() => {
    const counts = { identical: 0, different: 0, missing: 0 };
    for (const row of diffRows) {
      counts[row.status]++;
    }
    return counts;
  }, [diffRows]);

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
            <span fg={Colors.selectedBg}>env-differ</span>
          </b>
          <span fg={Colors.dimText}> │ {fileCount} files</span>
        </text>
        <text>
          <span fg={Colors.identical}>● {statusCounts.identical}</span>
          <span fg={Colors.dimText}> </span>
          <span fg={Colors.different}>◐ {statusCounts.different}</span>
          <span fg={Colors.dimText}> </span>
          <span fg={Colors.missing}>○ {statusCounts.missing}</span>
        </text>
      </box>

      {/* Header with file names */}
      <Header />

      {/* Main diff view */}
      <box flexDirection="column" flexGrow={1} overflow="hidden">
        <scrollbox focused={!editMode} style={{ flexGrow: 1 }}>
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

      {/* Footer with status and keybindings */}
      <Footer />
    </box>
  );
}
