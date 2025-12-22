/**
 * Tests for state/appState.ts - derived atoms and state computations
 */
import { describe, expect, test } from "bun:test";
import { Registry } from "@effect-atom/atom-react";
import {
  filesAtom,
  pendingAtom,
  selectionAtom,
  searchAtom,
  effectiveDiffRowsAtom,
  currentRowAtom,
  statsAtom,
  pendingListAtom,
  filteredRowIndicesAtom,
  fileCountAtom,
  rowCountAtom,
  pendingKey,
} from "../../src/state/appState.js";
import type { EnvFile, PendingChange, SearchState } from "../../src/types.js";
import { FilePath } from "../../src/types.js";

// Helper to create EnvFile
const createFile = (path: string, vars: Record<string, string>): EnvFile => ({
  path: FilePath.make(path),
  filename: path.split("/").pop() ?? path,
  variables: new Map(Object.entries(vars)),
});

interface TestState {
  files?: ReadonlyArray<EnvFile>;
  pending?: ReadonlyMap<string, PendingChange>;
  selection?: { readonly row: number; readonly col: number };
  search?: SearchState;
}

// Helper to create a registry with initial state
const createTestRegistry = (stateOverrides: TestState = {}) => {
  const registry = Registry.make();
  if (stateOverrides.files) registry.set(filesAtom, stateOverrides.files);
  if (stateOverrides.pending) registry.set(pendingAtom, stateOverrides.pending);
  if (stateOverrides.selection) registry.set(selectionAtom, stateOverrides.selection);
  if (stateOverrides.search) registry.set(searchAtom, stateOverrides.search);
  return registry;
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
    const registry = createTestRegistry();
    const rows = registry.get(effectiveDiffRowsAtom);
    expect(rows).toEqual([]);
  });

  test("combines files to create rows", () => {
    const files = [
      createFile(".env.local", { KEY1: "val1", KEY2: "val2" }),
      createFile(".env.prod", { KEY1: "val1", KEY2: "different" }),
    ];
    const registry = createTestRegistry({ files });
    const rows = registry.get(effectiveDiffRowsAtom);

    expect(rows).toHaveLength(2);
  });

  test("includes new keys from pending changes", () => {
    const files = [createFile(".env", { EXISTING: "value" })];
    const pending = new Map<string, PendingChange>([
      ["NEW_KEY:0", { key: "NEW_KEY", fileIndex: 0, oldValue: null, newValue: "added" }],
    ]);
    const registry = createTestRegistry({ files, pending });
    const rows = registry.get(effectiveDiffRowsAtom);

    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.key === "NEW_KEY")).toBe(true);
  });

  test("shows pending values instead of original values", () => {
    const files = [createFile(".env", { MY_VAR: "original" })];
    const pending = new Map<string, PendingChange>([
      ["MY_VAR:0", { key: "MY_VAR", fileIndex: 0, oldValue: "original", newValue: "modified" }],
    ]);
    const registry = createTestRegistry({ files, pending });
    const rows = registry.get(effectiveDiffRowsAtom);

    const row = rows.find((r) => r.key === "MY_VAR");
    expect(row?.values[0]).toBe("modified");
  });

  test("shows null for pending deletions", () => {
    const files = [createFile(".env", { TO_DELETE: "value" })];
    const pending = new Map<string, PendingChange>([
      ["TO_DELETE:0", { key: "TO_DELETE", fileIndex: 0, oldValue: "value", newValue: null }],
    ]);
    const registry = createTestRegistry({ files, pending });
    const rows = registry.get(effectiveDiffRowsAtom);

    const row = rows.find((r) => r.key === "TO_DELETE");
    expect(row?.values[0]).toBeNull();
  });

  test("sorts alphabetically by key", () => {
    const files = [createFile(".env", { ZEBRA: "z", APPLE: "a", MANGO: "m" })];
    const registry = createTestRegistry({ files });
    const rows = registry.get(effectiveDiffRowsAtom);

    expect(rows.map((r) => r.key)).toEqual(["APPLE", "MANGO", "ZEBRA"]);
  });
});

describe("currentRowAtom", () => {
  test("returns correct row based on selection", () => {
    const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
    const registry = createTestRegistry({ files, selection: { row: 1, col: 0 } });
    const currentRow = registry.get(currentRowAtom);

    // Rows are sorted: A, B, C - so index 1 is B
    expect(currentRow?.key).toBe("B");
  });

  test("returns null when row index out of bounds", () => {
    const files = [createFile(".env", { KEY: "value" })];
    const registry = createTestRegistry({ files, selection: { row: 99, col: 0 } });
    const currentRow = registry.get(currentRowAtom);

    expect(currentRow).toBeNull();
  });

  test("returns null when no files", () => {
    const registry = createTestRegistry({ selection: { row: 0, col: 0 } });
    const currentRow = registry.get(currentRowAtom);

    expect(currentRow).toBeNull();
  });
});

