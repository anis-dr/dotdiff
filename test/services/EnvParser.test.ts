/**
 * Integration tests for EnvParser service
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Effect, Layer } from "effect";
import { FileSystem } from "@effect/platform";
import { BunFileSystem } from "@effect/platform-bun";
import { EnvParser, EnvParserLive } from "../../src/services/EnvParser.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Test layer combining EnvParser with BunFileSystem
const TestLayer = Layer.provide(EnvParserLive, BunFileSystem.layer);

// Helper to run effects
const runEffect = <A, E>(effect: Effect.Effect<A, E, EnvParser>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

describe("EnvParser", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "envparser-test-"));
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

  describe("parseFile", () => {
    test("parses valid .env file", async () => {
      const filePath = writeTempFile(
        ".env",
        `API_KEY=secret123
DATABASE_URL=postgres://localhost/db
`
      );

      const result = await runEffect(
        Effect.gen(function* () {
          const parser = yield* EnvParser;
          return yield* parser.parseFile(filePath);
        })
      );

      expect(result.path).toBe(filePath);
      expect(result.filename).toBe(".env");
      expect(result.variables.get("API_KEY")).toBe("secret123");
      expect(result.variables.get("DATABASE_URL")).toBe("postgres://localhost/db");
    });

    test("parses empty file", async () => {
      const filePath = writeTempFile(".env.empty", "");

      const result = await runEffect(
        Effect.gen(function* () {
          const parser = yield* EnvParser;
          return yield* parser.parseFile(filePath);
        })
      );

      expect(result.variables.size).toBe(0);
    });

    test("parses file with comments only", async () => {
      const filePath = writeTempFile(
        ".env.comments",
        `# This is a comment
# Another comment
`
      );

      const result = await runEffect(
        Effect.gen(function* () {
          const parser = yield* EnvParser;
          return yield* parser.parseFile(filePath);
        })
      );

      expect(result.variables.size).toBe(0);
    });

    test("handles file with mixed content", async () => {
      const filePath = writeTempFile(
        ".env.mixed",
        `# Database config
DB_HOST=localhost
DB_PORT=5432

# API config
API_KEY=secret
`
      );

      const result = await runEffect(
        Effect.gen(function* () {
          const parser = yield* EnvParser;
          return yield* parser.parseFile(filePath);
        })
      );

      expect(result.variables.size).toBe(3);
      expect(result.variables.get("DB_HOST")).toBe("localhost");
      expect(result.variables.get("DB_PORT")).toBe("5432");
      expect(result.variables.get("API_KEY")).toBe("secret");
    });

    test("throws error for non-existent file", async () => {
      const nonExistentPath = path.join(tempDir, "does-not-exist.env");

      await expect(
        runEffect(
          Effect.gen(function* () {
            const parser = yield* EnvParser;
            return yield* parser.parseFile(nonExistentPath);
          })
        )
      ).rejects.toThrow();
    });

    test("handles quoted values", async () => {
      const filePath = writeTempFile(
        ".env.quoted",
        `DOUBLE="hello world"
SINGLE='another value'
`
      );

      const result = await runEffect(
        Effect.gen(function* () {
          const parser = yield* EnvParser;
          return yield* parser.parseFile(filePath);
        })
      );

      expect(result.variables.get("DOUBLE")).toBe("hello world");
      expect(result.variables.get("SINGLE")).toBe("another value");
    });

    test("handles export prefix", async () => {
      const filePath = writeTempFile(
        ".env.export",
        `export API_KEY=secret123
export DB_URL=postgres://localhost
`
      );

      const result = await runEffect(
        Effect.gen(function* () {
          const parser = yield* EnvParser;
          return yield* parser.parseFile(filePath);
        })
      );

      expect(result.variables.get("API_KEY")).toBe("secret123");
      expect(result.variables.get("DB_URL")).toBe("postgres://localhost");
    });
  });

  describe("parseFiles", () => {
    test("parses multiple files concurrently", async () => {
      const file1 = writeTempFile(".env.local", "LOCAL_VAR=local_value\n");
      const file2 = writeTempFile(".env.prod", "PROD_VAR=prod_value\n");

      const result = await runEffect(
        Effect.gen(function* () {
          const parser = yield* EnvParser;
          return yield* parser.parseFiles([file1, file2]);
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.variables.get("LOCAL_VAR")).toBe("local_value");
      expect(result[1]?.variables.get("PROD_VAR")).toBe("prod_value");
    });

    test("handles empty files array", async () => {
      const result = await runEffect(
        Effect.gen(function* () {
          const parser = yield* EnvParser;
          return yield* parser.parseFiles([]);
        })
      );

      expect(result).toEqual([]);
    });

    test("fails if any file is missing", async () => {
      const validFile = writeTempFile(".env.valid", "KEY=value\n");
      const invalidFile = path.join(tempDir, "nonexistent.env");

      await expect(
        runEffect(
          Effect.gen(function* () {
            const parser = yield* EnvParser;
            return yield* parser.parseFiles([validFile, invalidFile]);
          })
        )
      ).rejects.toThrow();
    });
  });
});

