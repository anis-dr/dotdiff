/**
 * Tests for state/fileSync.ts
 */
import { describe, expect, test } from "bun:test";
import { findFileIndex } from "../src/state/fileSync.js";
import type { EnvFile } from "../src/types.js";

// Helper to create EnvFile
const createFile = (path: string): EnvFile => ({
  path,
  filename: path.split("/").pop() ?? path,
  variables: new Map(),
});

describe("findFileIndex", () => {
  test("finds exact match", () => {
    const files = [
      createFile("/path/to/.env.local"),
      createFile("/path/to/.env.prod"),
    ];

    expect(findFileIndex(files, "/path/to/.env.local")).toBe(0);
    expect(findFileIndex(files, "/path/to/.env.prod")).toBe(1);
  });

  test("finds by suffix match", () => {
    const files = [
      createFile("/Users/dev/project/.env.local"),
      createFile("/Users/dev/project/.env.prod"),
    ];

    // Searching with just filename should match
    expect(findFileIndex(files, ".env.local")).toBe(0);
    expect(findFileIndex(files, ".env.prod")).toBe(1);
  });

  test("finds when file path ends with search path", () => {
    const files = [
      createFile("/full/path/to/config/.env"),
    ];

    expect(findFileIndex(files, "config/.env")).toBe(0);
    expect(findFileIndex(files, "to/config/.env")).toBe(0);
  });

  test("returns -1 when not found", () => {
    const files = [
      createFile("/path/to/.env.local"),
    ];

    expect(findFileIndex(files, "/nonexistent/.env")).toBe(-1);
    expect(findFileIndex(files, ".env.staging")).toBe(-1);
  });

  test("returns -1 for empty files array", () => {
    expect(findFileIndex([], "/any/path")).toBe(-1);
  });

  test("returns first match when multiple files could match", () => {
    const files = [
      createFile("/project-a/.env"),
      createFile("/project-b/.env"),
    ];

    // Both end with ".env", first one matches
    expect(findFileIndex(files, ".env")).toBe(0);
  });

  test("handles Windows-style paths", () => {
    const files = [
      createFile("C:\\Users\\dev\\project\\.env"),
    ];

    // Searching with same path
    expect(findFileIndex(files, "C:\\Users\\dev\\project\\.env")).toBe(0);
  });
});

