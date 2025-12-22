/**
 * Tests for state/appState.ts - derived atoms and state computations
 */
import { describe, expect, test } from "bun:test";
import { createStore } from "jotai";
import {
  appStateAtom,
  effectiveDiffRowsAtom,
  currentRowAtom,
  statsAtom,
  pendingListAtom,
  filteredRowIndicesAtom,
  fileCountAtom,
  rowCountAtom,
  pendingKey,
  initialAppState,
  type AppState,
} from "../../src/state/appState.js";
import type { EnvFile, PendingChange } from "../../src/types.js";

// Helper to create EnvFile
const createFile = (path: string, vars: Record<string, string>): EnvFile => ({
  path,
  filename: path.split("/").pop() ?? path,
  variables: new Map(Object.entries(vars)),
});

// Helper to create a store with initial state
const createTestStore = (stateOverrides: Partial<AppState> = {}) => {
  const store = createStore();
  store.set(appStateAtom, { ...initialAppState, ...stateOverrides });
  return store;
};

describe("pendingKey", () => {
  test("creates correct key format", () => {
    expect(pendingKey("MY_VAR", 0)).toBe("MY_VAR:0");
    expect(pendingKey("API_KEY", 2)).toBe("API_KEY:2");
    expect(pendingKey("TEST", 99)).toBe("TEST:99");
  });
});

describe("effectiveDiffRowsAtom", () => {
  test("returns empty array for no files", () => {
    const store = createTestStore();
    const rows = store.get(effectiveDiffRowsAtom);
    expect(rows).toEqual([]);
  });

  test("combines files to create rows", () => {
    const files = [
      createFile(".env.local", { KEY1: "val1", KEY2: "val2" }),
      createFile(".env.prod", { KEY1: "val1", KEY2: "different" }),
    ];
    const store = createTestStore({ files });
    const rows = store.get(effectiveDiffRowsAtom);

    expect(rows).toHaveLength(2);
  });

  test("includes new keys from pending changes", () => {
    const files = [createFile(".env", { EXISTING: "value" })];
    const pending = new Map<string, PendingChange>([
      ["NEW_KEY:0", { key: "NEW_KEY", fileIndex: 0, oldValue: null, newValue: "added" }],
    ]);
    const store = createTestStore({ files, pending });
    const rows = store.get(effectiveDiffRowsAtom);

    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.key === "NEW_KEY")).toBe(true);
  });

  test("shows pending values instead of original values", () => {
    const files = [createFile(".env", { MY_VAR: "original" })];
    const pending = new Map<string, PendingChange>([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "original", newValue: "modified" }],
    ]);
    const store = createTestStore({ files, pending });
    const rows = store.get(effectiveDiffRowsAtom);

    const row = rows.find((r) => r.key === "MY_VAR");
    expect(row?.values[0]).toBe("modified");
  });

  test("shows null for pending deletions", () => {
    const files = [createFile(".env", { TO_DELETE: "value" })];
    const pending = new Map<string, PendingChange>([
      ["TO_DELETE:0", { key: "TO_DELETE", fileIndex: 0, oldValue: "value", newValue: null }],
    ]);
    const store = createTestStore({ files, pending });
    const rows = store.get(effectiveDiffRowsAtom);

    const row = rows.find((r) => r.key === "TO_DELETE");
    expect(row?.values[0]).toBeNull();
  });

  test("sorts alphabetically by key", () => {
    const files = [createFile(".env", { ZEBRA: "z", APPLE: "a", MANGO: "m" })];
    const store = createTestStore({ files });
    const rows = store.get(effectiveDiffRowsAtom);

    expect(rows.map((r) => r.key)).toEqual(["APPLE", "MANGO", "ZEBRA"]);
  });
});

describe("currentRowAtom", () => {
  test("returns correct row based on selection", () => {
    const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
    const store = createTestStore({ files, selection: { row: 1, col: 0 } });
    const currentRow = store.get(currentRowAtom);

    // Rows are sorted: A, B, C - so index 1 is B
    expect(currentRow?.key).toBe("B");
  });

  test("returns null when row index out of bounds", () => {
    const files = [createFile(".env", { KEY: "value" })];
    const store = createTestStore({ files, selection: { row: 99, col: 0 } });
    const currentRow = store.get(currentRowAtom);

    expect(currentRow).toBeNull();
  });

  test("returns null when no files", () => {
    const store = createTestStore({ selection: { row: 0, col: 0 } });
    const currentRow = store.get(currentRowAtom);

    expect(currentRow).toBeNull();
  });
});

