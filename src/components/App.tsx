/**
 * App component - main TUI with Jotai state management and keyboard handling
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { InputRenderable } from "@opentui/core";
import type { DiffRow, EnvFile, PendingChange } from "../types.js";
import { Colors, getVariableStatus } from "../types.js";
import {
  clipboardAtom,
  colWidthsAtom,
  diffRowsAtom,
  editModeAtom,
  filesAtom,
  messageAtom,
  pendingChangesAtom,
  selectedColAtom,
  selectedRowAtom,
} from "../state/atoms.js";
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
  const inputRef = useRef<InputRenderable>(null);

  // Jotai atoms
  const [files, setFiles] = useAtom(filesAtom);
  const [diffRows, setDiffRows] = useAtom(diffRowsAtom);
  const [selectedRow, setSelectedRow] = useAtom(selectedRowAtom);
  const [selectedCol, setSelectedCol] = useAtom(selectedColAtom);
  const [clipboard, setClipboard] = useAtom(clipboardAtom);
  const [pendingChanges, setPendingChanges] = useAtom(pendingChangesAtom);
  const [editMode, setEditMode] = useAtom(editModeAtom);
  const [message, setMessage] = useAtom(messageAtom);
  const setColWidths = useSetAtom(colWidthsAtom);

  // Initialize atoms from props on mount
  useEffect(() => {
    setFiles(initialFiles);
    setDiffRows(initialDiffRows);
  }, [initialFiles, initialDiffRows, setFiles, setDiffRows]);

  const fileCount = files.length;
  const rowCount = diffRows.length;

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

  // Sync colWidths to atom for children
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

  // Navigation helpers
  const moveUp = useCallback(() => {
    setSelectedRow((r) => Math.max(0, r - 1));
  }, [setSelectedRow]);

  const moveDown = useCallback(() => {
    setSelectedRow((r) => Math.min(rowCount - 1, r + 1));
  }, [rowCount, setSelectedRow]);

  const moveLeft = useCallback(() => {
    setSelectedCol((c) => Math.max(0, c - 1));
  }, [setSelectedCol]);

  const moveRight = useCallback(() => {
    setSelectedCol((c) => Math.min(fileCount - 1, c + 1));
  }, [fileCount, setSelectedCol]);

  const cycleColumn = useCallback(() => {
    setSelectedCol((c) => (c + 1) % fileCount);
  }, [fileCount, setSelectedCol]);

  // Copy current cell to clipboard
  const copy = useCallback(() => {
    const row = diffRows[selectedRow];
    if (!row) return;

    const value = row.values[selectedCol];
    if (value === null || value === undefined) {
      showMessage("⚠ Cannot copy missing value");
      return;
    }

    setClipboard({ key: row.key, value });
    showMessage(`✓ Copied ${row.key}`);
  }, [diffRows, selectedRow, selectedCol, showMessage, setClipboard]);

  // Paste clipboard to current cell
  const paste = useCallback(() => {
    if (!clipboard) {
      showMessage("⚠ Clipboard empty");
      return;
    }

    const row = diffRows[selectedRow];
    if (!row) return;

    if (clipboard.key !== row.key) {
      showMessage(`⚠ Can only paste to ${clipboard.key}`);
      return;
    }

    const originalValue = row.values[selectedCol] ?? null;
    const existingIndex = pendingChanges.findIndex(
      (c) => c.key === row.key && c.fileIndex === selectedCol
    );

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
    diffRows,
    selectedRow,
    selectedCol,
    pendingChanges,
    files,
    showMessage,
    setPendingChanges,
  ]);

  // Paste to all other files
  const pasteAll = useCallback(() => {
    if (!clipboard) {
      showMessage("⚠ Clipboard empty");
      return;
    }

    const row = diffRows[selectedRow];
    if (!row) return;

    if (clipboard.key !== row.key) {
      showMessage(`⚠ Can only paste to ${clipboard.key}`);
      return;
    }

    const newChanges: PendingChange[] = [];
    const revertedIndices: number[] = [];

    for (let i = 0; i < fileCount; i++) {
      if (i === selectedCol) continue;

      const originalValue = row.values[i] ?? null;

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
    diffRows,
    selectedRow,
    selectedCol,
    fileCount,
    pendingChanges,
    showMessage,
    setPendingChanges,
  ]);

  // Revert selected cell to original value
  const revert = useCallback(() => {
    const row = diffRows[selectedRow];
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
  }, [
    diffRows,
    selectedRow,
    selectedCol,
    pendingChanges,
    showMessage,
    setPendingChanges,
  ]);

  // ============ EDIT MODE HANDLERS ============

  const enterEditMode = useCallback(() => {
    const row = diffRows[selectedRow];
    if (!row) return;

    const currentValue = row.values[selectedCol] ?? "";
    setEditMode({
      phase: "editValue",
      inputValue: currentValue,
    });
  }, [diffRows, selectedRow, selectedCol, setEditMode]);

  const enterAddMode = useCallback(() => {
    setEditMode({
      phase: "addKey",
      inputValue: "",
    });
  }, [setEditMode]);

  const handleEditInput = useCallback(
    (value: string) => {
      setEditMode((prev) => (prev ? { ...prev, inputValue: value } : null));
    },
    [setEditMode]
  );

  const saveEdit = useCallback(
    (submittedValue?: string) => {
      if (!editMode) return;

      if (editMode.phase === "editValue") {
        const row = diffRows[selectedRow];
        if (!row) {
          setEditMode(null);
          return;
        }

        const originalValue = row.values[selectedCol] ?? null;
        const newValue =
          submittedValue !== undefined ? submittedValue : editMode.inputValue;

        if (newValue === originalValue) {
          setEditMode(null);
          showMessage("⚠ No change");
          return;
        }

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
        if (diffRows.some((r) => r.key === key)) {
          showMessage("⚠ Key already exists");
          return;
        }
        setEditMode({
          phase: "addValue",
          inputValue: "",
          newKey: key,
        });
      } else if (editMode.phase === "addValue") {
        const key = editMode.newKey!;
        const value = editMode.inputValue;

        const newChanges: PendingChange[] = files.map((_, i) => ({
          key,
          fileIndex: i,
          oldValue: null,
          newValue: value,
          isNew: true,
        }));

        setPendingChanges((changes) => [...changes, ...newChanges]);

        const newRow: DiffRow = {
          key,
          values: files.map(() => null),
          status: "missing",
        };
        setDiffRows((rows) => [...rows, newRow]);
        setSelectedRow(diffRows.length);

        setEditMode(null);
        showMessage(`✓ Added ${key}`);
      }
    },
    [
      editMode,
      diffRows,
      selectedRow,
      selectedCol,
      pendingChanges,
      files,
      showMessage,
      setEditMode,
      setPendingChanges,
      setDiffRows,
      setSelectedRow,
    ]
  );

  const cancelEdit = useCallback(() => {
    setEditMode(null);
    showMessage("↩ Cancelled");
  }, [showMessage, setEditMode]);

  const deleteVariable = useCallback(() => {
    const row = diffRows[selectedRow];
    if (!row) return;

    const currentValue = row.values[selectedCol] ?? null;
    if (currentValue === null) {
      showMessage("⚠ Already missing in this file");
      return;
    }

    const existingIndex = pendingChanges.findIndex(
      (c) => c.key === row.key && c.fileIndex === selectedCol
    );

    const newChange: PendingChange = {
      key: row.key,
      fileIndex: selectedCol,
      oldValue: currentValue,
      newValue: null,
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
  }, [
    diffRows,
    selectedRow,
    selectedCol,
    pendingChanges,
    showMessage,
    setPendingChanges,
  ]);

  const deleteAll = useCallback(() => {
    const row = diffRows[selectedRow];
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

    const filtered = pendingChanges.filter((c) => c.key !== row.key);
    setPendingChanges([...filtered, ...newChanges]);

    showMessage(
      `✗ Marked ${row.key} for deletion in ${newChanges.length} files`
    );
  }, [
    diffRows,
    selectedRow,
    fileCount,
    pendingChanges,
    showMessage,
    setPendingChanges,
  ]);

  const undo = useCallback(() => {
    if (pendingChanges.length === 0) {
      showMessage("⚠ Nothing to undo");
      return;
    }

    setPendingChanges((changes) => changes.slice(0, -1));
    showMessage("↩ Undone");
  }, [pendingChanges, showMessage, setPendingChanges]);

  const undoAll = useCallback(() => {
    if (pendingChanges.length === 0) {
      showMessage("⚠ Nothing to undo");
      return;
    }

    setPendingChanges([]);
    showMessage("↩ All changes undone");
  }, [pendingChanges, showMessage, setPendingChanges]);

  const save = useCallback(() => {
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

    setPendingChanges([]);
    showMessage("💾 Saved!");
  }, [pendingChanges, onSave, showMessage, setDiffRows, setPendingChanges]);

  const quit = useCallback(() => {
    if (pendingChanges.length > 0) {
      showMessage("⚠ Unsaved changes! Press q again");
    }
    onQuit();
  }, [pendingChanges, onQuit, showMessage]);

  // Keyboard handling
  useKeyboard((key) => {
    if (editMode) {
      if (key.name === "escape") {
        cancelEdit();
      }
      return;
    }

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
    }
  });

  // Count stats
  const identicalCount = diffRows.filter(
    (r) => r.status === "identical"
  ).length;
  const differentCount = diffRows.filter(
    (r) => r.status === "different"
  ).length;
  const missingCount = diffRows.filter((r) => r.status === "missing").length;

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
      <Header />

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
          {diffRows.map((row, index) => (
            <EnvRow key={row.key} row={row} rowIndex={index} />
          ))}
        </scrollbox>
      </box>

      {/* Footer with status and keybindings */}
      <Footer />
    </box>
  );
}
