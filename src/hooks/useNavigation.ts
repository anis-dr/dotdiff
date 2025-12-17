/**
 * Hook for navigation state management
 */
import { useCallback } from "react";
import { useAtom } from "jotai";
import { selectedRowAtom, selectedColAtom } from "../state/atoms.js";

export interface UseNavigationReturn {
  readonly selectedRow: number;
  readonly selectedCol: number;
  readonly setSelectedRow: (row: number) => void;
  readonly setSelectedCol: (col: number) => void;
  readonly moveUp: () => void;
  readonly moveDown: () => void;
  readonly moveLeft: () => void;
  readonly moveRight: () => void;
  readonly cycleColumn: () => void;
}

export function useNavigation(
  rowCount: number,
  fileCount: number
): UseNavigationReturn {
  const [selectedRow, setSelectedRow] = useAtom(selectedRowAtom);
  const [selectedCol, setSelectedCol] = useAtom(selectedColAtom);

  const moveUp = useCallback(() => {
    setSelectedRow((r) => Math.max(0, r - 1));
  }, [setSelectedRow]);

  const moveDown = useCallback(() => {
    setSelectedRow((r) => Math.min(rowCount - 1, r + 1));
  }, [rowCount, setSelectedRow]);

  const moveLeft = useCallback(() => {
    setSelectedCol((c) => Math.max(0, c - 1));
  }, [setSelectedCol]);

  const moveRight = useCallback(() => {
    setSelectedCol((c) => Math.min(fileCount - 1, c + 1));
  }, [fileCount, setSelectedCol]);

  const cycleColumn = useCallback(() => {
    setSelectedCol((c) => (c + 1) % fileCount);
  }, [fileCount, setSelectedCol]);

  return {
    selectedRow,
    selectedCol,
    setSelectedRow,
    setSelectedCol,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    cycleColumn,
  };
}