describe("statsAtom", () => {
  test("counts rows by status", () => {
    const files = [
      createFile(".env.local", { IDENTICAL: "same", DIFFERENT: "val1", MISSING: "only_local" }),
      createFile(".env.prod", { IDENTICAL: "same", DIFFERENT: "val2" }),
    ];
    const store = createTestStore({ files });
    const stats = store.get(statsAtom);

    expect(stats.identical).toBe(1);
    expect(stats.different).toBe(1);
    expect(stats.missing).toBe(1);
  });

  test("returns zeros for no files", () => {
    const store = createTestStore();
    const stats = store.get(statsAtom);

    expect(stats).toEqual({ identical: 0, different: 0, missing: 0 });
  });
});

describe("pendingListAtom", () => {
  test("converts pending Map to array", () => {
    const pending = new Map<string, PendingChange>([
      ["A:0", { key: "A", fileIndex: 0, oldValue: "a", newValue: "b" }],
      ["B:1", { key: "B", fileIndex: 1, oldValue: "c", newValue: "d" }],
    ]);
    const store = createTestStore({ pending });
    const list = store.get(pendingListAtom);

    expect(list).toHaveLength(2);
    expect(list.some((c) => c.key === "A")).toBe(true);
    expect(list.some((c) => c.key === "B")).toBe(true);
  });

  test("returns empty array for no pending", () => {
    const store = createTestStore();
    const list = store.get(pendingListAtom);

    expect(list).toEqual([]);
  });
});

describe("filteredRowIndicesAtom", () => {
  test("returns all indices when search not active", () => {
    const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
    const store = createTestStore({ files, search: { active: false, query: "" } });
    const indices = store.get(filteredRowIndicesAtom);

    expect(indices).toEqual([0, 1, 2]);
  });

  test("returns all indices when search active but query empty", () => {
    const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
    const store = createTestStore({ files, search: { active: true, query: "" } });
    const indices = store.get(filteredRowIndicesAtom);

    expect(indices).toEqual([0, 1, 2]);
  });

  test("filters by query when search active", () => {
    const files = [createFile(".env", { API_KEY: "1", API_URL: "2", DB_HOST: "3" })];
    const store = createTestStore({ files, search: { active: true, query: "api" } });
    const indices = store.get(filteredRowIndicesAtom);

    // Sorted: API_KEY, API_URL, DB_HOST - indices 0, 1 match "api"
    expect(indices).toEqual([0, 1]);
  });

  test("search is case insensitive", () => {
    const files = [createFile(".env", { API_KEY: "1", api_url: "2", DB_HOST: "3" })];
    const store = createTestStore({ files, search: { active: true, query: "API" } });
    const indices = store.get(filteredRowIndicesAtom);

    // Both API_KEY and api_url match "API" case-insensitively
    expect(indices).toHaveLength(2);
  });

  test("returns empty array when no matches", () => {
    const files = [createFile(".env", { A: "1", B: "2" })];
    const store = createTestStore({ files, search: { active: true, query: "xyz" } });
    const indices = store.get(filteredRowIndicesAtom);

    expect(indices).toEqual([]);
  });
});

describe("fileCountAtom", () => {
  test("returns correct file count", () => {
    const files = [
      createFile(".env.local", {}),
      createFile(".env.prod", {}),
      createFile(".env.staging", {}),
    ];
    const store = createTestStore({ files });
    expect(store.get(fileCountAtom)).toBe(3);
  });

  test("returns 0 for no files", () => {
    const store = createTestStore();
    expect(store.get(fileCountAtom)).toBe(0);
  });
});

describe("rowCountAtom", () => {
  test("returns correct row count", () => {
    const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
    const store = createTestStore({ files });
    expect(store.get(rowCountAtom)).toBe(3);
  });

  test("returns 0 for no files", () => {
    const store = createTestStore();
    expect(store.get(rowCountAtom)).toBe(0);
  });

  test("includes rows from pending additions", () => {
    const files = [createFile(".env", { EXISTING: "val" })];
    const pending = new Map<string, PendingChange>([
      ["NEW:0", { key: "NEW", fileIndex: 0, oldValue: null, newValue: "added" }],
    ]);
    const store = createTestStore({ files, pending });
    expect(store.get(rowCountAtom)).toBe(2);
  });
});

