/**
 * Hook for layout state management
 */
import { useAtom } from "jotai";
import { useCallback } from "react";
import { colWidthsAtom } from "../state/appState.js";

export interface UseLayout {
  colWidths: ReadonlyArray<number>;
  setColWidths: (colWidths: ReadonlyArray<number>) => void;
}

export function useLayout(): UseLayout {
  const [colWidths, setColWidthsAtom] = useAtom(colWidthsAtom);

  const setColWidths = useCallback(
    (newColWidths: ReadonlyArray<number>) => {
      setColWidthsAtom(newColWidths);
    },
    [setColWidthsAtom]
  );

  return {
    colWidths,
    setColWidths,
  };
}

