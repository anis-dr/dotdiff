/**
 * Tests for state/atomicOps.ts - atomic state operations
 *
 * Uses Registry.make() to create isolated test environments for each test.
 * Operations are triggered via registry.set(op, args) and results verified
 * by reading the affected atoms with registry.get(atom).
 */
import { Registry } from "@effect-atom/atom-react";
import { describe, expect, test } from "bun:test";
import {
  addChangesOp,
  appModeAtom,
  canRedoAtom,
  canUndoAtom,
  clearChangesOp,
  clipboardAtom,
  closeModalOp,
  closeSearchOp,
  colWidthsAtom,
  conflictsAtom,
  cycleColumnOp,
  deleteAllActionOp,
  deleteVariableActionOp,
  editModeAtom,
  enterAddModeOp,
  enterEditModeOp,
  enterSearchModeOp,
  exitEditModeOp,
  filesAtom,
  historyAtom,
  messageAtom,
  moveDownOp,
  moveLeftOp,
  moveRightOp,
  moveUpOp,
  openModalOp,
  pasteActionOp,
  pasteAllActionOp,
  pendingAtom,
  pendingKey,
  recordHistoryOp,
  redoOp,
  removeChangeOp,
  removeChangesForKeyOp,
  revertActionOp,
  selectionAtom,
  setClipboardOp,
  setColWidthsOp,
  setFilesOp,
  setMessageOp,
  setSearchQueryOp,
  setSelectionOp,
  syncToLeftActionOp,
  syncToRightActionOp,
  undoAllOp,
  undoOp,
  updateEditInputOp,
  updateFileFromDiskOp,
  upsertChangeOp,
} from "../../src/state/index.js";
import { Clipboard, EnvFile, EnvKey, FileIndex, FilePath, PendingChange } from "../../src/types.js";

// Helper to create a mock EnvFile
const createFile = (path: string, vars: Record<string, string>) =>
  EnvFile.make({
    path: FilePath.make(path),
    filename: path.split("/").pop() ?? path,
    variables: new Map(Object.entries(vars)),
  });

describe("pendingKey", () => {
  test("creates correct key format", () => {
    expect(pendingKey(EnvKey.make("MY_VAR"), FileIndex.make(0))).toBe("MY_VAR:0");
    expect(pendingKey(EnvKey.make("API_KEY"), FileIndex.make(2))).toBe("API_KEY:2");
  });
});

describe("setFilesOp", () => {
  test("sets files array", () => {
    const registry = Registry.make();
    const files = [createFile("/path/to/.env", { KEY: "value" })];

    registry.set(setFilesOp, files);

    expect(registry.get(filesAtom)).toEqual(files);
  });
});

describe("upsertChangeOp", () => {
  test("adds new change", () => {
    const registry = Registry.make();
    const change = PendingChange.make({
      key: EnvKey.make("MY_VAR"),
      fileIndex: FileIndex.make(0),
      oldValue: "old",
      newValue: "new",
    });

    registry.set(upsertChangeOp, change);

    const pending = registry.get(pendingAtom);
    expect(pending.size).toBe(1);
    expect(pending.get("MY_VAR:0")).toEqual(change);
  });

  test("updates existing change", () => {
    const registry = Registry.make();
    const change1 = PendingChange.make({
      key: EnvKey.make("MY_VAR"),
      fileIndex: FileIndex.make(0),
      oldValue: "old",
      newValue: "new1",
    });
    const change2 = PendingChange.make({
      key: EnvKey.make("MY_VAR"),
      fileIndex: FileIndex.make(0),
      oldValue: "old",
      newValue: "new2",
    });

    registry.set(upsertChangeOp, change1);
    registry.set(upsertChangeOp, change2);

    const pending = registry.get(pendingAtom);
    expect(pending.size).toBe(1);
    expect(pending.get("MY_VAR:0")?.newValue).toBe("new2");
  });
});

describe("removeChangeOp", () => {
  test("removes existing change", () => {
    const registry = Registry.make();
    const change = PendingChange.make({
      key: EnvKey.make("MY_VAR"),
      fileIndex: FileIndex.make(0),
      oldValue: "old",
      newValue: "new",
    });

    registry.set(upsertChangeOp, change);
    registry.set(removeChangeOp, { varKey: EnvKey.make("MY_VAR"), fileIndex: FileIndex.make(0) });

    expect(registry.get(pendingAtom).size).toBe(0);
  });

  test("no-op for non-existent change", () => {
    const registry = Registry.make();

    registry.set(removeChangeOp, { varKey: EnvKey.make("NONEXISTENT"), fileIndex: FileIndex.make(0) });

    expect(registry.get(pendingAtom).size).toBe(0);
  });

  test("also clears conflict", () => {
    const registry = Registry.make();
    const pending = new Map([
      [
        "MY_VAR:0",
        PendingChange.make({
          key: EnvKey.make("MY_VAR"),
          fileIndex: FileIndex.make(0),
          oldValue: "old",
          newValue: "new",
        }),
      ],
    ]);
    const conflicts = new Set(["MY_VAR:0"]);

    registry.set(pendingAtom, pending);
    registry.set(conflictsAtom, conflicts);
    registry.set(removeChangeOp, { varKey: EnvKey.make("MY_VAR"), fileIndex: FileIndex.make(0) });

    expect(registry.get(pendingAtom).size).toBe(0);
    expect(registry.get(conflictsAtom).size).toBe(0);
  });
});

