/**
 * History atoms for undo/redo functionality
 *
 * Uses a "past / present / future" model where:
 * - past: array of previous states (for undo)
 * - present: current state snapshot
 * - future: array of undone states (for redo)
 */
import { Atom } from "@effect-atom/atom-react";
import type { PendingChange } from "../../types.js";

// =============================================================================
// History Data Model
// =============================================================================

/**
 * A snapshot of the pending changes and conflicts at a point in time
 */
export interface HistoryEntry {
  readonly pending: ReadonlyMap<string, PendingChange>;
  readonly conflicts: ReadonlySet<string>;
}

export const HistoryEntry = {
  empty(): HistoryEntry {
    return { pending: new Map(), conflicts: new Set() };
  },
};

/**
 * Complete history state with past/present/future stacks
 */
export interface HistoryState {
  readonly past: ReadonlyArray<HistoryEntry>;
  readonly present: HistoryEntry;
  readonly future: ReadonlyArray<HistoryEntry>;
}

export const HistoryState = {
  initial(): HistoryState {
    return { past: [], present: HistoryEntry.empty(), future: [] };
  },
};

// =============================================================================
// History Atoms
// =============================================================================

/** History state atom - tracks past/present/future for undo/redo */
export const historyAtom = Atom.make<HistoryState>(HistoryState.initial()).pipe(Atom.keepAlive);

/** Whether undo is available */
export const canUndoAtom = Atom.map(historyAtom, (h) => h.past.length > 0);

/** Whether redo is available */
export const canRedoAtom = Atom.map(historyAtom, (h) => h.future.length > 0);
