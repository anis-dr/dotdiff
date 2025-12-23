/**
 * Undo/Redo operations with history-based state management
 *
 * Uses a past/present/future model for proper undo/redo.
 * All operations that modify pending state should call recordHistoryOp first.
 */
import { Atom } from "@effect-atom/atom-react";
import { AppMode, FileIndex, type PendingChange } from "../../types.js";
import {
  appModeAtom,
  conflictsAtom,
  filesAtom,
  messageAtom,
  pendingAtom,
  pendingKey,
  selectionAtom,
} from "../atoms/base.js";
import { currentRowAtom } from "../atoms/derived.js";
import { historyAtom, HistoryEntry, HistoryState } from "../atoms/history.js";
import { type SaveResult, SaveResult as SR } from "../runtime.js";

// =============================================================================
// History Operations
// =============================================================================

/**
 * Record current state to history before making changes.
 * This pushes CURRENT pendingAtom state to 'past' and clears 'future' (new timeline).
 *
 * IMPORTANT: Due to Effect-Atom's batching, nested get.set() calls may see incorrect state.
 * This op should ONLY be called via registry.set() from outside, not via get.set() inside another fnSync.
 * For internal use within operations, use pushHistory() helper instead.
 */
export const recordHistoryOp = Atom.fnSync((_: void, get) => {
  const pending = get(pendingAtom);
  const conflicts = get(conflictsAtom);
  const history = get(historyAtom);

  const entry: HistoryEntry = {
    pending,
    conflicts,
  };

  get.set(historyAtom, {
    past: [...history.past, entry],
    present: entry,
    future: [],
  });
});

/**
 * Helper to create the next history state when pushing to history.
 * Use this inside operations to compute the new history state with the pre-change pending/conflicts.
 *
 * @param currentPending - The pending state to record (captured at start of operation)
 * @param currentConflicts - The conflicts state to record (captured at start of operation)
 * @param history - The current history state (captured at start of operation)
 * @returns The new history state to set
 */
export const createHistoryPush = (
  currentPending: ReadonlyMap<string, PendingChange>,
  currentConflicts: ReadonlySet<string>,
  history: HistoryState,
): HistoryState => {
  const entry: HistoryEntry = {
    pending: currentPending,
    conflicts: currentConflicts,
  };

  return {
    past: [...history.past, entry],
    present: entry,
    future: [],
  };
};

/**
 * Undo: step back in history
 */
export const undoOp = Atom.fnSync((_: void, get) => {
  const history = get(historyAtom);

  if (history.past.length === 0) {
    get.set(messageAtom, "⚠ Nothing to undo");
    return;
  }

  const previous = history.past[history.past.length - 1]!;
  const currentEntry: HistoryEntry = {
    pending: get(pendingAtom),
    conflicts: get(conflictsAtom),
  };

  get.set(historyAtom, {
    past: history.past.slice(0, -1),
    present: previous,
    future: [currentEntry, ...history.future],
  });
  get.set(pendingAtom, previous.pending);
  get.set(conflictsAtom, previous.conflicts);
  get.set(messageAtom, "↩ Undo");
});

/**
 * Redo: step forward in history
 */
export const redoOp = Atom.fnSync((_: void, get) => {
  const history = get(historyAtom);

  if (history.future.length === 0) {
    get.set(messageAtom, "⚠ Nothing to redo");
    return;
  }

  const [next, ...restFuture] = history.future;
  const currentEntry: HistoryEntry = {
    pending: get(pendingAtom),
    conflicts: get(conflictsAtom),
  };

  get.set(historyAtom, {
    past: [...history.past, currentEntry],
    present: next!,
    future: restFuture,
  });
  get.set(pendingAtom, next!.pending);
  get.set(conflictsAtom, next!.conflicts);
  get.set(messageAtom, "↪ Redo");
});

/**
 * Undo all: restore to initial empty state, saving current state for redo
 *
 * Unlike step-by-step undo, this saves the CURRENT state (with all changes)
 * to future so that a single redo restores everything.
 */
export const undoAllOp = Atom.fnSync((_: void, get) => {
  const pending = get(pendingAtom);
  const conflicts = get(conflictsAtom);
  if (pending.size === 0) {
    get.set(messageAtom, "⚠ Nothing to undo");
    return;
  }

  const history = get(historyAtom);

  // Save current state (with all changes) to future for redo
  const currentEntry: HistoryEntry = { pending, conflicts };

  get.set(historyAtom, {
    past: [],
    present: HistoryEntry.empty(),
    future: [currentEntry, ...history.future],
  });
  get.set(pendingAtom, new Map());
  get.set(conflictsAtom, new Set());
  get.set(messageAtom, "↩ All changes undone");
});

// =============================================================================
// Revert Operation (Current Cell Only)
// =============================================================================

/**
 * Revert pending change for current cell only
 * This uses the history system for undo-ability
 */
export const revertActionOp = Atom.fnSync((_: void, get) => {
  const currentRow = get(currentRowAtom);
  const selection = get(selectionAtom);
  const pending = get(pendingAtom);
  const conflicts = get(conflictsAtom);
  const history = get(historyAtom);
  if (!currentRow) return;

  const fileIndex = FileIndex.make(selection.col);
  const pKey = pendingKey(currentRow.key, fileIndex);
  if (!pending.has(pKey)) {
    get.set(messageAtom, "⚠ No pending change to revert");
    return;
  }

  get.set(historyAtom, createHistoryPush(pending, conflicts, history));

  const newPending = new Map(pending);
  newPending.delete(pKey);
  const newConflicts = new Set(conflicts);
  newConflicts.delete(pKey);

  get.set(pendingAtom, newPending);
  get.set(conflictsAtom, newConflicts);
  get.set(messageAtom, "↩ Reverted to original");
});

// =============================================================================
// Save Completion
// =============================================================================

/**
 * Handle save completion - updates state and resets history
 */
export const onSaveCompleteOp = Atom.fnSync((result: SaveResult, get) => {
  SR.$match(result, {
    Success: ({ files }) => {
      get.set(filesAtom, files);
      get.set(pendingAtom, new Map());
      get.set(conflictsAtom, new Set());
      get.set(appModeAtom, AppMode.Normal());
      get.set(historyAtom, HistoryState.initial());
      get.set(messageAtom, "💾 Saved!");
    },
    Failure: ({ message }) => {
      get.set(messageAtom, `⚠ Save failed: ${message}`);
    },
  });
});