describe("removeChangesForKeyOp", () => {
  test("removes all changes for key", () => {
    const registry = Registry.make();
    const pending = new Map([
      [
        "MY_VAR:0",
        PendingChange.make({ key: EnvKey.make("MY_VAR"), fileIndex: FileIndex.make(0), oldValue: "a", newValue: "b" }),
      ],
      [
        "MY_VAR:1",
        PendingChange.make({ key: EnvKey.make("MY_VAR"), fileIndex: FileIndex.make(1), oldValue: "c", newValue: "d" }),
      ],
      [
        "OTHER:0",
        PendingChange.make({ key: EnvKey.make("OTHER"), fileIndex: FileIndex.make(0), oldValue: "e", newValue: "f" }),
      ],
    ]);

    registry.set(pendingAtom, pending);
    registry.set(removeChangesForKeyOp, { varKey: EnvKey.make("MY_VAR") });

    const result = registry.get(pendingAtom);
    expect(result.size).toBe(1);
    expect(result.has("OTHER:0")).toBe(true);
  });

  test("respects excludeFileIndex", () => {
    const registry = Registry.make();
    const pending = new Map([
      [
        "MY_VAR:0",
        PendingChange.make({ key: EnvKey.make("MY_VAR"), fileIndex: FileIndex.make(0), oldValue: "a", newValue: "b" }),
      ],
      [
        "MY_VAR:1",
        PendingChange.make({ key: EnvKey.make("MY_VAR"), fileIndex: FileIndex.make(1), oldValue: "c", newValue: "d" }),
      ],
    ]);

    registry.set(pendingAtom, pending);
    registry.set(removeChangesForKeyOp, { varKey: EnvKey.make("MY_VAR"), excludeFileIndex: FileIndex.make(1) });

    const result = registry.get(pendingAtom);
    expect(result.size).toBe(1);
    expect(result.has("MY_VAR:1")).toBe(true);
  });
});

describe("clearChangesOp", () => {
  test("clears all pending and conflicts", () => {
    const registry = Registry.make();
    const pending = new Map([
      [
        "A:0",
        PendingChange.make({ key: EnvKey.make("A"), fileIndex: FileIndex.make(0), oldValue: "a", newValue: "b" }),
      ],
      [
        "B:1",
        PendingChange.make({ key: EnvKey.make("B"), fileIndex: FileIndex.make(1), oldValue: "c", newValue: "d" }),
      ],
    ]);
    const conflicts = new Set(["A:0"]);

    registry.set(pendingAtom, pending);
    registry.set(conflictsAtom, conflicts);
    registry.set(clearChangesOp, undefined);

    expect(registry.get(pendingAtom).size).toBe(0);
    expect(registry.get(conflictsAtom).size).toBe(0);
  });
});

describe("history-based undo/redo", () => {
  test("recordHistoryOp saves current state to history", () => {
    const registry = Registry.make();

    // Add a change
    const change = PendingChange.make({
      key: EnvKey.make("MY_VAR"),
      fileIndex: FileIndex.make(0),
      oldValue: "old",
      newValue: "new",
    });
    registry.set(upsertChangeOp, change);

    // Record history
    registry.set(recordHistoryOp, undefined);

    const history = registry.get(historyAtom);
    expect((history.past as ReadonlyArray<unknown>).length).toBe(1);
  });

  test("undoOp restores previous state", () => {
    const registry = Registry.make();

    // Record history BEFORE first change (captures empty state)
    registry.set(recordHistoryOp, undefined);

    // Add first change
    const change1 = PendingChange.make({
      key: EnvKey.make("FIRST"),
      fileIndex: FileIndex.make(0),
      oldValue: "a",
      newValue: "b",
    });
    registry.set(upsertChangeOp, change1);

    // Record history BEFORE second change (captures FIRST state)
    registry.set(recordHistoryOp, undefined);

    // Add second change
    const change2 = PendingChange.make({
      key: EnvKey.make("SECOND"),
      fileIndex: FileIndex.make(0),
      oldValue: "c",
      newValue: "d",
    });
    registry.set(upsertChangeOp, change2);

    // Undo - should restore to state with only FIRST
    registry.set(undoOp, undefined);

    const pending = registry.get(pendingAtom);
    expect(pending.size).toBe(1);
    expect(pending.has("FIRST:0")).toBe(true);
    expect(pending.has("SECOND:0")).toBe(false);
  });

  test("redoOp restores undone state", () => {
    const registry = Registry.make();

    // Record BEFORE change (captures empty state)
    registry.set(recordHistoryOp, undefined);

    // Add change
    const change = PendingChange.make({
      key: EnvKey.make("MY_VAR"),
      fileIndex: FileIndex.make(0),
      oldValue: "old",
      newValue: "new",
    });
    registry.set(upsertChangeOp, change);

    // Undo - should restore to empty (before change)
    registry.set(undoOp, undefined);
    expect(registry.get(pendingAtom).size).toBe(0);

    // Redo - should restore to MY_VAR (after change)
    registry.set(redoOp, undefined);
    expect(registry.get(pendingAtom).size).toBe(1);
    expect(registry.get(pendingAtom).has("MY_VAR:0")).toBe(true);
  });

  test("undoAllOp clears all pending", () => {
    const registry = Registry.make();

    // Add multiple changes
    registry.set(
      upsertChangeOp,
      PendingChange.make({ key: EnvKey.make("FIRST"), fileIndex: FileIndex.make(0), oldValue: "a", newValue: "b" }),
    );
    registry.set(recordHistoryOp, undefined);
    registry.set(
      upsertChangeOp,
      PendingChange.make({ key: EnvKey.make("SECOND"), fileIndex: FileIndex.make(0), oldValue: "c", newValue: "d" }),
    );

    // Undo all
    registry.set(undoAllOp, undefined);

    expect(registry.get(pendingAtom).size).toBe(0);
    expect(registry.get(conflictsAtom).size).toBe(0);
  });

  test("undoOp shows message when nothing to undo", () => {
    const registry = Registry.make();

    registry.set(undoOp, undefined);

    expect(registry.get(messageAtom)).toBe("⚠ Nothing to undo");
  });

  test("redoOp shows message when nothing to redo", () => {
    const registry = Registry.make();

    registry.set(redoOp, undefined);

    expect(registry.get(messageAtom)).toBe("⚠ Nothing to redo");
  });

  test("history resets on undo all", () => {
    const registry = Registry.make();

    // Build up some history
    registry.set(
      upsertChangeOp,
      PendingChange.make({ key: EnvKey.make("VAR"), fileIndex: FileIndex.make(0), oldValue: "a", newValue: "b" }),
    );
    registry.set(recordHistoryOp, undefined);

    // Undo all
    registry.set(undoAllOp, undefined);

    // History should be moved to future for potential redo
    const history = registry.get(historyAtom);
    expect((history.future as ReadonlyArray<unknown>).length).toBeGreaterThan(0);
  });
});

