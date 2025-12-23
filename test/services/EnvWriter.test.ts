/**
 * Integration tests for EnvWriter service
 */
import { BunFileSystem } from "@effect/platform-bun";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EnvWriter, EnvWriterLive } from "../../src/services/EnvWriter.js";
import { EnvFile, EnvKey, FileIndex, FilePath, PendingChange } from "../../src/types.js";

// Test layer combining EnvWriter with BunFileSystem
const TestLayer = Layer.provide(EnvWriterLive, BunFileSystem.layer);

// Helper to run effects
const runEffect = <A, E>(effect: Effect.Effect<A, E, EnvWriter>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

describe("EnvWriter", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "envwriter-test-"));
  });

  afterEach(() => {
    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const writeTempFile = (filename: string, content: string): string => {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  const readTempFile = (filePath: string): string => {
    return fs.readFileSync(filePath, "utf-8");
  };

  const createEnvFile = (filePath: string, vars: Record<string, string>) =>
    EnvFile.make({
      path: FilePath.make(filePath),
      filename: path.basename(filePath),
      variables: new Map(Object.entries(vars)),
    });

  describe("applyChanges", () => {
    test("modifies existing values", async () => {
      const filePath = writeTempFile(
        ".env",
        `API_KEY=old_key
DATABASE_URL=postgres://localhost/db
`,
      );

      const files = [createEnvFile(filePath, { API_KEY: "old_key", DATABASE_URL: "postgres://localhost/db" })];
      const changes = [
        PendingChange.make({
          key: EnvKey.make("API_KEY"),
          fileIndex: FileIndex.make(0),
          oldValue: "old_key",
          newValue: "new_key",
        }),
      ];

      await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      const content = readTempFile(filePath);
      expect(content).toContain("API_KEY=new_key");
      expect(content).toContain("DATABASE_URL=postgres://localhost/db");
    });

    test("adds new keys", async () => {
      const filePath = writeTempFile(
        ".env",
        `EXISTING=value
`,
      );

      const files = [createEnvFile(filePath, { EXISTING: "value" })];
      const changes = [
        PendingChange.make({
          key: EnvKey.make("NEW_KEY"),
          fileIndex: FileIndex.make(0),
          oldValue: null,
          newValue: "new_value",
        }),
      ];

      await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      const content = readTempFile(filePath);
      expect(content).toContain("EXISTING=value");
      expect(content).toContain("NEW_KEY=new_value");
    });

    test("deletes keys", async () => {
      const filePath = writeTempFile(
        ".env",
        `KEEP=value
DELETE_ME=gone
`,
      );

      const files = [createEnvFile(filePath, { KEEP: "value", DELETE_ME: "gone" })];
      const changes = [
        PendingChange.make({
          key: EnvKey.make("DELETE_ME"),
          fileIndex: FileIndex.make(0),
          oldValue: "gone",
          newValue: null,
        }),
      ];

      await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      const content = readTempFile(filePath);
      expect(content).toContain("KEEP=value");
      expect(content).not.toContain("DELETE_ME");
    });

    test("handles mixed operations", async () => {
      const filePath = writeTempFile(
        ".env",
        `MODIFY=old
DELETE=gone
KEEP=same
`,
      );

      const files = [createEnvFile(filePath, { MODIFY: "old", DELETE: "gone", KEEP: "same" })];
      const changes = [
        PendingChange.make({
          key: EnvKey.make("MODIFY"),
          fileIndex: FileIndex.make(0),
          oldValue: "old",
          newValue: "new",
        }),
        PendingChange.make({
          key: EnvKey.make("DELETE"),
          fileIndex: FileIndex.make(0),
          oldValue: "gone",
          newValue: null,
        }),
        PendingChange.make({
          key: EnvKey.make("ADD"),
          fileIndex: FileIndex.make(0),
          oldValue: null,
          newValue: "added",
        }),
      ];

      await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      const content = readTempFile(filePath);
      expect(content).toContain("MODIFY=new");
      expect(content).toContain("KEEP=same");
      expect(content).toContain("ADD=added");
      expect(content).not.toContain("DELETE");
    });

    test("preserves comments and formatting", async () => {
      const filePath = writeTempFile(
        ".env",
        `# Header comment

# API section
API_KEY=old_key

# Database section
DB_HOST=localhost
`,
      );

      const files = [createEnvFile(filePath, { API_KEY: "old_key", DB_HOST: "localhost" })];
      const changes = [
        PendingChange.make({
          key: EnvKey.make("API_KEY"),
          fileIndex: FileIndex.make(0),
          oldValue: "old_key",
          newValue: "new_key",
        }),
      ];

      await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      const content = readTempFile(filePath);
      expect(content).toContain("# Header comment");
      expect(content).toContain("# API section");
      expect(content).toContain("# Database section");
      expect(content).toContain("API_KEY=new_key");
    });

    test("returns unchanged file when no changes for that file", async () => {
      const file1Path = writeTempFile(".env.local", "LOCAL=value\n");
      const file2Path = writeTempFile(".env.prod", "PROD=value\n");

      const files = [
        createEnvFile(file1Path, { LOCAL: "value" }),
        createEnvFile(file2Path, { PROD: "value" }),
      ];

      // Only change file 0
      const changes = [
        PendingChange.make({
          key: EnvKey.make("LOCAL"),
          fileIndex: FileIndex.make(0),
          oldValue: "value",
          newValue: "modified",
        }),
      ];

      const result = await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      // File 1 should be unchanged
      expect(result[1]?.variables.get("PROD")).toBe("value");

      // Original file 2 content should be untouched
      expect(readTempFile(file2Path)).toBe("PROD=value\n");
    });

    test("handles multiple files with changes", async () => {
      const file1Path = writeTempFile(".env.local", "KEY=local\n");
      const file2Path = writeTempFile(".env.prod", "KEY=prod\n");

      const files = [
        createEnvFile(file1Path, { KEY: "local" }),
        createEnvFile(file2Path, { KEY: "prod" }),
      ];

      const changes = [
        PendingChange.make({
          key: EnvKey.make("KEY"),
          fileIndex: FileIndex.make(0),
          oldValue: "local",
          newValue: "new_local",
        }),
        PendingChange.make({
          key: EnvKey.make("KEY"),
          fileIndex: FileIndex.make(1),
          oldValue: "prod",
          newValue: "new_prod",
        }),
      ];

      await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      expect(readTempFile(file1Path)).toContain("KEY=new_local");
      expect(readTempFile(file2Path)).toContain("KEY=new_prod");
    });

    test("returns updated files with new variables map", async () => {
      const filePath = writeTempFile(".env", "OLD=value\n");

      const files = [createEnvFile(filePath, { OLD: "value" })];
      const changes = [
        PendingChange.make({
          key: EnvKey.make("OLD"),
          fileIndex: FileIndex.make(0),
          oldValue: "value",
          newValue: null,
        }), // delete
        PendingChange.make({
          key: EnvKey.make("NEW"),
          fileIndex: FileIndex.make(0),
          oldValue: null,
          newValue: "added",
        }), // add
      ];

      const result = await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      expect(result[0]?.variables.has("OLD")).toBe(false);
      expect(result[0]?.variables.get("NEW")).toBe("added");
    });

    test("handles empty changes array", async () => {
      const filePath = writeTempFile(".env", "KEY=value\n");

      const files = [createEnvFile(filePath, { KEY: "value" })];
      const changes: Array<PendingChange> = [];

      const result = await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      expect(result).toHaveLength(1);
      expect(readTempFile(filePath)).toBe("KEY=value\n");
    });

    test("quotes values with special characters", async () => {
      const filePath = writeTempFile(".env", "KEY=simple\n");

      const files = [createEnvFile(filePath, { KEY: "simple" })];
      const changes = [
        PendingChange.make({
          key: EnvKey.make("KEY"),
          fileIndex: FileIndex.make(0),
          oldValue: "simple",
          newValue: "value with spaces",
        }),
      ];

      await runEffect(
        Effect.gen(function*() {
          const writer = yield* EnvWriter;
          return yield* writer.applyChanges(files, changes);
        }),
      );

      const content = readTempFile(filePath);
      expect(content).toContain("KEY=\"value with spaces\"");
    });
  });
});
