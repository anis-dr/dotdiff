/**
 * File synchronization utilities
 *
 * Handles refreshing file state from disk and detecting conflicts
 * with pending changes.
 */
import { Effect } from "effect";
import { FileSystem } from "@effect/platform";
import type { EnvFile } from "../types.js";
import { parseEnvToMap } from "../services/envFormat.js";
import { FileReadError } from "../errors.js";

/**
 * Re-read a single file from disk and return updated variables.
 */
export const readFileFromDisk = (
  filePath: string
): Effect.Effect<Map<string, string>, FileReadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const content = yield* fs.readFileString(filePath).pipe(
      Effect.mapError((e) => FileReadError.make({ path: filePath, cause: e }))
    );
    return parseEnvToMap(content);
  });

/**
 * Find the file index for a given path
 */
export const findFileIndex = (
  files: ReadonlyArray<EnvFile>,
  filePath: string
): number => {
  // Normalize paths for comparison
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    if (file.path === filePath || file.path.endsWith(filePath) || filePath.endsWith(file.path)) {
      return i;
    }
  }
  return -1;
};