describe("statsAtom", () => {
  test("counts rows by status", () => {
    const files = [
      createFile(".env.local", { IDENTICAL: "same", DIFFERENT: "val1", MISSING: "only_local" }),
      createFile(".env.prod", { IDENTICAL: "same", DIFFERENT: "val2" }),
    ];
    const registry = createTestRegistry({ files });
    const stats = registry.get(statsAtom);

    expect(stats.identical).toBe(1);
    expect(stats.different).toBe(1);
    expect(stats.missing).toBe(1);
  });

  test("returns zeros for no files", () => {
    const registry = createTestRegistry();
    const stats = registry.get(statsAtom);

    expect(stats).toEqual({ identical: 0, different: 0, missing: 0 });
  });
});

describe("pendingListAtom", () => {
  test("converts pending Map to array", () => {
    const pending = new Map<string, PendingChange>([
      ["A:0", { key: "A", fileIndex: 0, oldValue: "a", newValue: "b" }],
      ["B:1", { key: "B", fileIndex: 1, oldValue: "c", newValue: "d" }],
    ]);
    const registry = createTestRegistry({ pending });
    const list = registry.get(pendingListAtom);

    expect(list).toHaveLength(2);
    expect(list.some((c) => c.key === "A")).toBe(true);
    expect(list.some((c) => c.key === "B")).toBe(true);
  });

  test("returns empty array for no pending", () => {
    const registry = createTestRegistry();
    const list = registry.get(pendingListAtom);

    expect(list).toEqual([]);
  });
});

describe("filteredRowIndicesAtom", () => {
  test("returns all indices when search not active", () => {
    const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
    const registry = createTestRegistry({ files, search: { active: false, query: "" } });
    const indices = registry.get(filteredRowIndicesAtom);

    expect(indices).toEqual([0, 1, 2]);
  });

  test("returns all indices when search active but query empty", () => {
    const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
    const registry = createTestRegistry({ files, search: { active: true, query: "" } });
    const indices = registry.get(filteredRowIndicesAtom);

    expect(indices).toEqual([0, 1, 2]);
  });

  test("filters by query when search active", () => {
    const files = [createFile(".env", { API_KEY: "1", API_URL: "2", DB_HOST: "3" })];
    const registry = createTestRegistry({ files, search: { active: true, query: "api" } });
    const indices = registry.get(filteredRowIndicesAtom);

    // Sorted: API_KEY, API_URL, DB_HOST - indices 0, 1 match "api"
    expect(indices).toEqual([0, 1]);
  });

  test("search is case insensitive", () => {
    const files = [createFile(".env", { API_KEY: "1", api_url: "2", DB_HOST: "3" })];
    const registry = createTestRegistry({ files, search: { active: true, query: "API" } });
    const indices = registry.get(filteredRowIndicesAtom);

    // Both API_KEY and api_url match "API" case-insensitively
    expect(indices).toHaveLength(2);
  });

  test("returns empty array when no matches", () => {
    const files = [createFile(".env", { A: "1", B: "2" })];
    const registry = createTestRegistry({ files, search: { active: true, query: "xyz" } });
    const indices = registry.get(filteredRowIndicesAtom);

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
    const registry = createTestRegistry({ files });
    expect(registry.get(fileCountAtom)).toBe(3);
  });

  test("returns 0 for no files", () => {
    const registry = createTestRegistry();
    expect(registry.get(fileCountAtom)).toBe(0);
  });
});

describe("rowCountAtom", () => {
  test("returns correct row count", () => {
    const files = [createFile(".env", { A: "1", B: "2", C: "3" })];
    const registry = createTestRegistry({ files });
    expect(registry.get(rowCountAtom)).toBe(3);
  });

  test("returns 0 for no files", () => {
    const registry = createTestRegistry();
    expect(registry.get(rowCountAtom)).toBe(0);
  });

  test("includes rows from pending additions", () => {
    const files = [createFile(".env", { EXISTING: "val" })];
    const pending = new Map<string, PendingChange>([
      ["NEW:0", { key: "NEW", fileIndex: 0, oldValue: null, newValue: "added" }],
    ]);
    const registry = createTestRegistry({ files, pending });
    expect(registry.get(rowCountAtom)).toBe(2);
  });
});