describe("addChangesOp", () => {
  test("adds multiple changes at once", () => {
    const registry = Registry.make();
    const changes = [
      PendingChange.make({ key: EnvKey.make("A"), fileIndex: FileIndex.make(0), oldValue: "a", newValue: "b" }),
      PendingChange.make({ key: EnvKey.make("B"), fileIndex: FileIndex.make(1), oldValue: "c", newValue: "d" }),
    ];

    registry.set(addChangesOp, changes);

    const pending = registry.get(pendingAtom);
    expect(pending.size).toBe(2);
    expect(pending.has("A:0")).toBe(true);
    expect(pending.has("B:1")).toBe(true);
  });
});

describe("setSelectionOp", () => {
  test("sets row and column", () => {
    const registry = Registry.make();

    registry.set(setSelectionOp, { row: 5, col: 2 });

    expect(registry.get(selectionAtom)).toEqual({ row: 5, col: 2 });
  });
});

describe("moveUpOp", () => {
  test("decrements row", () => {
    const registry = Registry.make();
    registry.set(selectionAtom, { row: 5, col: 0 });

    registry.set(moveUpOp, undefined);

    expect(registry.get(selectionAtom).row).toBe(4);
  });

  test("clamps to 0", () => {
    const registry = Registry.make();
    registry.set(selectionAtom, { row: 0, col: 0 });

    registry.set(moveUpOp, undefined);

    expect(registry.get(selectionAtom).row).toBe(0);
  });
});

describe("moveDownOp", () => {
  test("increments row", () => {
    const registry = Registry.make();
    // Need files to have rows for rowCount
    const files = [
      createFile(".env", { A: "1", B: "2", C: "3", D: "4", E: "5", F: "6", G: "7", H: "8", I: "9", J: "10" }),
    ];
    registry.set(filesAtom, files);
    registry.set(selectionAtom, { row: 0, col: 0 });

    registry.set(moveDownOp, undefined);

    expect(registry.get(selectionAtom).row).toBe(1);
  });

  test("clamps to rowCount - 1", () => {
    const registry = Registry.make();
    const files = [createFile(".env", { A: "1", B: "2", C: "3" })]; // 3 rows
    registry.set(filesAtom, files);
    registry.set(selectionAtom, { row: 2, col: 0 }); // At last row

    registry.set(moveDownOp, undefined);

    expect(registry.get(selectionAtom).row).toBe(2);
  });
});

describe("moveLeftOp", () => {
  test("decrements column", () => {
    const registry = Registry.make();
    registry.set(selectionAtom, { row: 0, col: 2 });

    registry.set(moveLeftOp, undefined);

    expect(registry.get(selectionAtom).col).toBe(1);
  });

  test("clamps to 0", () => {
    const registry = Registry.make();
    registry.set(selectionAtom, { row: 0, col: 0 });

    registry.set(moveLeftOp, undefined);

    expect(registry.get(selectionAtom).col).toBe(0);
  });
});

describe("moveRightOp", () => {
  test("increments column", () => {
    const registry = Registry.make();
    const files = [createFile(".env1", {}), createFile(".env2", {}), createFile(".env3", {})];
    registry.set(filesAtom, files);
    registry.set(selectionAtom, { row: 0, col: 0 });

    registry.set(moveRightOp, undefined);

    expect(registry.get(selectionAtom).col).toBe(1);
  });

  test("clamps to fileCount - 1", () => {
    const registry = Registry.make();
    const files = [createFile(".env1", {}), createFile(".env2", {}), createFile(".env3", {})];
    registry.set(filesAtom, files);
    registry.set(selectionAtom, { row: 0, col: 2 }); // At last column

    registry.set(moveRightOp, undefined);

    expect(registry.get(selectionAtom).col).toBe(2);
  });
});

describe("cycleColumnOp", () => {
  test("cycles through columns", () => {
    const registry = Registry.make();
    const files = [createFile(".env1", {}), createFile(".env2", {}), createFile(".env3", {})];
    registry.set(filesAtom, files);
    registry.set(selectionAtom, { row: 0, col: 0 });

    registry.set(cycleColumnOp, undefined);
    expect(registry.get(selectionAtom).col).toBe(1);

    registry.set(cycleColumnOp, undefined);
    expect(registry.get(selectionAtom).col).toBe(2);

    registry.set(cycleColumnOp, undefined);
    expect(registry.get(selectionAtom).col).toBe(0); // wraps around
  });
});

describe("enterEditModeOp", () => {
  test("enters value edit with current value", () => {
    const registry = Registry.make();

    registry.set(enterEditModeOp, "current value");

    const mode = registry.get(appModeAtom);
    expect(mode._tag).toBe("Edit");
    if (mode._tag === "Edit") {
      expect(mode.phase).toBe("editValue");
      expect(mode.value).toBe("current value");
      expect(mode.dirty).toBe(false);
    }
  });
});

