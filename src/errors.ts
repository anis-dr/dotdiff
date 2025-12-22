/**
 * Tagged error types for Effect-TS error handling
 *
 * Using Effect's Data.TaggedError for proper error discrimination
 * and type-safe error handling via Effect.catchTag
 */
import { Data } from "effect";

/**
 * Error reading a file from disk
 */
export class FileReadError extends Data.TaggedError("FileReadError")<{
  readonly path: string;
  readonly cause: unknown;
}> {
  override get message(): string {
    const causeMsg = this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `Failed to read file ${this.path}: ${causeMsg}`;
  }
}

/**
 * Error writing a file to disk
 */
export class FileWriteError extends Data.TaggedError("FileWriteError")<{
  readonly path: string;
  readonly cause: unknown;
}> {
  override get message(): string {
    const causeMsg = this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `Failed to write file ${this.path}: ${causeMsg}`;
  }
}

/**
 * Error parsing an env file
 */
export class EnvParseError extends Data.TaggedError("EnvParseError")<{
  readonly path: string;
  readonly line?: number;
  readonly cause?: unknown;
}> {
  override get message(): string {
    const lineInfo = this.line !== undefined ? ` at line ${this.line}` : "";
    const causeMsg = this.cause ? `: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}` : "";
    return `Failed to parse env file ${this.path}${lineInfo}${causeMsg}`;
  }
}

/**
 * Error when file watcher fails
 */
export class FileWatchError extends Data.TaggedError("FileWatchError")<{
  readonly paths: ReadonlyArray<string>;
  readonly cause: unknown;
}> {
  override get message(): string {
    const causeMsg = this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `File watcher error for [${this.paths.join(", ")}]: ${causeMsg}`;
  }
}

/**
 * Union type of all application errors
 */
export type AppError = FileReadError | FileWriteError | EnvParseError | FileWatchError;

