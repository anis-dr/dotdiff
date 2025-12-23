/**
 * Hook for files state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useCallback } from "react";
import { fileCountAtom, filesAtom, setFilesOp, updateFileFromDiskOp } from "../state/index.js";
import type { EnvFile, EnvKey, FileIndex } from "../types.js";

export interface UseFiles {
  files: ReadonlyArray<EnvFile>;
  fileCount: number;
  setFiles: (files: ReadonlyArray<EnvFile>) => void;
  updateFileFromDisk: (fileIndex: FileIndex, newVariables: ReadonlyMap<string, string>) => void;
  getOriginalValue: (varKey: EnvKey, fileIndex: FileIndex) => string | null;
}

export function useFiles(): UseFiles {
  // Read state
  const files = useAtomValue(filesAtom);
  const fileCount = useAtomValue(fileCountAtom);

  // Atomic operations
  const setFiles = useAtomSet(setFilesOp);
  const doUpdateFileFromDisk = useAtomSet(updateFileFromDiskOp);

  // Wrapper to match expected signature
  const updateFileFromDisk = useCallback(
    (fileIndex: FileIndex, newVariables: ReadonlyMap<string, string>) => {
      doUpdateFileFromDisk({ fileIndex, newVariables });
    },
    [doUpdateFileFromDisk],
  );

  // Pure read operation - no atomic op needed
  const getOriginalValue = useCallback(
    (varKey: EnvKey, fileIndex: FileIndex): string | null => {
      const file = files[fileIndex];
      if (!file) return null;
      return file.variables.get(varKey) ?? null;
    },
    [files],
  );

  return {
    files,
    fileCount,
    setFiles,
    updateFileFromDisk,
    getOriginalValue,
  };
}
