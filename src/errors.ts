/**
 * Tagged error types for Effect-TS error handling
 *
 * Using Effect's Schema.TaggedError for proper error discrimination,
 * type-safe error handling via Effect.catchTag, and serialization support.
 */
import { Schema } from "effect";

/**
 * Error reading a file from disk
 */
export class FileReadError extends Schema.TaggedError<FileReadError>()(
  "FileReadError",
  {
    path: Schema.String,
    cause: Schema.Defect,
  },
) {}

/**
 * Error writing a file to disk
 */
export class FileWriteError extends Schema.TaggedError<FileWriteError>()(
  "FileWriteError",
  {
    path: Schema.String,
    cause: Schema.Defect,
  },
) {}

/**
 * Error parsing an env file
 */
export class EnvParseError extends Schema.TaggedError<EnvParseError>()(
  "EnvParseError",
  {
    path: Schema.String,
    line: Schema.optional(Schema.Number),
    cause: Schema.optional(Schema.Defect),
  },
) {}

/**
 * Error when file watcher fails
 */
export class FileWatchError extends Schema.TaggedError<FileWatchError>()(
  "FileWatchError",
  {
    paths: Schema.Array(Schema.String),
    cause: Schema.Defect,
  },
) {}

/**
 * Union type of all application errors
 */
export const AppError = Schema.Union(FileReadError, FileWriteError, EnvParseError, FileWatchError);
export type AppError = typeof AppError.Type;
