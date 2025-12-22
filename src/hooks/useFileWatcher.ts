/**
 * Hook to subscribe to file change events.
 *
 * This hook listens to the fileChangeEventAtom and triggers
 * file re-reads when external changes are detected.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import { useEffect } from "react";
import { parseEnvToMap } from "../services/envFormat.js";
import { filesAtom } from "../state/appState.js";
import { setMessageOp, updateFileFromDiskOp } from "../state/atomicOps.js";
import { findFileIndex } from "../state/fileSync.js";
import { fileChangeEventAtom } from "../state/runtime.js";

/**
 * Subscribe to file change events and update state when files change on disk.
 *
 * This hook:
 * 1. Subscribes to the fileChangeEventAtom (set directly by CLI)
 * 2. When an event arrives, finds the corresponding file index
 * 3. Re-reads the file from disk
 * 4. Updates the file state via atomic operation
 * 5. Shows a message to the user
 */
export function useFileWatcher(): void {
  const event = useAtomValue(fileChangeEventAtom);
  const files = useAtomValue(filesAtom);
  const updateFileFromDisk = useAtomSet(updateFileFromDiskOp);
  const setMessage = useAtomSet(setMessageOp);

  useEffect(() => {
    if (!event) {
      return;
    }

    // Find which file changed
    const fileIndex = findFileIndex(files, event.path);
    if (fileIndex === -1) {
      return;
    }

    const file = files[fileIndex];
    if (!file) {
      return;
    }

    // Re-read the file from disk
    const readAndUpdate = Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem;
      const content = yield* fs.readFileString(file.path);
      const newVariables = parseEnvToMap(content);
      return newVariables;
    }).pipe(
      Effect.provide(BunContext.layer),
      Effect.runPromise,
    );

    readAndUpdate
      .then((newVariables) => {
        updateFileFromDisk({ fileIndex, newVariables });
        setMessage(`↻ ${file.filename} updated`);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setMessage(`⚠ Failed to read ${file.filename}: ${msg}`);
      });
  }, [event, files, updateFileFromDisk, setMessage]);
}
