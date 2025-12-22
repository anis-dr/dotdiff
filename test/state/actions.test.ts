/**
 * Tests for state/actions.ts - pure state transition functions
 */
import { describe, expect, test } from "bun:test";
import * as A from "../../src/state/actions.js";
import { initialAppState, pendingKey, type AppState } from "../../src/state/appState.js";
import type { EnvFile, PendingChange } from "../../src/types.js";

// Helper to create a test state
const createState = (overrides: Partial<AppState> = {}): AppState => ({
  ...initialAppState,
  ...overrides,
});

// Helper to create a mock EnvFile
const createFile = (path: string, vars: Record<string, string>): EnvFile => ({
  path,
  filename: path.split("/").pop() ?? path,
  variables: new Map(Object.entries(vars)),
});

describe("pendingKey", () => {
  test("creates correct key format", () => {
    expect(pendingKey("MY_VAR", 0)).toBe("MY_VAR:0");
    expect(pendingKey("API_KEY", 2)).toBe("API_KEY:2");
  });
});

describe("setFiles", () => {
  test("sets files array", () => {
    const files = [createFile("/path/to/.env", { KEY: "value" })];
    const state = createState();
    const result = A.setFiles(state, files);
    expect(result.files).toEqual(files);
  });
});

describe("upsertChange", () => {
  test("adds new change", () => {
    const state = createState();
    const change: PendingChange = {
      key: "MY_VAR",
      fileIndex: 0,
      oldValue: "old",
      newValue: "new",
    };
    const result = A.upsertChange(state, change);
    expect(result.pending.size).toBe(1);
    expect(result.pending.get("MY_VAR:0")).toEqual(change);
  });

  test("updates existing change", () => {
    const change1: PendingChange = { key: "MY_VAR", fileIndex: 0, oldValue: "old", newValue: "new1" };
    const change2: PendingChange = { key: "MY_VAR", fileIndex: 0, oldValue: "old", newValue: "new2" };

    let state = createState();
    state = A.upsertChange(state, change1);
    state = A.upsertChange(state, change2);

    expect(state.pending.size).toBe(1);
    expect(state.pending.get("MY_VAR:0")?.newValue).toBe("new2");
  });
});

describe("removeChange", () => {
  test("removes existing change", () => {
    const change: PendingChange = { key: "MY_VAR", fileIndex: 0, oldValue: "old", newValue: "new" };
    let state = createState();
    state = A.upsertChange(state, change);
    state = A.removeChange(state, "MY_VAR", 0);
    expect(state.pending.size).toBe(0);
  });

  test("no-op for non-existent change", () => {
    const state = createState();
    const result = A.removeChange(state, "NONEXISTENT", 0);
    expect(result).toBe(state); // Same reference
  });

  test("also clears conflict", () => {
    const pending = new Map([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "old", newValue: "new" }],
    ]);
    const conflicts = new Set(["MY_VAR:0"]);
    const state = createState({ pending, conflicts });

    const result = A.removeChange(state, "MY_VAR", 0);
    expect(result.pending.size).toBe(0);
    expect(result.conflicts.size).toBe(0);
  });
});

describe("removeChangesForKey", () => {
  test("removes all changes for key", () => {
    const pending = new Map([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "a", newValue: "b" }],
      ["MY_VAR:1", { key: "MY_VAR", fileIndex: 1, oldValue: "c", newValue: "d" }],
      ["OTHER:0", { key: "OTHER", fileIndex: 0, oldValue: "e", newValue: "f" }],
    ]);
    const state = createState({ pending });

    const result = A.removeChangesForKey(state, "MY_VAR");
    expect(result.pending.size).toBe(1);
    expect(result.pending.has("OTHER:0")).toBe(true);
  });

  test("respects excludeFileIndex", () => {
    const pending = new Map([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "a", newValue: "b" }],
      ["MY_VAR:1", { key: "MY_VAR", fileIndex: 1, oldValue: "c", newValue: "d" }],
    ]);
    const state = createState({ pending });

    const result = A.removeChangesForKey(state, "MY_VAR", 1);
    expect(result.pending.size).toBe(1);
    expect(result.pending.has("MY_VAR:1")).toBe(true);
  });
});

describe("clearChanges", () => {
  test("clears all pending and conflicts", () => {
    const pending = new Map([
      ["A:0", { key: "A", fileIndex: 0, oldValue: "a", newValue: "b" }],
      ["B:1", { key: "B", fileIndex: 1, oldValue: "c", newValue: "d" }],
    ]);
    const conflicts = new Set(["A:0"]);
    const state = createState({ pending, conflicts });

    const result = A.clearChanges(state);
    expect(result.pending.size).toBe(0);
    expect(result.conflicts.size).toBe(0);
  });
});

