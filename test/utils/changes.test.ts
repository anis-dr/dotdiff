/**
 * Tests for utils/changes.ts
 */
import { describe, expect, test } from "bun:test";
import { EnvKey, FileIndex, PendingChange } from "../../src/types.js";
import { groupChangesByFile } from "../../src/utils/changes.js";

describe("groupChangesByFile", () => {
  test("groups changes by file index", () => {
    const changes = [
      PendingChange.make({
        key: EnvKey.make("KEY1"),
        fileIndex: FileIndex.make(0),
        oldValue: "old1",
        newValue: "new1",
      }),
      PendingChange.make({
        key: EnvKey.make("KEY2"),
        fileIndex: FileIndex.make(1),
        oldValue: "old2",
        newValue: "new2",
      }),
      PendingChange.make({
        key: EnvKey.make("KEY3"),
        fileIndex: FileIndex.make(0),
        oldValue: "old3",
        newValue: "new3",
      }),
    ];

    const result = groupChangesByFile(changes);

    expect(result.size).toBe(2);
    expect(result.get(FileIndex.make(0))).toHaveLength(2);
    expect(result.get(FileIndex.make(1))).toHaveLength(1);
    expect(result.get(FileIndex.make(0))![0]!.key).toBe(EnvKey.make("KEY1"));
    expect(result.get(FileIndex.make(0))![1]!.key).toBe(EnvKey.make("KEY3"));
    expect(result.get(FileIndex.make(1))![0]!.key).toBe(EnvKey.make("KEY2"));
  });

  test("handles empty input", () => {
    const result = groupChangesByFile([]);
    expect(result.size).toBe(0);
  });

  test("handles single file", () => {
    const changes = [
      PendingChange.make({ key: EnvKey.make("KEY1"), fileIndex: FileIndex.make(0), oldValue: "a", newValue: "b" }),
      PendingChange.make({ key: EnvKey.make("KEY2"), fileIndex: FileIndex.make(0), oldValue: "c", newValue: "d" }),
    ];

    const result = groupChangesByFile(changes);

    expect(result.size).toBe(1);
    expect(result.get(FileIndex.make(0))).toHaveLength(2);
  });

  test("handles multiple files with single change each", () => {
    const changes = [
      PendingChange.make({ key: EnvKey.make("KEY1"), fileIndex: FileIndex.make(0), oldValue: "a", newValue: "b" }),
      PendingChange.make({ key: EnvKey.make("KEY2"), fileIndex: FileIndex.make(1), oldValue: "c", newValue: "d" }),
      PendingChange.make({ key: EnvKey.make("KEY3"), fileIndex: FileIndex.make(2), oldValue: "e", newValue: "f" }),
    ];

    const result = groupChangesByFile(changes);

    expect(result.size).toBe(3);
    expect(result.get(FileIndex.make(0))).toHaveLength(1);
    expect(result.get(FileIndex.make(1))).toHaveLength(1);
    expect(result.get(FileIndex.make(2))).toHaveLength(1);
  });

  test("preserves change order within file group", () => {
    const changes = [
      PendingChange.make({ key: EnvKey.make("FIRST"), fileIndex: FileIndex.make(0), oldValue: "a", newValue: "b" }),
      PendingChange.make({ key: EnvKey.make("SECOND"), fileIndex: FileIndex.make(0), oldValue: "c", newValue: "d" }),
      PendingChange.make({ key: EnvKey.make("THIRD"), fileIndex: FileIndex.make(0), oldValue: "e", newValue: "f" }),
    ];

    const result = groupChangesByFile(changes);
    const file0Changes = result.get(FileIndex.make(0))!;

    expect(file0Changes[0]!.key).toBe(EnvKey.make("FIRST"));
    expect(file0Changes[1]!.key).toBe(EnvKey.make("SECOND"));
    expect(file0Changes[2]!.key).toBe(EnvKey.make("THIRD"));
  });
});