describe("enterAddModeOp", () => {
  test("enters add key mode", () => {
    const registry = Registry.make();

    registry.set(enterAddModeOp, undefined);

    const mode = registry.get(appModeAtom);
    expect(mode._tag).toBe("Edit");
    if (mode._tag === "Edit") {
      expect(mode.phase).toBe("addKey");
      expect(mode.value).toBe("");
      expect(mode.dirty).toBe(false);
      expect(mode.isNewRow).toBe(true);
    }
  });
});

describe("updateEditInputOp", () => {
  test("updates input and sets dirty flag", () => {
    const registry = Registry.make();
    registry.set(enterEditModeOp, "initial");

    registry.set(updateEditInputOp, "modified");

    const editMode = registry.get(editModeAtom);
    expect(editMode?.value).toBe("modified");
    expect(editMode?.dirty).toBe(true);
  });

  test("no-op when not in edit mode", () => {
    const registry = Registry.make();

    registry.set(updateEditInputOp, "value");

    expect(registry.get(editModeAtom)).toBeNull();
  });
});

describe("exitEditModeOp", () => {
  test("clears edit mode", () => {
    const registry = Registry.make();
    registry.set(enterEditModeOp, "value");

    registry.set(exitEditModeOp, undefined);

    expect(registry.get(editModeAtom)).toBeNull();
    expect(registry.get(appModeAtom)._tag).toBe("Normal");
  });
});

describe("setClipboardOp", () => {
  test("stores key/value", () => {
    const registry = Registry.make();

    registry.set(setClipboardOp, Clipboard.make({ key: EnvKey.make("MY_KEY"), value: "my_value" }));

    expect(registry.get(clipboardAtom)).toEqual(Clipboard.make({ key: EnvKey.make("MY_KEY"), value: "my_value" }));
  });
});

describe("enterSearchModeOp / closeSearchOp", () => {
  test("toggles search state", () => {
    const registry = Registry.make();

    registry.set(enterSearchModeOp, undefined);
    expect(registry.get(appModeAtom)._tag).toBe("Search");
    const searchMode = registry.get(appModeAtom);
    if (searchMode._tag === "Search") {
      expect(searchMode.query).toBe("");
    }

    registry.set(closeSearchOp, undefined);
    expect(registry.get(appModeAtom)._tag).toBe("Normal");
  });
});

describe("setSearchQueryOp", () => {
  test("updates query", () => {
    const registry = Registry.make();
    registry.set(enterSearchModeOp, undefined);

    registry.set(setSearchQueryOp, "search term");

    const mode = registry.get(appModeAtom);
    expect(mode._tag).toBe("Search");
    if (mode._tag === "Search") {
      expect(mode.query).toBe("search term");
    }
  });
});

describe("openModalOp / closeModalOp", () => {
  test("modal state management", () => {
    const registry = Registry.make();

    registry.set(openModalOp, "quit");
    const mode = registry.get(appModeAtom);
    expect(mode._tag).toBe("Modal");
    if (mode._tag === "Modal") {
      expect(mode.modalType).toBe("quit");
    }

    registry.set(closeModalOp, undefined);
    expect(registry.get(appModeAtom)._tag).toBe("Normal");
  });
});

describe("setMessageOp", () => {
  test("sets message", () => {
    const registry = Registry.make();

    registry.set(setMessageOp, "Hello!");

    expect(registry.get(messageAtom)).toBe("Hello!");
  });

  test("clears message with null", () => {
    const registry = Registry.make();
    registry.set(messageAtom, "Old message");

    registry.set(setMessageOp, null);

    expect(registry.get(messageAtom)).toBeNull();
  });
});

describe("setColWidthsOp", () => {
  test("stores column widths", () => {
    const registry = Registry.make();

    registry.set(setColWidthsOp, [20, 30, 40]);

    expect(registry.get(colWidthsAtom)).toEqual([20, 30, 40]);
  });
});

describe("updateFileFromDiskOp", () => {
  test("updates file variables", () => {
    const registry = Registry.make();
    const files = [createFile(".env", { OLD_KEY: "old_value" })];
    registry.set(filesAtom, files);

    const newVars = new Map([["NEW_KEY", "new_value"]]);
    registry.set(updateFileFromDiskOp, { fileIndex: FileIndex.make(0), newVariables: newVars });

    const updatedFiles = registry.get(filesAtom);
    expect(updatedFiles[0]?.variables.get("NEW_KEY")).toBe("new_value");
    expect(updatedFiles[0]?.variables.has("OLD_KEY")).toBe(false);
  });

  test("detects conflicts when disk value differs from oldValue", () => {
    const registry = Registry.make();
    const files = [createFile(".env", { MY_VAR: "original" })];
    const pending = new Map([
      [
        "MY_VAR:0",
        PendingChange.make({
          key: EnvKey.make("MY_VAR"),
          fileIndex: FileIndex.make(0),
          oldValue: "original",
          newValue: "pending",
        }),
      ],
    ]);
    registry.set(filesAtom, files);
    registry.set(pendingAtom, pending);

    // Disk changes to different value
    const newVars = new Map([["MY_VAR", "changed_on_disk"]]);
    registry.set(updateFileFromDiskOp, { fileIndex: FileIndex.make(0), newVariables: newVars });

    expect(registry.get(conflictsAtom).has("MY_VAR:0")).toBe(true);
  });

  test("clears conflict when disk value matches oldValue again", () => {
    const registry = Registry.make();
    const files = [createFile(".env", { MY_VAR: "changed" })];
    const pending = new Map([
      [
        "MY_VAR:0",
        PendingChange.make({
          key: EnvKey.make("MY_VAR"),
          fileIndex: FileIndex.make(0),
          oldValue: "original",
          newValue: "pending",
        }),
      ],
    ]);
    const conflicts = new Set(["MY_VAR:0"]);
    registry.set(filesAtom, files);
    registry.set(pendingAtom, pending);
    registry.set(conflictsAtom, conflicts);

    // Disk reverts to original
    const newVars = new Map([["MY_VAR", "original"]]);
    registry.set(updateFileFromDiskOp, { fileIndex: FileIndex.make(0), newVariables: newVars });

    expect(registry.get(conflictsAtom).has("MY_VAR:0")).toBe(false);
  });

  test("no-op for invalid file index", () => {
    const registry = Registry.make();

    registry.set(updateFileFromDiskOp, { fileIndex: FileIndex.make(99), newVariables: new Map() });

    // Should not throw, files should remain empty
    expect(registry.get(filesAtom)).toEqual([]);
  });
});

