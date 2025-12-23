/**
 * Tests for types.ts - core type utilities
 */
import { describe, expect, test } from "bun:test";
import { getVariableStatus } from "../src/types.js";

describe("getVariableStatus", () => {
  test("returns 'identical' when all values are the same", () => {
    expect(getVariableStatus(["value", "value", "value"])).toBe("identical");
    expect(getVariableStatus(["test", "test"])).toBe("identical");
  });

  test("returns 'identical' for single value", () => {
    expect(getVariableStatus(["only-one"])).toBe("identical");
  });

  test("returns 'different' when values differ", () => {
    expect(getVariableStatus(["value1", "value2"])).toBe("different");
    expect(getVariableStatus(["a", "b", "c"])).toBe("different");
    expect(getVariableStatus(["same", "same", "different"])).toBe("different");
  });

  test("returns 'missing' when some values are null", () => {
    expect(getVariableStatus(["value", null])).toBe("missing");
    expect(getVariableStatus([null, "value"])).toBe("missing");
    expect(getVariableStatus([null, null, "value"])).toBe("missing");
    expect(getVariableStatus(["a", null, "b"])).toBe("missing");
  });

  test("returns 'missing' when all values are null", () => {
    expect(getVariableStatus([null, null])).toBe("missing");
    expect(getVariableStatus([null])).toBe("missing");
  });

  test("handles empty array (edge case)", () => {
    // Empty array: no null values, but also no values to compare
    // All 0 non-null values equal each other vacuously
    expect(getVariableStatus([])).toBe("identical");
  });

  test("handles empty string values correctly", () => {
    // Empty strings are valid values, not missing
    expect(getVariableStatus(["", ""])).toBe("identical");
    expect(getVariableStatus(["", "value"])).toBe("different");
  });
});
