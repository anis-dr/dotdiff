import { atom } from "jotai";
import type {
  Clipboard,
  DiffRow,
  EditMode,
  EnvFile,
  PendingChange,
} from "../types";

// =============================================================================
// Core Data Atoms (set once on load)
// =============================================================================

export const filesAtom = atom<ReadonlyArray<EnvFile>>([]);
export const diffRowsAtom = atom<ReadonlyArray<DiffRow>>([]);

// =============================================================================
// Selection State
// =============================================================================

export const selectedRowAtom = atom(0);
export const selectedColAtom = atom(0);

// =============================================================================
// Clipboard
// =============================================================================

export const clipboardAtom = atom<Clipboard | null>(null);

// =============================================================================
// Pending Changes
// =============================================================================

export const pendingChangesAtom = atom<ReadonlyArray<PendingChange>>([]);

// =============================================================================
// Edit Mode
// =============================================================================

export const editModeAtom = atom<EditMode | null>(null);

// =============================================================================
// UI Feedback
// =============================================================================

export const messageAtom = atom<string | null>(null);

// =============================================================================
// Derived Atoms
// =============================================================================

export const fileCountAtom = atom((get) => get(filesAtom).length);

export const colWidthsAtom = atom<ReadonlyArray<number>>([]);
