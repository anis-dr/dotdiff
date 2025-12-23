/**
 * Tests for utils/sorting.ts
 */
import { describe, expect, test } from "bun:test";
import { sortKeys } from "../../src/utils/sorting.js";

describe("sortKeys", () => {
  test("sorts alphabetically", () => {
    expect(sortKeys(["c", "a", "b"])).toEqual(["a", "b", "c"]);
    expect(sortKeys(["zebra", "apple", "mango"])).toEqual(["apple", "mango", "zebra"]);
  });

  test("sorts case-insensitively", () => {
    expect(sortKeys(["B", "a", "C"])).toEqual(["a", "B", "C"]);
    expect(sortKeys(["API_KEY", "auth_token", "BASE_URL"])).toEqual([
      "API_KEY",
      "auth_token",
      "BASE_URL",
    ]);
  });

  test("handles empty input", () => {
    expect(sortKeys([])).toEqual([]);
    expect(sortKeys(new Set())).toEqual([]);
  });

  test("handles single element", () => {
    expect(sortKeys(["only"])).toEqual(["only"]);
  });

  test("works with Set input", () => {
    const set = new Set(["c", "a", "b"]);
    expect(sortKeys(set)).toEqual(["a", "b", "c"]);
  });

  test("handles keys with numbers", () => {
    expect(sortKeys(["KEY_1", "KEY_10", "KEY_2"])).toEqual(["KEY_1", "KEY_10", "KEY_2"]);
  });
});
