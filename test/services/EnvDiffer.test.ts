/**
 * Tests for EnvDiffer service
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { EnvDiffer, EnvDifferLive } from "../../src/services/EnvDiffer.js";
import type { DiffRow } from "../../src/types.js";
import { EnvFile, EnvKey, FilePath } from "../../src/types.js";

// Helper to run the computeDiff effect
const runComputeDiff = (files: ReadonlyArray<EnvFile>): ReadonlyArray<DiffRow> =>
  Effect.runSync(
    Effect.gen(function*() {
      const differ = yield* EnvDiffer;
      return yield* differ.computeDiff(files);
    }).pipe(Effect.provide(EnvDifferLive)),
  );

// Helper to create EnvFile
const createFile = (path: string, vars: Record<string, string>) =>
  EnvFile.make({
    path: FilePath.make(path),
    filename: path.split("/").pop() ?? path,
    variables: new Map(Object.entries(vars)),
  });

describe("EnvDiffer.computeDiff", () => {
  test("returns empty array for empty files array", () => {
    const result = runComputeDiff([]);
    expect(result).toEqual([]);
  });

  test("handles single file", () => {
    const files = [createFile(".env", { KEY1: "value1", KEY2: "value2" })];
    const result = runComputeDiff(files);

    expect(result).toHaveLength(2);
    // All keys are identical when only one file
    expect(result.every((r) => r.status === "identical")).toBe(true);
  });

  test("two files with matching keys and identical values", () => {
    const files = [
      createFile(".env.local", { API_KEY: "secret", PORT: "3000" }),
      createFile(".env.prod", { API_KEY: "secret", PORT: "3000" }),
    ];
    const result = runComputeDiff(files);

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === "identical")).toBe(true);
  });

  test("two files with different values", () => {
    const files = [
      createFile(".env.local", { API_URL: "http://localhost", DEBUG: "true" }),
      createFile(".env.prod", { API_URL: "https://prod.example.com", DEBUG: "false" }),
    ];
    const result = runComputeDiff(files);

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === "different")).toBe(true);

    const apiUrlRow = result.find((r) => r.key === "API_URL");
    expect(apiUrlRow?.values).toEqual(["http://localhost", "https://prod.example.com"]);
  });

  test("missing keys across files", () => {
    const files = [
      createFile(".env.local", { SHARED: "value", LOCAL_ONLY: "local" }),
      createFile(".env.prod", { SHARED: "value", PROD_ONLY: "prod" }),
    ];
    const result = runComputeDiff(files);

    expect(result).toHaveLength(3);

    const localOnly = result.find((r) => r.key === "LOCAL_ONLY");
    expect(localOnly?.status).toBe("missing");
    expect(localOnly?.values).toEqual(["local", null]);

    const prodOnly = result.find((r) => r.key === "PROD_ONLY");
    expect(prodOnly?.status).toBe("missing");
    expect(prodOnly?.values).toEqual([null, "prod"]);

    const shared = result.find((r) => r.key === "SHARED");
    expect(shared?.status).toBe("identical");
  });

  test("sorts by status: missing first, then different, then identical", () => {
    const files = [
      createFile(".env.local", { IDENTICAL: "same", DIFFERENT: "val1", MISSING_IN_PROD: "x" }),
      createFile(".env.prod", { IDENTICAL: "same", DIFFERENT: "val2" }),
    ];
    const result = runComputeDiff(files);

    // First should be missing
    expect(result[0]?.status).toBe("missing");
    // Second should be different
    expect(result[1]?.status).toBe("different");
    // Third should be identical
    expect(result[2]?.status).toBe("identical");
  });

  test("alphabetical sorting within same status group", () => {
    const files = [
      createFile(".env.local", { ZEBRA: "z", APPLE: "a", MANGO: "m" }),
      createFile(".env.prod", { ZEBRA: "z", APPLE: "a", MANGO: "m" }),
    ];
    const result = runComputeDiff(files);

    // All identical, should be sorted alphabetically
    expect(result.map((r) => r.key)).toEqual([EnvKey.make("APPLE"), EnvKey.make("MANGO"), EnvKey.make("ZEBRA")]);
  });

  test("case-insensitive alphabetical sorting", () => {
    const files = [
      createFile(".env", { Zebra: "z", apple: "a", MANGO: "m" }),
    ];
    const result = runComputeDiff(files);

    expect(result.map((r) => r.key)).toEqual([EnvKey.make("apple"), EnvKey.make("MANGO"), EnvKey.make("Zebra")]);
  });

  test("handles three or more files", () => {
    const files = [
      createFile(".env.local", { KEY: "local" }),
      createFile(".env.staging", { KEY: "staging" }),
      createFile(".env.prod", { KEY: "prod" }),
    ];
    const result = runComputeDiff(files);

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("different");
    expect(result[0]?.values).toEqual(["local", "staging", "prod"]);
  });

  test("handles empty file (no variables)", () => {
    const files = [
      createFile(".env.local", { KEY: "value" }),
      createFile(".env.empty", {}),
    ];
    const result = runComputeDiff(files);

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("missing");
    expect(result[0]?.values).toEqual(["value", null]);
  });

  test("handles empty string values", () => {
    const files = [
      createFile(".env.local", { EMPTY: "" }),
      createFile(".env.prod", { EMPTY: "" }),
    ];
    const result = runComputeDiff(files);

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("identical");
    expect(result[0]?.values).toEqual(["", ""]);
  });
});
