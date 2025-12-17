/**
 * Hook that provides the currently selected row
 */
import { useMemo } from "react";
import { useAtomValue } from "jotai";
import type { DiffRow } from "../types.js";
import { diffRowsAtom, selectedRowAtom } from "../state/atoms.js";

export interface UseCurrentRowReturn {
  readonly currentRow: DiffRow | null;
  readonly diffRows: ReadonlyArray<DiffRow>;
  readonly selectedRow: number;
}

export function useCurrentRow(): UseCurrentRowReturn {
  const diffRows = useAtomValue(diffRowsAtom);
  const selectedRow = useAtomValue(selectedRowAtom);

  const currentRow = useMemo(
    () => diffRows[selectedRow] ?? null,
    [diffRows, selectedRow]
  );

  return {
    currentRow,
    diffRows,
    selectedRow,
  };
}