describe("undoLast", () => {
  test("removes last change (LIFO)", () => {
    let state = createState();
    state = A.upsertChange(state, { key: "FIRST", fileIndex: 0, oldValue: "a", newValue: "b" });
    state = A.upsertChange(state, { key: "SECOND", fileIndex: 0, oldValue: "c", newValue: "d" });

    const { state: result, didUndo } = A.undoLast(state);
    expect(didUndo).toBe(true);
    expect(result.pending.size).toBe(1);
    expect(result.pending.has("FIRST:0")).toBe(true);
    expect(result.pending.has("SECOND:0")).toBe(false);
  });

  test("returns didUndo false for empty pending", () => {
    const state = createState();
    const { state: result, didUndo } = A.undoLast(state);
    expect(didUndo).toBe(false);
    expect(result).toBe(state);
  });
});

describe("findChange", () => {
  test("finds existing change", () => {
    const change: PendingChange = { key: "MY_VAR", fileIndex: 0, oldValue: "old", newValue: "new" };
    const state = A.upsertChange(createState(), change);

    const result = A.findChange(state, "MY_VAR", 0);
    expect(result).toEqual(change);
  });

  test("returns undefined when not found", () => {
    const state = createState();
    expect(A.findChange(state, "NONEXISTENT", 0)).toBeUndefined();
  });
});

describe("addChanges", () => {
  test("adds multiple changes at once", () => {
    const state = createState();
    const changes: PendingChange[] = [
      { key: "A", fileIndex: 0, oldValue: "a", newValue: "b" },
      { key: "B", fileIndex: 1, oldValue: "c", newValue: "d" },
    ];

    const result = A.addChanges(state, changes);
    expect(result.pending.size).toBe(2);
    expect(result.pending.has("A:0")).toBe(true);
    expect(result.pending.has("B:1")).toBe(true);
  });
});

describe("setSelection", () => {
  test("sets row and column", () => {
    const state = createState();
    const result = A.setSelection(state, 5, 2);
    expect(result.selection).toEqual({ row: 5, col: 2 });
  });
});

describe("moveUp", () => {
  test("decrements row", () => {
    const state = createState({ selection: { row: 5, col: 0 } });
    const result = A.moveUp(state);
    expect(result.selection.row).toBe(4);
  });

  test("clamps to 0", () => {
    const state = createState({ selection: { row: 0, col: 0 } });
    const result = A.moveUp(state);
    expect(result.selection.row).toBe(0);
  });
});

describe("moveDown", () => {
  test("increments row", () => {
    const state = createState({ selection: { row: 0, col: 0 } });
    const result = A.moveDown(state, 10);
    expect(result.selection.row).toBe(1);
  });

  test("clamps to rowCount - 1", () => {
    const state = createState({ selection: { row: 9, col: 0 } });
    const result = A.moveDown(state, 10);
    expect(result.selection.row).toBe(9);
  });
});

describe("moveLeft", () => {
  test("decrements column", () => {
    const state = createState({ selection: { row: 0, col: 2 } });
    const result = A.moveLeft(state);
    expect(result.selection.col).toBe(1);
  });

  test("clamps to 0", () => {
    const state = createState({ selection: { row: 0, col: 0 } });
    const result = A.moveLeft(state);
    expect(result.selection.col).toBe(0);
  });
});

describe("moveRight", () => {
  test("increments column", () => {
    const state = createState({ selection: { row: 0, col: 0 } });
    const result = A.moveRight(state, 3);
    expect(result.selection.col).toBe(1);
  });

  test("clamps to fileCount - 1", () => {
    const state = createState({ selection: { row: 0, col: 2 } });
    const result = A.moveRight(state, 3);
    expect(result.selection.col).toBe(2);
  });
});

describe("cycleColumn", () => {
  test("cycles through columns", () => {
    let state = createState({ selection: { row: 0, col: 0 } });
    state = A.cycleColumn(state, 3);
    expect(state.selection.col).toBe(1);
    state = A.cycleColumn(state, 3);
    expect(state.selection.col).toBe(2);
    state = A.cycleColumn(state, 3);
    expect(state.selection.col).toBe(0); // wraps around
  });
});

describe("enterEditMode", () => {
  test("enters value edit with current value", () => {
    const state = createState();
    const result = A.enterEditMode(state, "current value");
    expect(result.editMode).toEqual({
      phase: "editValue",
      inputValue: "current value",
      dirty: false,
    });
  });
});

describe("enterAddMode", () => {
  test("enters add key mode", () => {
    const state = createState();
    const result = A.enterAddMode(state);
    expect(result.editMode).toEqual({
      phase: "addKey",
      inputValue: "",
      isNewRow: true,
      dirty: false,
    });
  });
});

