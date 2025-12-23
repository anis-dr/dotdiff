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
  appModeAtom,
  clipboardAtom,
  colWidthsAtom,
  conflictsAtom,
  editModeAtom,
  filesAtom,
  messageAtom,
  pendingAtom,
  pendingKey,
  selectionAtom,
} from "../../src/state/appState.js";
import {
  addChangesOp,
  clearChangesOp,
  cycleColumnOp,
  moveDownOp,
  moveLeftOp,
  moveRightOp,
  moveUpOp,
  removeChangeOp,
  removeChangesForKeyOp,
  setClipboardOp,
  setColWidthsOp,
  setFilesOp,
  setMessageOp,
  setSelectionOp,
  undoLastOp,
  updateFileFromDiskOp,
  upsertChangeOp,
} from "../../src/state/atomicOps.js";
import {
  closeModalOp,
  closeSearchOp,
  enterAddModeOp,
  enterEditModeOp,
  enterSearchModeOp,
  exitEditModeOp,
  openModalOp,
  setSearchQueryOp,
  updateEditInputOp,
} from "../../src/state/keyboardDispatch.js";
import type { EnvFile, PendingChange } from "../../src/types.js";
import { FilePath } from "../../src/types.js";

// Helper to create a mock EnvFile
const createFile = (path: string, vars: Record<string, string>): EnvFile => ({
  path: FilePath.make(path),
  filename: path.split("/").pop() ?? path,
  variables: new Map(Object.entries(vars)),
});

describe("pendingKey", () => {
  test("creates correct key format", () => {
    expect(pendingKey("MY_VAR", 0)).toBe("MY_VAR:0");
    expect(pendingKey("API_KEY", 2)).toBe("API_KEY:2");
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
    const change: PendingChange = {
      key: "MY_VAR",
      fileIndex: 0,
      oldValue: "old",
      newValue: "new",
    };

    registry.set(upsertChangeOp, change);

    const pending = registry.get(pendingAtom);
    expect(pending.size).toBe(1);
    expect(pending.get("MY_VAR:0")).toEqual(change);
  });

  test("updates existing change", () => {
    const registry = Registry.make();
    const change1: PendingChange = { key: "MY_VAR", fileIndex: 0, oldValue: "old", newValue: "new1" };
    const change2: PendingChange = { key: "MY_VAR", fileIndex: 0, oldValue: "old", newValue: "new2" };

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
    const change: PendingChange = { key: "MY_VAR", fileIndex: 0, oldValue: "old", newValue: "new" };

    registry.set(upsertChangeOp, change);
    registry.set(removeChangeOp, { varKey: "MY_VAR", fileIndex: 0 });

    expect(registry.get(pendingAtom).size).toBe(0);
  });

  test("no-op for non-existent change", () => {
    const registry = Registry.make();

    registry.set(removeChangeOp, { varKey: "NONEXISTENT", fileIndex: 0 });

    expect(registry.get(pendingAtom).size).toBe(0);
  });

  test("also clears conflict", () => {
    const registry = Registry.make();
    const pending = new Map<string, PendingChange>([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "old", newValue: "new" }],
    ]);
    const conflicts = new Set(["MY_VAR:0"]);

    registry.set(pendingAtom, pending);
    registry.set(conflictsAtom, conflicts);
    registry.set(removeChangeOp, { varKey: "MY_VAR", fileIndex: 0 });

    expect(registry.get(pendingAtom).size).toBe(0);
    expect(registry.get(conflictsAtom).size).toBe(0);
  });
});

describe("removeChangesForKeyOp", () => {
  test("removes all changes for key", () => {
    const registry = Registry.make();
    const pending = new Map<string, PendingChange>([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "a", newValue: "b" }],
      ["MY_VAR:1", { key: "MY_VAR", fileIndex: 1, oldValue: "c", newValue: "d" }],
      ["OTHER:0", { key: "OTHER", fileIndex: 0, oldValue: "e", newValue: "f" }],
    ]);

    registry.set(pendingAtom, pending);
    registry.set(removeChangesForKeyOp, { varKey: "MY_VAR" });

    const result = registry.get(pendingAtom);
    expect(result.size).toBe(1);
    expect(result.has("OTHER:0")).toBe(true);
  });

  test("respects excludeFileIndex", () => {
    const registry = Registry.make();
    const pending = new Map<string, PendingChange>([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "a", newValue: "b" }],
      ["MY_VAR:1", { key: "MY_VAR", fileIndex: 1, oldValue: "c", newValue: "d" }],
    ]);

    registry.set(pendingAtom, pending);
    registry.set(removeChangesForKeyOp, { varKey: "MY_VAR", excludeFileIndex: 1 });

    const result = registry.get(pendingAtom);
    expect(result.size).toBe(1);
    expect(result.has("MY_VAR:1")).toBe(true);
  });
});

