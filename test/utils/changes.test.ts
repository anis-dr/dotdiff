/**
 * Tests for utils/changes.ts
 */
import { describe, expect, test } from "bun:test";
import { groupChangesByFile } from "../../src/utils/changes.js";
import type { PendingChange } from "../../src/types.js";

describe("groupChangesByFile", () => {
  test("groups changes by file index", () => {
    const changes: PendingChange[] = [
      { key: "KEY1", fileIndex: 0, oldValue: "old1", newValue: "new1" },
      { key: "KEY2", fileIndex: 1, oldValue: "old2", newValue: "new2" },
      { key: "KEY3", fileIndex: 0, oldValue: "old3", newValue: "new3" },
    ];

    const result = groupChangesByFile(changes);

    expect(result.size).toBe(2);
    expect(result.get(0)).toHaveLength(2);
    expect(result.get(1)).toHaveLength(1);
    expect(result.get(0)![0]!.key).toBe("KEY1");
    expect(result.get(0)![1]!.key).toBe("KEY3");
    expect(result.get(1)![0]!.key).toBe("KEY2");
  });

  test("handles empty input", () => {
    const result = groupChangesByFile([]);
    expect(result.size).toBe(0);
  });

  test("handles single file", () => {
    const changes: PendingChange[] = [
      { key: "KEY1", fileIndex: 0, oldValue: "a", newValue: "b" },
      { key: "KEY2", fileIndex: 0, oldValue: "c", newValue: "d" },
    ];

    const result = groupChangesByFile(changes);

    expect(result.size).toBe(1);
    expect(result.get(0)).toHaveLength(2);
  });

  test("handles multiple files with single change each", () => {
    const changes: PendingChange[] = [
      { key: "KEY1", fileIndex: 0, oldValue: "a", newValue: "b" },
      { key: "KEY2", fileIndex: 1, oldValue: "c", newValue: "d" },
      { key: "KEY3", fileIndex: 2, oldValue: "e", newValue: "f" },
    ];

    const result = groupChangesByFile(changes);

    expect(result.size).toBe(3);
    expect(result.get(0)).toHaveLength(1);
    expect(result.get(1)).toHaveLength(1);
    expect(result.get(2)).toHaveLength(1);
  });

  test("preserves change order within file group", () => {
    const changes: PendingChange[] = [
      { key: "FIRST", fileIndex: 0, oldValue: "a", newValue: "b" },
      { key: "SECOND", fileIndex: 0, oldValue: "c", newValue: "d" },
      { key: "THIRD", fileIndex: 0, oldValue: "e", newValue: "f" },
    ];

    const result = groupChangesByFile(changes);
    const file0Changes = result.get(0)!;

    expect(file0Changes[0]!.key).toBe("FIRST");
    expect(file0Changes[1]!.key).toBe("SECOND");
    expect(file0Changes[2]!.key).toBe("THIRD");
  });
});