describe("updateEditInput", () => {
  test("updates input and sets dirty flag", () => {
    let state = createState();
    state = A.enterEditMode(state, "initial");
    state = A.updateEditInput(state, "modified");

    expect(state.editMode?.inputValue).toBe("modified");
    expect(state.editMode?.dirty).toBe(true);
  });

  test("no-op when not in edit mode", () => {
    const state = createState();
    const result = A.updateEditInput(state, "value");
    expect(result).toBe(state);
  });
});

describe("exitEditMode", () => {
  test("clears edit mode", () => {
    let state = createState();
    state = A.enterEditMode(state, "value");
    state = A.exitEditMode(state);
    expect(state.editMode).toBeNull();
  });
});

describe("setClipboard", () => {
  test("stores key/value", () => {
    const state = createState();
    const result = A.setClipboard(state, { key: "MY_KEY", value: "my_value" });
    expect(result.clipboard).toEqual({ key: "MY_KEY", value: "my_value" });
  });
});

describe("openSearch / closeSearch", () => {
  test("toggles search state", () => {
    let state = createState();

    state = A.openSearch(state);
    expect(state.search).toEqual({ active: true, query: "" });

    state = A.closeSearch(state);
    expect(state.search).toEqual({ active: false, query: "" });
  });
});

describe("setSearchQuery", () => {
  test("updates query", () => {
    let state = createState();
    state = A.openSearch(state);
    state = A.setSearchQuery(state, "search term");
    expect(state.search.query).toBe("search term");
  });
});

describe("openModal / closeModal", () => {
  test("modal state management", () => {
    let state = createState();

    state = A.openModal(state, { type: "quit" });
    expect(state.modal).toEqual({ type: "quit" });

    state = A.closeModal(state);
    expect(state.modal).toBeNull();
  });

  test("modal with data", () => {
    const state = createState();
    const result = A.openModal(state, { type: "save", data: { changes: 5 } });
    expect(result.modal).toEqual({ type: "save", data: { changes: 5 } });
  });
});

describe("setMessage", () => {
  test("sets message", () => {
    const state = createState();
    const result = A.setMessage(state, "Hello!");
    expect(result.message).toBe("Hello!");
  });

  test("clears message with null", () => {
    const state = createState({ message: "Old message" });
    const result = A.setMessage(state, null);
    expect(result.message).toBeNull();
  });
});

describe("setColWidths", () => {
  test("stores column widths", () => {
    const state = createState();
    const result = A.setColWidths(state, [20, 30, 40]);
    expect(result.colWidths).toEqual([20, 30, 40]);
  });
});

describe("getOriginalValue", () => {
  test("retrieves value from files", () => {
    const files = [createFile(".env", { MY_VAR: "my_value" })];
    const state = createState({ files });

    expect(A.getOriginalValue(state, "MY_VAR", 0)).toBe("my_value");
  });

  test("returns null for missing key", () => {
    const files = [createFile(".env", { OTHER: "value" })];
    const state = createState({ files });

    expect(A.getOriginalValue(state, "NONEXISTENT", 0)).toBeNull();
  });

  test("returns null for invalid file index", () => {
    const files = [createFile(".env", { KEY: "value" })];
    const state = createState({ files });

    expect(A.getOriginalValue(state, "KEY", 99)).toBeNull();
  });
});

describe("updateFileFromDisk", () => {
  test("updates file variables", () => {
    const files = [createFile(".env", { OLD_KEY: "old_value" })];
    const state = createState({ files });

    const newVars = new Map([["NEW_KEY", "new_value"]]);
    const result = A.updateFileFromDisk(state, 0, newVars);

    expect(result.files[0]?.variables.get("NEW_KEY")).toBe("new_value");
    expect(result.files[0]?.variables.has("OLD_KEY")).toBe(false);
  });

  test("detects conflicts when disk value differs from oldValue", () => {
    const files = [createFile(".env", { MY_VAR: "original" })];
    const pending = new Map([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "original", newValue: "pending" }],
    ]);
    const state = createState({ files, pending });

    // Disk changes to different value
    const newVars = new Map([["MY_VAR", "changed_on_disk"]]);
    const result = A.updateFileFromDisk(state, 0, newVars);

    expect(result.conflicts.has("MY_VAR:0")).toBe(true);
  });

  test("clears conflict when disk value matches oldValue again", () => {
    const files = [createFile(".env", { MY_VAR: "changed" })];
    const pending = new Map([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "original", newValue: "pending" }],
    ]);
    const conflicts = new Set(["MY_VAR:0"]);
    const state = createState({ files, pending, conflicts });

    // Disk reverts to original
    const newVars = new Map([["MY_VAR", "original"]]);
    const result = A.updateFileFromDisk(state, 0, newVars);

    expect(result.conflicts.has("MY_VAR:0")).toBe(false);
  });

  test("returns state unchanged for invalid file index", () => {
    const state = createState();
    const result = A.updateFileFromDisk(state, 0, new Map());
    expect(result).toBe(state);
  });
});

