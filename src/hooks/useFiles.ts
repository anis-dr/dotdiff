/**
 * Hook for files state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useCallback } from "react";
import { fileCountAtom, filesAtom } from "../state/appState.js";
import { setFilesOp, updateFileFromDiskOp } from "../state/atomicOps.js";
import type { EnvFile } from "../types.js";

export interface UseFiles {
  files: ReadonlyArray<EnvFile>;
  fileCount: number;
  setFiles: (files: ReadonlyArray<EnvFile>) => void;
  updateFileFromDisk: (fileIndex: number, newVariables: ReadonlyMap<string, string>) => void;
  getOriginalValue: (varKey: string, fileIndex: number) => string | null;
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
    (fileIndex: number, newVariables: ReadonlyMap<string, string>) => {
      doUpdateFileFromDisk({ fileIndex, newVariables });
    },
    [doUpdateFileFromDisk],
  );

  // Pure read operation - no atomic op needed
  const getOriginalValue = useCallback(
    (varKey: string, fileIndex: number): string | null => {
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