describe("deleteVariableActionOp", () => {
  test("marks existing variable for deletion", () => {
    const registry = Registry.make();
    const files = [createFile(".env", { FOO: "bar", BAR: "baz" })];
    registry.set(filesAtom, files);
    registry.set(selectionAtom, { row: 0, col: 0 }); // Select first row (BAR alphabetically)

    registry.set(deleteVariableActionOp, undefined);

    const pending = registry.get(pendingAtom);
    expect(pending.size).toBe(1);
    // BAR comes first alphabetically
    const change = pending.get("BAR:0");
    expect(change).toBeDefined();
    expect(change!.newValue).toBe(null);
    expect(change!.oldValue).toBe("baz");
  });

  test("reverts pending addition when deleting newly-added key", () => {
    const registry = Registry.make();
    const files = [createFile(".env", { EXISTING: "value" })];
    registry.set(filesAtom, files);

    // Simulate adding a new key (doesn't exist on disk, only in pending)
    const pending = new Map([
      [
        "NEW_KEY:0",
        PendingChange.make({
          key: EnvKey.make("NEW_KEY"),
          fileIndex: FileIndex.make(0),
          oldValue: null, // Key didn't exist on disk
          newValue: "new_value",
        }),
      ],
    ]);
    registry.set(pendingAtom, pending);
    registry.set(selectionAtom, { row: 1, col: 0 }); // Select NEW_KEY (row 1 alphabetically after EXISTING)

    registry.set(deleteVariableActionOp, undefined);

    // The pending change should be REMOVED (not turned into a delete)
    const newPending = registry.get(pendingAtom);
    expect(newPending.size).toBe(0);
    expect(registry.get(messageAtom)).toBe("↩ Reverted to missing");
  });

  test("BUG: selection becomes out of bounds after deleting newly-added row", () => {
    const registry = Registry.make();
    // Two existing keys: A and C
    const files = [createFile(".env", { A_KEY: "a", C_KEY: "c" })];
    registry.set(filesAtom, files);

    // Add a pending change for a new key B (alphabetically between A and C)
    const pending = new Map([
      [
        "B_KEY:0",
        PendingChange.make({
          key: EnvKey.make("B_KEY"),
          fileIndex: FileIndex.make(0),
          oldValue: null,
          newValue: "b",
        }),
      ],
    ]);
    registry.set(pendingAtom, pending);

    // Now rows are: A_KEY (0), B_KEY (1), C_KEY (2) - 3 rows total
    // Select B_KEY (row 1)
    registry.set(selectionAtom, { row: 1, col: 0 });

    // Delete B_KEY - since originalValue is null, this removes the pending change
    registry.set(deleteVariableActionOp, undefined);

    // Pending should now be empty
    expect(registry.get(pendingAtom).size).toBe(0);

    // Now rows are: A_KEY (0), C_KEY (1) - only 2 rows!
    // Selection is still at row 1, which should now point to C_KEY
    const selection = registry.get(selectionAtom);
    expect(selection.row).toBe(1); // Still at row 1
    expect(selection.col).toBe(0);

    // Check if we can still delete - this should work for C_KEY
    registry.set(deleteVariableActionOp, undefined);

    // We should now have a pending deletion for C_KEY
    const finalPending = registry.get(pendingAtom);
    expect(finalPending.size).toBe(1);
    expect(finalPending.has("C_KEY:0")).toBe(true);
    expect(finalPending.get("C_KEY:0")!.newValue).toBe(null);
  });

  test("BUG: deleting 3 edited values results in only 2 deletions when one was newly added", () => {
    const registry = Registry.make();
    // Two existing keys
    const files = [createFile(".env", { KEY_A: "a", KEY_B: "b" })];
    registry.set(filesAtom, files);

    // Simulate: user edited KEY_A, added NEW_KEY, edited KEY_B
    const pending = new Map([
      [
        "KEY_A:0",
        PendingChange.make({
          key: EnvKey.make("KEY_A"),
          fileIndex: FileIndex.make(0),
          oldValue: "a",
          newValue: "edited_a",
        }),
      ],
      [
        "KEY_B:0",
        PendingChange.make({
          key: EnvKey.make("KEY_B"),
          fileIndex: FileIndex.make(0),
          oldValue: "b",
          newValue: "edited_b",
        }),
      ],
      [
        "NEW_KEY:0",
        PendingChange.make({
          key: EnvKey.make("NEW_KEY"),
          fileIndex: FileIndex.make(0),
          oldValue: null, // Didn't exist on disk
          newValue: "new_value",
        }),
      ],
    ]);
    registry.set(pendingAtom, pending);

    // Rows are now: KEY_A (0), KEY_B (1), NEW_KEY (2) - 3 rows
    // Delete KEY_A (row 0)
    registry.set(selectionAtom, { row: 0, col: 0 });
    registry.set(deleteVariableActionOp, undefined);
    expect(registry.get(pendingAtom).get("KEY_A:0")?.newValue).toBe(null);

    // Delete KEY_B (row 1)
    registry.set(selectionAtom, { row: 1, col: 0 });
    registry.set(deleteVariableActionOp, undefined);
    expect(registry.get(pendingAtom).get("KEY_B:0")?.newValue).toBe(null);

    // Delete NEW_KEY (row 2)
    registry.set(selectionAtom, { row: 2, col: 0 });
    registry.set(deleteVariableActionOp, undefined);
    // NEW_KEY should be REMOVED from pending (not turned into a delete)
    expect(registry.get(pendingAtom).has("NEW_KEY:0")).toBe(false);

    // Final state: 2 deletions (KEY_A and KEY_B)
    const finalPending = registry.get(pendingAtom);
    expect(finalPending.size).toBe(2);
    expect(finalPending.get("KEY_A:0")?.newValue).toBe(null);
    expect(finalPending.get("KEY_B:0")?.newValue).toBe(null);

    // This IS correct behavior! If you add a new key and then delete it,
    // there's nothing to delete on disk. Only 2 changes will be saved.
  });

  test("deleting 3 edited EXISTING values results in 3 deletions", () => {
    const registry = Registry.make();
    // Three existing keys on disk
    const files = [createFile(".env", { KEY_A: "a", KEY_B: "b", KEY_C: "c" })];
    registry.set(filesAtom, files);

    // Simulate: user edited all three values
    const pending = new Map([
      [
        "KEY_A:0",
        PendingChange.make({
          key: EnvKey.make("KEY_A"),
          fileIndex: FileIndex.make(0),
          oldValue: "a",
          newValue: "edited_a",
        }),
      ],
      [
        "KEY_B:0",
        PendingChange.make({
          key: EnvKey.make("KEY_B"),
          fileIndex: FileIndex.make(0),
          oldValue: "b",
          newValue: "edited_b",
        }),
      ],
      [
        "KEY_C:0",
        PendingChange.make({
          key: EnvKey.make("KEY_C"),
          fileIndex: FileIndex.make(0),
          oldValue: "c",
          newValue: "edited_c",
        }),
      ],
    ]);
    registry.set(pendingAtom, pending);

    // Rows are: KEY_A (0), KEY_B (1), KEY_C (2)
    // Delete KEY_A (row 0)
    registry.set(selectionAtom, { row: 0, col: 0 });
    registry.set(deleteVariableActionOp, undefined);
    expect(registry.get(pendingAtom).get("KEY_A:0")?.newValue).toBe(null);

    // Delete KEY_B (row 1)
    registry.set(selectionAtom, { row: 1, col: 0 });
    registry.set(deleteVariableActionOp, undefined);
    expect(registry.get(pendingAtom).get("KEY_B:0")?.newValue).toBe(null);

    // Delete KEY_C (row 2)
    registry.set(selectionAtom, { row: 2, col: 0 });
    registry.set(deleteVariableActionOp, undefined);
    expect(registry.get(pendingAtom).get("KEY_C:0")?.newValue).toBe(null);

    // Final state: 3 deletions
    const finalPending = registry.get(pendingAtom);
    expect(finalPending.size).toBe(3);
    expect(finalPending.get("KEY_A:0")?.newValue).toBe(null);
    expect(finalPending.get("KEY_B:0")?.newValue).toBe(null);
    expect(finalPending.get("KEY_C:0")?.newValue).toBe(null);
  });
});

