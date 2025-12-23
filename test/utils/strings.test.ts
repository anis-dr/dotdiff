/**
 * Tests for utils/strings.ts
 */
import { describe, expect, test } from "bun:test";
import { formatDisplayValue, truncate, TRUNCATE_CLIPBOARD } from "../../src/utils/strings.js";

describe("truncate", () => {
  test("returns string unchanged if shorter than maxLen", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("test", 4)).toBe("test");
  });

  test("truncates with ellipsis if longer than maxLen", () => {
    expect(truncate("hello world", 5)).toBe("hell…");
    expect(truncate("abcdefghij", 6)).toBe("abcde…");
  });

  test("handles exact length (no truncation needed)", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  test("handles length - 1 (truncates)", () => {
    expect(truncate("hello", 4)).toBe("hel…");
  });

  test("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  test("handles maxLen of 1", () => {
    expect(truncate("hello", 1)).toBe("…");
  });

  test("TRUNCATE_CLIPBOARD constant is defined", () => {
    expect(TRUNCATE_CLIPBOARD).toBe(30);
  });
});

describe("formatDisplayValue", () => {
  test("returns '—' for null (missing)", () => {
    expect(formatDisplayValue(null)).toBe("—");
  });

  test("returns '\"\"' for empty string", () => {
    expect(formatDisplayValue("")).toBe("\"\"");
  });

  test("returns value unchanged for normal strings", () => {
    expect(formatDisplayValue("hello")).toBe("hello");
    expect(formatDisplayValue("some value")).toBe("some value");
    expect(formatDisplayValue("123")).toBe("123");
  });

  test("handles whitespace-only strings", () => {
    expect(formatDisplayValue(" ")).toBe(" ");
    expect(formatDisplayValue("  ")).toBe("  ");
  });
});
