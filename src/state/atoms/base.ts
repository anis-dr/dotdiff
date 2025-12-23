/**
 * Base atoms - core writable atoms for application state
 *
 * Each atom slice only triggers re-renders for components that depend on it.
 */
import { Atom } from "@effect-atom/atom-react";
import type { Clipboard, EnvFile, EnvKey, FileIndex, ModalType, PendingChange } from "../../types.js";
import { AppMode } from "../../types.js";

// =============================================================================
// Pending Change Key Helpers
// =============================================================================

/** Create a unique key for a pending change */
export const pendingKey = (varKey: EnvKey, fileIndex: FileIndex): string => `${varKey}:${fileIndex}`;

// =============================================================================
// Base Atoms - Split by concern for granular re-renders
// =============================================================================

/** Files as loaded from disk */
export const filesAtom = Atom.make<ReadonlyArray<EnvFile>>([]).pipe(Atom.keepAlive);

/** Pending changes - keyed by "${varKey}:${fileIndex}" */
export const pendingAtom = Atom.make<ReadonlyMap<string, PendingChange>>(new Map()).pipe(Atom.keepAlive);

/** Conflicts - set of pendingKey strings where disk value changed */
export const conflictsAtom = Atom.make<ReadonlySet<string>>(new Set<string>()).pipe(Atom.keepAlive);

/** Selection state */
export const selectionAtom = Atom.make<{ readonly row: number; readonly col: number; }>({
  row: 0,
  col: 0,
}).pipe(Atom.keepAlive);

/** Clipboard state */
export const clipboardAtom = Atom.make<Clipboard | null>(null).pipe(Atom.keepAlive);

// =============================================================================
// Application Mode - State Machine
// =============================================================================

/** Application mode atom - single source of truth for keyboard state machine */
export const appModeAtom = Atom.make<AppMode>(AppMode.Normal()).pipe(Atom.keepAlive);

// Derived atoms for backward compatibility and convenience
/** Whether search mode is active */
export const isSearchActiveAtom = Atom.map(appModeAtom, (m) => m._tag === "Search");

/** Current search query (empty string if not in search mode) */
export const searchQueryAtom = Atom.map(appModeAtom, (m) => m._tag === "Search" ? m.query : "");

/** Edit state if in edit mode, null otherwise */
export const editModeAtom = Atom.map(appModeAtom, (m) => m._tag === "Edit" ? m : null);

/** Modal type if in modal mode, null otherwise */
export const modalTypeAtom = Atom.map(appModeAtom, (m): ModalType | null => m._tag === "Modal" ? m.modalType : null);

/** Message state */
export const messageAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive);

/** Layout column widths */
export const colWidthsAtom = Atom.make<ReadonlyArray<number>>([]).pipe(Atom.keepAlive);