describe("clearChangesOp", () => {
  test("clears all pending and conflicts", () => {
    const registry = Registry.make();
    const pending = new Map<string, PendingChange>([
      ["A:0", { key: "A", fileIndex: 0, oldValue: "a", newValue: "b" }],
      ["B:1", { key: "B", fileIndex: 1, oldValue: "c", newValue: "d" }],
    ]);
    const conflicts = new Set(["A:0"]);

    registry.set(pendingAtom, pending);
    registry.set(conflictsAtom, conflicts);
    registry.set(clearChangesOp, undefined);

    expect(registry.get(pendingAtom).size).toBe(0);
    expect(registry.get(conflictsAtom).size).toBe(0);
  });
});

describe("undoLastOp", () => {
  test("removes last change (LIFO)", () => {
    const registry = Registry.make();

    registry.set(upsertChangeOp, { key: "FIRST", fileIndex: 0, oldValue: "a", newValue: "b" });
    registry.set(upsertChangeOp, { key: "SECOND", fileIndex: 0, oldValue: "c", newValue: "d" });
    registry.set(undoLastOp, undefined);

    const pending = registry.get(pendingAtom);
    expect(pending.size).toBe(1);
    expect(pending.has("FIRST:0")).toBe(true);
    expect(pending.has("SECOND:0")).toBe(false);
  });

  test("no-op for empty pending", () => {
    const registry = Registry.make();

    registry.set(undoLastOp, undefined);

    expect(registry.get(pendingAtom).size).toBe(0);
  });
});

describe("addChangesOp", () => {
  test("adds multiple changes at once", () => {
    const registry = Registry.make();
    const changes: Array<PendingChange> = [
      { key: "A", fileIndex: 0, oldValue: "a", newValue: "b" },
      { key: "B", fileIndex: 1, oldValue: "c", newValue: "d" },
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

    registry.set(setClipboardOp, { key: "MY_KEY", value: "my_value" });

    expect(registry.get(clipboardAtom)).toEqual({ key: "MY_KEY", value: "my_value" });
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
    registry.set(updateFileFromDiskOp, { fileIndex: 0, newVariables: newVars });

    const updatedFiles = registry.get(filesAtom);
    expect(updatedFiles[0]?.variables.get("NEW_KEY")).toBe("new_value");
    expect(updatedFiles[0]?.variables.has("OLD_KEY")).toBe(false);
  });

  test("detects conflicts when disk value differs from oldValue", () => {
    const registry = Registry.make();
    const files = [createFile(".env", { MY_VAR: "original" })];
    const pending = new Map<string, PendingChange>([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "original", newValue: "pending" }],
    ]);
    registry.set(filesAtom, files);
    registry.set(pendingAtom, pending);

    // Disk changes to different value
    const newVars = new Map([["MY_VAR", "changed_on_disk"]]);
    registry.set(updateFileFromDiskOp, { fileIndex: 0, newVariables: newVars });

    expect(registry.get(conflictsAtom).has("MY_VAR:0")).toBe(true);
  });

  test("clears conflict when disk value matches oldValue again", () => {
    const registry = Registry.make();
    const files = [createFile(".env", { MY_VAR: "changed" })];
    const pending = new Map<string, PendingChange>([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "original", newValue: "pending" }],
    ]);
    const conflicts = new Set(["MY_VAR:0"]);
    registry.set(filesAtom, files);
    registry.set(pendingAtom, pending);
    registry.set(conflictsAtom, conflicts);

    // Disk reverts to original
    const newVars = new Map([["MY_VAR", "original"]]);
    registry.set(updateFileFromDiskOp, { fileIndex: 0, newVariables: newVars });

    expect(registry.get(conflictsAtom).has("MY_VAR:0")).toBe(false);
  });

  test("no-op for invalid file index", () => {
    const registry = Registry.make();

    registry.set(updateFileFromDiskOp, { fileIndex: 99, newVariables: new Map() });

    // Should not throw, files should remain empty
    expect(registry.get(filesAtom)).toEqual([]);
  });
});
