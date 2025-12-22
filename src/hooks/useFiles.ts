/**
 * Hook for files state management
 */
import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import type { EnvFile } from "../types.js";
import {
  filesAtom,
  pendingAtom,
  conflictsAtom,
  pendingKey,
  fileCountAtom,
} from "../state/appState.js";

export interface UseFiles {
  files: ReadonlyArray<EnvFile>;
  fileCount: number;
  setFiles: (files: ReadonlyArray<EnvFile>) => void;
  updateFileFromDisk: (fileIndex: number, newVariables: ReadonlyMap<string, string>) => void;
  getOriginalValue: (varKey: string, fileIndex: number) => string | null;
}

export function useFiles(): UseFiles {
  const [files, setFilesAtom] = useAtom(filesAtom);
  const [pending] = useAtom(pendingAtom);
  const [conflicts, setConflicts] = useAtom(conflictsAtom);
  const fileCount = useAtomValue(fileCountAtom);

  const setFiles = useCallback(
    (newFiles: ReadonlyArray<EnvFile>) => {
      setFilesAtom(newFiles);
    },
    [setFilesAtom]
  );

  const updateFileFromDisk = useCallback(
    (fileIndex: number, newVariables: ReadonlyMap<string, string>) => {
      setFilesAtom((prevFiles) => {
        const file = prevFiles[fileIndex];
        if (!file) return prevFiles;
        return prevFiles.map((f, i) =>
          i === fileIndex ? { ...f, variables: newVariables } : f
        );
      });

      // Detect conflicts: pending changes where oldValue no longer matches disk
      setConflicts((prevConflicts: ReadonlySet<string>) => {
        const newConflicts = new Set(prevConflicts);

        for (const [pKey, change] of pending) {
          if (change.fileIndex !== fileIndex) continue;

          const diskValue = newVariables.get(change.key) ?? null;
          const wasConflict = prevConflicts.has(pKey);
          const isConflict = diskValue !== change.oldValue;

          if (isConflict && !wasConflict) {
            newConflicts.add(pKey);
          } else if (!isConflict && wasConflict) {
            newConflicts.delete(pKey);
          }
        }

        return newConflicts;
      });
    },
    [setFilesAtom, setConflicts, pending]
  );

  const getOriginalValue = useCallback(
    (varKey: string, fileIndex: number): string | null => {
      const file = files[fileIndex];
      if (!file) return null;
      return file.variables.get(varKey) ?? null;
    },
    [files]
  );

  return {
    files,
    fileCount,
    setFiles,
    updateFileFromDisk,
    getOriginalValue,
  };
}

