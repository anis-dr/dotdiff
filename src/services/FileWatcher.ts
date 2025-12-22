/**
 * FileWatcher service - watches .env files for external changes
 *
 * Uses Effect Platform's FileSystem.watch with debouncing to detect
 * when files are modified externally.
 */
import { Context, Effect, Layer, Stream, pipe } from "effect";
import { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { FILE_WATCHER_DEBOUNCE_MS } from "../constants.js";

/** Event emitted when a watched file changes */
export interface FileChangeEvent {
  readonly path: string;
  readonly type: "update" | "remove";
}

export class FileWatcher extends Context.Tag("FileWatcher")<
  FileWatcher,
  {
    /**
     * Watch multiple file paths and emit debounced change events.
     * The stream emits after changes settle (debounce interval from constants).
     */
    readonly watchFiles: (
      paths: ReadonlyArray<string>
    ) => Stream.Stream<FileChangeEvent, PlatformError>;
  }
>() {}

export const FileWatcherLive = Layer.effect(
  FileWatcher,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const watchFiles = (
      paths: ReadonlyArray<string>
    ): Stream.Stream<FileChangeEvent, PlatformError> => {
      if (paths.length === 0) {
        return Stream.empty;
      }

      // Create a stream for each file
      const fileStreams = paths.map((filePath) =>
        pipe(
          fs.watch(filePath),
          Stream.map((event): FileChangeEvent => {
            switch (event._tag) {
              case "Update":
                return { path: event.path, type: "update" };
              case "Remove":
                return { path: event.path, type: "remove" };
              case "Create":
                // Treat create as update (file recreated)
                return { path: event.path, type: "update" };
            }
          })
        )
      );

      // Merge all file streams and debounce
      return pipe(
        Stream.mergeAll(fileStreams, { concurrency: paths.length }),
        Stream.debounce(`${FILE_WATCHER_DEBOUNCE_MS} millis`)
      );
    };

    return { watchFiles };
  })
);
