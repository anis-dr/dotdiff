/**
 * Selection operations
 *
 * Operations for navigating the diff view.
 */
import { Atom } from "@effect-atom/atom-react";
import { selectionAtom } from "../atoms/base.js";
import { effectiveDiffRowsAtom, fileCountAtom, filteredRowIndicesAtom, rowCountAtom } from "../atoms/derived.js";

/**
 * Set selection row and column
 */
export const setSelectionOp = Atom.fnSync(
  (args: { row: number; col: number; }, get) => {
    get.set(selectionAtom, { row: args.row, col: args.col });
  },
);

/**
 * Move selection up (clamped to 0)
 */
export const moveUpOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const newRow = Math.max(0, selection.row - 1);
  get.set(selectionAtom, { ...selection, row: newRow });
});

/**
 * Move selection down (clamped to rowCount - 1)
 */
export const moveDownOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const rowCount = get(rowCountAtom);
  const newRow = Math.min(rowCount - 1, selection.row + 1);
  get.set(selectionAtom, { ...selection, row: newRow });
});

/**
 * Move selection left (clamped to 0)
 */
export const moveLeftOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const newCol = Math.max(0, selection.col - 1);
  get.set(selectionAtom, { ...selection, col: newCol });
});

/**
 * Move selection right (clamped to fileCount - 1)
 */
export const moveRightOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const fileCount = get(fileCountAtom);
  const newCol = Math.min(fileCount - 1, selection.col + 1);
  get.set(selectionAtom, { ...selection, col: newCol });
});

/**
 * Cycle column (wrap around)
 */
export const cycleColumnOp = Atom.fnSync((_: void, get) => {
  const selection = get(selectionAtom);
  const fileCount = get(fileCountAtom);
  const newCol = (selection.col + 1) % fileCount;
  get.set(selectionAtom, { ...selection, col: newCol });
});

/**
 * Jump to next search match
 */
export const nextMatchOp = Atom.fnSync((_: void, get) => {
  const filteredRowIndices = get(filteredRowIndicesAtom);
  if (filteredRowIndices.length === 0) return;

  const selection = get(selectionAtom);
  const currentPos = filteredRowIndices.indexOf(selection.row);

  if (currentPos === -1) {
    get.set(selectionAtom, { ...selection, row: filteredRowIndices[0]! });
  } else {
    const nextPos = (currentPos + 1) % filteredRowIndices.length;
    get.set(selectionAtom, { ...selection, row: filteredRowIndices[nextPos]! });
  }
});

/**
 * Jump to previous search match
 */
export const prevMatchOp = Atom.fnSync((_: void, get) => {
  const filteredRowIndices = get(filteredRowIndicesAtom);
  if (filteredRowIndices.length === 0) return;

  const selection = get(selectionAtom);
  const currentPos = filteredRowIndices.indexOf(selection.row);

  if (currentPos === -1) {
    get.set(selectionAtom, {
      ...selection,
      row: filteredRowIndices[filteredRowIndices.length - 1]!,
    });
  } else {
    const prevPos = (currentPos - 1 + filteredRowIndices.length) % filteredRowIndices.length;
    get.set(selectionAtom, { ...selection, row: filteredRowIndices[prevPos]! });
  }
});

/**
 * Jump to next diff (non-identical row)
 */
export const nextDiffOp = Atom.fnSync((_: void, get) => {
  const diffRows = get(effectiveDiffRowsAtom);
  if (diffRows.length === 0) return;

  const selection = get(selectionAtom);

  for (let i = 1; i <= diffRows.length; i++) {
    const idx = (selection.row + i) % diffRows.length;
    const row = diffRows[idx];
    if (row && row.status !== "identical") {
      get.set(selectionAtom, { ...selection, row: idx });
      return;
    }
  }
});

/**
 * Jump to previous diff (non-identical row)
 */
export const prevDiffOp = Atom.fnSync((_: void, get) => {
  const diffRows = get(effectiveDiffRowsAtom);
  if (diffRows.length === 0) return;

  const selection = get(selectionAtom);

  for (let i = 1; i <= diffRows.length; i++) {
    const idx = (selection.row - i + diffRows.length) % diffRows.length;
    const row = diffRows[idx];
    if (row && row.status !== "identical") {
      get.set(selectionAtom, { ...selection, row: idx });
      return;
    }
  }
});