// =============================================================================
// Comprehensive Undo/Redo Tests
// =============================================================================

describe("comprehensive undo/redo across all operations", () => {
  // Helper to set up a standard 2-file environment
  const setupTwoFiles = () => {
    const registry = Registry.make();
    const files = [
      createFile(".env.local", { API_KEY: "local_key", DB_HOST: "localhost" }),
      createFile(".env.prod", { API_KEY: "prod_key", DB_HOST: "prod.db.com" }),
    ];
    registry.set(filesAtom, files);
    registry.set(selectionAtom, { row: 0, col: 0 }); // API_KEY, file 0
    return registry;
  };

  describe("single operation undo", () => {
    test("undo after upsertChangeOp restores empty pending", () => {
      const registry = setupTwoFiles();

      // Make a change
      registry.set(recordHistoryOp, undefined);
      registry.set(upsertChangeOp, {
        key: EnvKey.make("API_KEY"),
        fileIndex: FileIndex.make(0),
        oldValue: "local_key",
        newValue: "new_key",
      });
      expect(registry.get(pendingAtom).size).toBe(1);
      expect(registry.get(canUndoAtom)).toBe(true);

      // Undo
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
      expect(registry.get(canRedoAtom)).toBe(true);
    });

    test("undo after deleteVariableActionOp restores pending state", () => {
      const registry = setupTwoFiles();
      registry.set(selectionAtom, { row: 0, col: 0 }); // API_KEY

      // Delete
      registry.set(deleteVariableActionOp, undefined);
      expect(registry.get(pendingAtom).get("API_KEY:0")?.newValue).toBe(null);

      // Undo
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
    });

    test("undo after pasteActionOp restores previous state", () => {
      const registry = setupTwoFiles();

      // Copy a value first
      registry.set(
        setClipboardOp,
        Clipboard.make({
          key: EnvKey.make("API_KEY"),
          value: "copied_value",
        }),
      );

      // Paste
      registry.set(pasteActionOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(1);

      // Undo
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
    });

    test("undo after syncToRightActionOp restores state", () => {
      const registry = setupTwoFiles();
      registry.set(selectionAtom, { row: 0, col: 0 }); // API_KEY, left file

      // Sync right (copy left value to right)
      registry.set(syncToRightActionOp, undefined);
      expect(registry.get(pendingAtom).get("API_KEY:1")?.newValue).toBe("local_key");

      // Undo
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
    });

    test("undo after syncToLeftActionOp restores state", () => {
      const registry = setupTwoFiles();
      registry.set(selectionAtom, { row: 0, col: 1 }); // API_KEY, right file

      // Sync left (copy right value to left)
      registry.set(syncToLeftActionOp, undefined);
      expect(registry.get(pendingAtom).get("API_KEY:0")?.newValue).toBe("prod_key");

      // Undo
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
    });

    test("undo after deleteAllActionOp restores state", () => {
      const registry = setupTwoFiles();
      registry.set(selectionAtom, { row: 0, col: 0 }); // API_KEY

      // Delete all (both files)
      registry.set(deleteAllActionOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(2);

      // Undo
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
    });

    test("undo after revertActionOp restores the pending change", () => {
      const registry = setupTwoFiles();

      // First create a pending change
      registry.set(recordHistoryOp, undefined);
      registry.set(upsertChangeOp, {
        key: EnvKey.make("API_KEY"),
        fileIndex: FileIndex.make(0),
        oldValue: "local_key",
        newValue: "edited",
      });
      expect(registry.get(pendingAtom).size).toBe(1);

      // Revert it (this should also record history)
      registry.set(selectionAtom, { row: 0, col: 0 });
      registry.set(revertActionOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);

      // Undo the revert - should restore the pending change
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(1);
      expect(registry.get(pendingAtom).get("API_KEY:0")?.newValue).toBe("edited");
    });
  });

  describe("multiple operations undo sequence", () => {
    test("undo 3 deletes one by one", () => {
      const registry = Registry.make();
      const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
      registry.set(filesAtom, files);

      // Delete A (row 0)
      registry.set(selectionAtom, { row: 0, col: 0 });
      registry.set(deleteVariableActionOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(1);

      // Delete B (row 1)
      registry.set(selectionAtom, { row: 1, col: 0 });
      registry.set(deleteVariableActionOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(2);

      // Delete C (row 2)
      registry.set(selectionAtom, { row: 2, col: 0 });
      registry.set(deleteVariableActionOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(3);

      // Undo C
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(2);
      expect(registry.get(pendingAtom).has("C:0")).toBe(false);

      // Undo B
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(1);
      expect(registry.get(pendingAtom).has("B:0")).toBe(false);

      // Undo A
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
    });

    test("undo mixed operations: edit, delete, paste", () => {
      const registry = Registry.make();
      const files = [createFile(".env", { FOO: "foo", BAR: "bar" })];
      registry.set(filesAtom, files);

      // 1. Edit FOO
      registry.set(recordHistoryOp, undefined);
      registry.set(upsertChangeOp, {
        key: EnvKey.make("FOO"),
        fileIndex: FileIndex.make(0),
        oldValue: "foo",
        newValue: "edited_foo",
      });
      expect(registry.get(pendingAtom).size).toBe(1);

      // 2. Delete BAR
      registry.set(selectionAtom, { row: 0, col: 0 }); // BAR is first alphabetically
      registry.set(deleteVariableActionOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(2);

      // 3. Paste something
      registry.set(
        setClipboardOp,
        Clipboard.make({
          key: EnvKey.make("BAR"),
          value: "pasted_bar",
        }),
      );
      registry.set(pasteActionOp, undefined);
      // Now BAR has newValue: "pasted_bar" (overwriting the deletion)
      expect(registry.get(pendingAtom).get("BAR:0")?.newValue).toBe("pasted_bar");

      // Undo paste - should restore BAR deletion
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).get("BAR:0")?.newValue).toBe(null);

      // Undo delete - should remove BAR from pending
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).has("BAR:0")).toBe(false);
      expect(registry.get(pendingAtom).size).toBe(1); // Only FOO edit remains

      // Undo edit - should clear pending
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
    });

    test("undo/redo interleaved", () => {
      const registry = Registry.make();
      const files = [createFile(".env", { X: "x", Y: "y" })];
      registry.set(filesAtom, files);

      // Edit X
      registry.set(recordHistoryOp, undefined);
      registry.set(upsertChangeOp, {
        key: EnvKey.make("X"),
        fileIndex: FileIndex.make(0),
        oldValue: "x",
        newValue: "x1",
      });

      // Edit Y
      registry.set(recordHistoryOp, undefined);
      registry.set(upsertChangeOp, {
        key: EnvKey.make("Y"),
        fileIndex: FileIndex.make(0),
        oldValue: "y",
        newValue: "y1",
      });

      expect(registry.get(pendingAtom).size).toBe(2);

      // Undo Y
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(1);
      expect(registry.get(pendingAtom).has("Y:0")).toBe(false);

      // Redo Y
      registry.set(redoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(2);
      expect(registry.get(pendingAtom).get("Y:0")?.newValue).toBe("y1");

      // Undo Y again
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(1);

      // Edit Z (new operation should clear redo stack)
      registry.set(recordHistoryOp, undefined);
      registry.set(upsertChangeOp, {
        key: EnvKey.make("Z"),
        fileIndex: FileIndex.make(0),
        oldValue: null,
        newValue: "z1",
      });

      // Redo should no longer work (Z operation cleared future)
      expect(registry.get(canRedoAtom)).toBe(false);
      registry.set(redoOp, undefined);
      expect(registry.get(messageAtom)).toBe("⚠ Nothing to redo");
    });

    test("edit same cell 5 times, undo each step", () => {
      const registry = Registry.make();
      const files = [createFile(".env", { KEY: "original" })];
      registry.set(filesAtom, files);

      const values = ["v1", "v2", "v3", "v4", "v5"];

      // Make 5 edits to the same key
      for (const val of values) {
        registry.set(recordHistoryOp, undefined);
        registry.set(upsertChangeOp, {
          key: EnvKey.make("KEY"),
          fileIndex: FileIndex.make(0),
          oldValue: "original",
          newValue: val,
        });
      }

      expect(registry.get(pendingAtom).get("KEY:0")?.newValue).toBe("v5");

      // Undo 5 times
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).get("KEY:0")?.newValue).toBe("v4");

      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).get("KEY:0")?.newValue).toBe("v3");

      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).get("KEY:0")?.newValue).toBe("v2");

      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).get("KEY:0")?.newValue).toBe("v1");

      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);

      // No more undo
      expect(registry.get(canUndoAtom)).toBe(false);
    });
  });

  describe("undoAllOp behavior", () => {
    test("undoAll clears all pending and enables redo to restore", () => {
      const registry = Registry.make();
      const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
      registry.set(filesAtom, files);

      // Make 3 changes
      for (const key of ["A", "B", "C"]) {
        registry.set(recordHistoryOp, undefined);
        registry.set(upsertChangeOp, {
          key: EnvKey.make(key),
          fileIndex: FileIndex.make(0),
          oldValue: key === "A" ? "1" : key === "B" ? "2" : "3",
          newValue: `edited_${key}`,
        });
      }
      expect(registry.get(pendingAtom).size).toBe(3);

      // Undo all
      registry.set(undoAllOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
      expect(registry.get(canRedoAtom)).toBe(true);

      // Redo should restore one step at a time
      registry.set(redoOp, undefined);
      expect(registry.get(pendingAtom).size).toBeGreaterThan(0);
    });
  });

  describe("sync operations undo", () => {
    test("sync right then undo restores right file state", () => {
      const registry = setupTwoFiles();
      // API_KEY: local_key (left) vs prod_key (right)
      registry.set(selectionAtom, { row: 0, col: 0 });

      // Sync right
      registry.set(syncToRightActionOp, undefined);
      expect(registry.get(pendingAtom).get("API_KEY:1")?.newValue).toBe("local_key");

      // Sync right again on DB_HOST
      registry.set(selectionAtom, { row: 1, col: 0 }); // DB_HOST
      registry.set(syncToRightActionOp, undefined);
      expect(registry.get(pendingAtom).get("DB_HOST:1")?.newValue).toBe("localhost");
      expect(registry.get(pendingAtom).size).toBe(2);

      // Undo DB_HOST sync
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(1);
      expect(registry.get(pendingAtom).has("DB_HOST:1")).toBe(false);

      // Undo API_KEY sync
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
    });
  });

  describe("pasteAll undo", () => {
    test("pasteAll to all files then undo", () => {
      const registry = setupTwoFiles();
      registry.set(selectionAtom, { row: 0, col: 0 }); // API_KEY

      // Set clipboard
      registry.set(
        setClipboardOp,
        Clipboard.make({
          key: EnvKey.make("API_KEY"),
          value: "unified_key",
        }),
      );

      // Paste all
      registry.set(pasteAllActionOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(2);
      expect(registry.get(pendingAtom).get("API_KEY:0")?.newValue).toBe("unified_key");
      expect(registry.get(pendingAtom).get("API_KEY:1")?.newValue).toBe("unified_key");

      // Undo
      registry.set(undoOp, undefined);
      expect(registry.get(pendingAtom).size).toBe(0);
    });
  });

  describe("history recording correctness", () => {
    test("deleteVariableActionOp records pre-change state to history", () => {
      const registry = Registry.make();
      const files = [createFile(".env", { FOO: "bar" })];
      registry.set(filesAtom, files);
      registry.set(selectionAtom, { row: 0, col: 0 });

      // Check initial history state
      const historyBefore = registry.get(historyAtom);
      expect(historyBefore.past.length).toBe(0);

      // Delete
      registry.set(deleteVariableActionOp, undefined);

      // Check pending has the deletion
      expect(registry.get(pendingAtom).size).toBe(1);
      expect(registry.get(pendingAtom).get("FOO:0")?.newValue).toBe(null);

      // Check history was recorded
      const historyAfter = registry.get(historyAtom);
      expect(historyAfter.past.length).toBe(1);

      // The past entry should have empty pending (state BEFORE delete)
      const pastEntry = historyAfter.past[0]!;
      expect(pastEntry.pending.size).toBe(0);
    });
  });

  describe("edge cases", () => {
    test("undo when nothing to undo shows message", () => {
      const registry = Registry.make();
      registry.set(filesAtom, [createFile(".env", { A: "1" })]);

      registry.set(undoOp, undefined);
      expect(registry.get(messageAtom)).toBe("⚠ Nothing to undo");
    });

    test("redo when nothing to redo shows message", () => {
      const registry = Registry.make();
      registry.set(filesAtom, [createFile(".env", { A: "1" })]);

      registry.set(redoOp, undefined);
      expect(registry.get(messageAtom)).toBe("⚠ Nothing to redo");
    });

    test("history is preserved across many operations", () => {
      const registry = Registry.make();
      const files = [createFile(".env", { K: "v" })];
      registry.set(filesAtom, files);

      // 10 operations
      for (let i = 0; i < 10; i++) {
        registry.set(recordHistoryOp, undefined);
        registry.set(upsertChangeOp, {
          key: EnvKey.make("K"),
          fileIndex: FileIndex.make(0),
          oldValue: "v",
          newValue: `v${i}`,
        });
      }

      // Undo all 10
      for (let i = 0; i < 10; i++) {
        expect(registry.get(canUndoAtom)).toBe(true);
        registry.set(undoOp, undefined);
      }

      expect(registry.get(pendingAtom).size).toBe(0);
      expect(registry.get(canUndoAtom)).toBe(false);

      // Redo all 10
      for (let i = 0; i < 10; i++) {
        expect(registry.get(canRedoAtom)).toBe(true);
        registry.set(redoOp, undefined);
      }

      expect(registry.get(pendingAtom).get("K:0")?.newValue).toBe("v9");
      expect(registry.get(canRedoAtom)).toBe(false);
    });
  });
});
