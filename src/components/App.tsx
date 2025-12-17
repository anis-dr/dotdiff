/**
 * App component - main TUI with state management and keyboard handling
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { InputRenderable } from "@opentui/core";
import type {
  Clipboard,
  DiffRow,
  EditMode,
  EnvFile,
  PendingChange,
} from "../types.js";
import { Colors, getVariableStatus } from "../types.js";
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
  const [files] = useState<ReadonlyArray<EnvFile>>(initialFiles);
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [pendingChanges, setPendingChanges] = useState<
    ReadonlyArray<PendingChange>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const inputRef = useRef<InputRenderable>(null);
  const [mutableDiffRows, setMutableDiffRows] =
    useState<ReadonlyArray<DiffRow>>(initialDiffRows);

  const fileCount = files.length;
  const rowCount = mutableDiffRows.length;
  const colWidths = useMemo(() => {
    // We draw a 1-char separator between columns in both header and rows.
    const separators = Math.max(0, fileCount - 1);
    const available = Math.max(0, terminalWidth - separators);
    const base = Math.max(10, Math.floor(available / Math.max(1, fileCount)));
    const used = base * Math.max(1, fileCount);
    const remainder = Math.max(0, available - used);

    return Array.from({ length: fileCount }, (_, i) =>
      i === fileCount - 1 ? base + remainder : base
    );
  }, [terminalWidth, fileCount]);

  // Show message with auto-clear
  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  // Navigation helpers
  const moveUp = useCallback(() => {
    setSelectedRow((r) => Math.max(0, r - 1));
  }, []);

  const moveDown = useCallback(() => {
    setSelectedRow((r) => Math.min(rowCount - 1, r + 1));
  }, [rowCount]);

  const moveLeft = useCallback(() => {
    setSelectedCol((c) => Math.max(0, c - 1));
  }, []);

  const moveRight = useCallback(() => {
    setSelectedCol((c) => Math.min(fileCount - 1, c + 1));
  }, [fileCount]);

  const cycleColumn = useCallback(() => {
    setSelectedCol((c) => (c + 1) % fileCount);
  }, [fileCount]);

  // Copy current cell to clipboard
  const copy = useCallback(() => {
    const row = mutableDiffRows[selectedRow];
    if (!row) return;

    const value = row.values[selectedCol];
    if (value === null || value === undefined) {
      showMessage("⚠ Cannot copy missing value");
      return;
    }

    setClipboard({ key: row.key, value });
    showMessage(`✓ Copied ${row.key}`);
  }, [mutableDiffRows, selectedRow, selectedCol, showMessage]);

  // Paste clipboard to current cell
  const paste = useCallback(() => {
    if (!clipboard) {
      showMessage("⚠ Clipboard empty");
      return;
    }

    const row = mutableDiffRows[selectedRow];
    if (!row) return;

    // Only allow pasting to the same variable
    if (clipboard.key !== row.key) {
      showMessage(`⚠ Can only paste to ${clipboard.key}`);
      return;
    }

    const originalValue = row.values[selectedCol] ?? null;
    const existingIndex = pendingChanges.findIndex(
      (c) => c.key === row.key && c.fileIndex === selectedCol
    );

    // If pasting the original value back, remove any pending change (revert)
    if (clipboard.value === originalValue) {
      if (existingIndex >= 0) {
        setPendingChanges((changes) => [
          ...changes.slice(0, existingIndex),
          ...changes.slice(existingIndex + 1),
        ]);
        showMessage("↩ Reverted to original");
      } else {
        showMessage("⚠ Already at original value");
      }
      return;
    }

    const newChange: PendingChange = {
      key: row.key,
      fileIndex: selectedCol,
      oldValue: originalValue,
      newValue: clipboard.value,
    };

    if (existingIndex >= 0) {
      setPendingChanges((changes) => [
        ...changes.slice(0, existingIndex),
        newChange,
        ...changes.slice(existingIndex + 1),
      ]);
    } else {
      setPendingChanges((changes) => [...changes, newChange]);
    }

    showMessage(`✓ Pasted to ${files[selectedCol]?.filename}`);
  }, [
    clipboard,
    mutableDiffRows,
    selectedRow,
    selectedCol,
    pendingChanges,
    files,
    showMessage,
  ]);

  // Paste to all other files
  const pasteAll = useCallback(() => {
    if (!clipboard) {
      showMessage("⚠ Clipboard empty");
      return;
    }

    const row = mutableDiffRows[selectedRow];
    if (!row) return;

    // Only allow pasting to the same variable
    if (clipboard.key !== row.key) {
      showMessage(`⚠ Can only paste to ${clipboard.key}`);
      return;
    }

    const newChanges: PendingChange[] = [];
    const revertedIndices: number[] = [];

    for (let i = 0; i < fileCount; i++) {
      if (i === selectedCol) continue;

      const originalValue = row.values[i] ?? null;

      // Only create change if value is actually different
      if (clipboard.value !== originalValue) {
        newChanges.push({
          key: row.key,
          fileIndex: i,
          oldValue: originalValue,
          newValue: clipboard.value,
        });
      } else {
        revertedIndices.push(i);
      }
    }

    // Remove pending changes for this row in other columns, then add new changes
    const filtered = pendingChanges.filter(
      (c) => !(c.key === row.key && c.fileIndex !== selectedCol)
    );
    setPendingChanges([...filtered, ...newChanges]);

    const changedCount = newChanges.length;
    const revertedCount = revertedIndices.length;
    if (changedCount > 0 && revertedCount > 0) {
      showMessage(
        `✓ ${changedCount} changed, ${revertedCount} already matching`
      );
    } else if (changedCount > 0) {
      showMessage(`✓ Pasted to ${changedCount} files`);
    } else {
      showMessage("⚠ All files already have this value");
    }
  }, [
    clipboard,
    mutableDiffRows,
    selectedRow,
    selectedCol,
    fileCount,
    pendingChanges,
    showMessage,
  ]);

  // Revert selected cell to original value
  const revert = useCallback(() => {
    const row = mutableDiffRows[selectedRow];
    if (!row) return;

    const existingIndex = pendingChanges.findIndex(
      (c) => c.key === row.key && c.fileIndex === selectedCol
    );

    if (existingIndex < 0) {
      showMessage("⚠ No pending change to revert");
      return;
    }

    setPendingChanges((changes) => [
      ...changes.slice(0, existingIndex),
      ...changes.slice(existingIndex + 1),
    ]);
    showMessage("↩ Reverted to original");
  }, [mutableDiffRows, selectedRow, selectedCol, pendingChanges, showMessage]);

  // ============ EDIT MODE HANDLERS ============

  // Enter edit mode for current cell value
  const enterEditMode = useCallback(() => {
    const row = mutableDiffRows[selectedRow];
    if (!row) return;

    const currentValue = row.values[selectedCol] ?? "";
    setEditMode({
      phase: "editValue",
      inputValue: currentValue,
    });
  }, [mutableDiffRows, selectedRow, selectedCol]);

  // Enter add mode (prompts for key first)
  const enterAddMode = useCallback(() => {
    setEditMode({
      phase: "addKey",
      inputValue: "",
    });
  }, []);

  // Handle input change in edit mode
  const handleEditInput = useCallback((value: string) => {
    setEditMode((prev) => (prev ? { ...prev, inputValue: value } : null));
  }, []);

  // Save edit and exit edit mode
  const saveEdit = useCallback((submittedValue?: string) => {
    if (!editMode) return;

    if (editMode.phase === "editValue") {
      const row = mutableDiffRows[selectedRow];
      if (!row) {
        setEditMode(null);
        return;
      }

      const originalValue = row.values[selectedCol] ?? null;
      // Use submitted value if provided (from onSubmit), otherwise fall back to state
      const newValue = submittedValue !== undefined ? submittedValue : editMode.inputValue;

      // If same as original, just exit
      if (newValue === originalValue) {
        setEditMode(null);
        showMessage("⚠ No change");
        return;
      }

      // Create or update pending change
      const existingIndex = pendingChanges.findIndex(
        (c) => c.key === row.key && c.fileIndex === selectedCol
      );

      const newChange: PendingChange = {
        key: row.key,
        fileIndex: selectedCol,
        oldValue: originalValue,
        newValue,
      };

      if (existingIndex >= 0) {
        setPendingChanges((changes) => [
          ...changes.slice(0, existingIndex),
          newChange,
          ...changes.slice(existingIndex + 1),
        ]);
      } else {
        setPendingChanges((changes) => [...changes, newChange]);
      }

      setEditMode(null);
      showMessage("✓ Value updated");
    } else if (editMode.phase === "addKey") {
      const key = editMode.inputValue.trim();
      if (!key) {
        showMessage("⚠ Key cannot be empty");
        return;
      }
      // Check if key already exists
      if (mutableDiffRows.some((r) => r.key === key)) {
        showMessage("⚠ Key already exists");
        return;
      }
      // Move to value phase
      setEditMode({
        phase: "addValue",
        inputValue: "",
        newKey: key,
      });
    } else if (editMode.phase === "addValue") {
      const key = editMode.newKey!;
      const value = editMode.inputValue;

      // Add pending changes for all files (as new variable)
      const newChanges: PendingChange[] = files.map((_, i) => ({
        key,
        fileIndex: i,
        oldValue: null,
        newValue: value,
        isNew: true,
      }));

      setPendingChanges((changes) => [...changes, ...newChanges]);

      // Add to mutableDiffRows
      const newRow: DiffRow = {
        key,
        values: files.map(() => null),
        status: "missing",
      };
      setMutableDiffRows((rows) => [...rows, newRow]);
      setSelectedRow(mutableDiffRows.length); // Select the new row

      setEditMode(null);
      showMessage(`✓ Added ${key}`);
    }
  }, [
    editMode,
    mutableDiffRows,
    selectedRow,
    selectedCol,
    pendingChanges,
    files,
    showMessage,
  ]);

  // Cancel edit mode
  const cancelEdit = useCallback(() => {
    setEditMode(null);
    showMessage("↩ Cancelled");
  }, [showMessage]);

  // Delete variable from selected file
  const deleteVariable = useCallback(() => {
    const row = mutableDiffRows[selectedRow];
    if (!row) return;

    const currentValue = row.values[selectedCol] ?? null;
    if (currentValue === null) {
      showMessage("⚠ Already missing in this file");
      return;
    }

    // Create deletion change
    const existingIndex = pendingChanges.findIndex(
      (c) => c.key === row.key && c.fileIndex === selectedCol
    );

    const newChange: PendingChange = {
      key: row.key,
      fileIndex: selectedCol,
      oldValue: currentValue,
      newValue: null, // null = deletion
    };

    if (existingIndex >= 0) {
      setPendingChanges((changes) => [
        ...changes.slice(0, existingIndex),
        newChange,
        ...changes.slice(existingIndex + 1),
      ]);
    } else {
      setPendingChanges((changes) => [...changes, newChange]);
    }

    showMessage(`✗ Marked ${row.key} for deletion`);
  }, [mutableDiffRows, selectedRow, selectedCol, pendingChanges, showMessage]);

  // Delete variable from ALL files
  const deleteAll = useCallback(() => {
    const row = mutableDiffRows[selectedRow];
    if (!row) return;

    const newChanges: PendingChange[] = [];

    for (let i = 0; i < fileCount; i++) {
      const currentValue = row.values[i] ?? null;
      if (currentValue !== null) {
        newChanges.push({
          key: row.key,
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

    // Remove existing pending changes for this key and add deletions
    const filtered = pendingChanges.filter((c) => c.key !== row.key);
    setPendingChanges([...filtered, ...newChanges]);

    showMessage(`✗ Marked ${row.key} for deletion in ${newChanges.length} files`);
  }, [mutableDiffRows, selectedRow, fileCount, pendingChanges, showMessage]);

  // Undo last change
  const undo = useCallback(() => {
    if (pendingChanges.length === 0) {
      showMessage("⚠ Nothing to undo");
      return;
    }

    setPendingChanges((changes) => changes.slice(0, -1));
    showMessage("↩ Undone");
  }, [pendingChanges, showMessage]);

  // Undo all changes
  const undoAll = useCallback(() => {
    if (pendingChanges.length === 0) {
      showMessage("⚠ Nothing to undo");
      return;
    }

    setPendingChanges([]);
    showMessage("↩ All changes undone");
  }, [pendingChanges, showMessage]);

  // Save changes
  const save = useCallback(() => {
    if (pendingChanges.length === 0) {
      showMessage("⚠ No changes to save");
      return;
    }

    onSave(pendingChanges);

    // Apply pending changes to mutableDiffRows so UI reflects saved state
    setMutableDiffRows((rows) => {
      const newRows = rows.map((row) => {
        const rowChanges = pendingChanges.filter((c) => c.key === row.key);
        if (rowChanges.length === 0) return row;

        const newValues = [...row.values];
        for (const change of rowChanges) {
          newValues[change.fileIndex] = change.newValue;
        }

        // Recalculate status using shared utility
        const status = getVariableStatus(newValues);
        return { ...row, values: newValues, status };
      });

      // Remove rows where all values are now null (fully deleted)
      return newRows.filter((row) => row.values.some((v) => v !== null));
    });

    setPendingChanges([]);
    showMessage("💾 Saved!");
  }, [pendingChanges, onSave, showMessage]);

  // Quit
  const quit = useCallback(() => {
    if (pendingChanges.length > 0) {
      showMessage("⚠ Unsaved changes! Press q again");
    }
    onQuit();
  }, [pendingChanges, onQuit, showMessage]);

  // Keyboard handling
  useKeyboard((key) => {
    // When in edit mode, only handle escape - Enter is handled by input's onSubmit
    if (editMode) {
      if (key.name === "escape") {
        cancelEdit();
      }
      // Let the input handle Enter (onSubmit) and other keys
      return;
    }

    // Normal mode keys
    switch (key.name) {
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
      case "s":
        save();
        break;
      case "e":
      case "return":
        enterEditMode();
        break;
      case "a":
        enterAddMode();
        break;
      case "d":
        if (key.shift) {
          deleteAll();
        } else {
          deleteVariable();
        }
        break;
      case "q":
        quit();
        break;
      // ESC no longer quits - reserved for edit mode cancel
    }
  });

  // Count stats
  const identicalCount = mutableDiffRows.filter(
    (r) => r.status === "identical"
  ).length;
  const differentCount = mutableDiffRows.filter(
    (r) => r.status === "different"
  ).length;
  const missingCount = mutableDiffRows.filter(
    (r) => r.status === "missing"
  ).length;

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
          <span fg={Colors.identical}>● {identicalCount}</span>
          <span fg={Colors.dimText}> </span>
          <span fg={Colors.different}>◐ {differentCount}</span>
          <span fg={Colors.dimText}> </span>
          <span fg={Colors.missing}>○ {missingCount}</span>
        </text>
      </box>

      {/* Header with file names */}
      <Header files={files} selectedCol={selectedCol} colWidths={colWidths} />

      {/* Edit mode input bar */}
      {editMode && (
        <box
          height={1}
          backgroundColor={Colors.selectedBg}
          paddingLeft={1}
          paddingRight={1}
          flexDirection="row"
        >
          <text>
            <span fg={Colors.selectedText}>
              {editMode.phase === "editValue"
                ? "Edit value: "
                : editMode.phase === "addKey"
                  ? "New key: "
                  : `${editMode.newKey}=`}
            </span>
          </text>
          <input
            ref={inputRef}
            focused
            value={editMode.inputValue}
            onInput={handleEditInput}
            onSubmit={saveEdit}
            onPaste={(e: { text: string }) => {
              // Use insertText for proper cursor position handling
              if (inputRef.current) {
                inputRef.current.insertText(e.text);
              }
            }}
            style={{ flexGrow: 1 }}
          />
          <text>
            <span fg={Colors.selectedText}> [Enter] Save [Esc] Cancel</span>
          </text>
        </box>
      )}

      {/* Main diff view */}
      <box flexDirection="column" flexGrow={1} overflow="hidden">
        <scrollbox focused={!editMode} style={{ flexGrow: 1 }}>
          {mutableDiffRows.map((row, index) => (
            <EnvRow
              key={row.key}
              row={row}
              fileCount={fileCount}
              selectedCol={selectedCol}
              isSelectedRow={index === selectedRow}
              pendingChanges={pendingChanges}
              colWidths={colWidths}
            />
          ))}
        </scrollbox>
      </box>

      {/* Footer with status and keybindings */}
      <Footer
        clipboard={clipboard}
        pendingChanges={pendingChanges}
        message={message}
      />
    </box>
  );
}
