/**
 * Layout operations
 *
 * Operations for column widths and layout state.
 */
import { Atom } from "@effect-atom/atom-react";
import { colWidthsAtom } from "../atoms/base.js";

/**
 * Set column widths
 */
export const setColWidthsOp = Atom.fnSync(
  (colWidths: ReadonlyArray<number>, get) => {
    get.set(colWidthsAtom, colWidths);
  },
);
