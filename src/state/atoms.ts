import { atom } from "jotai";
import type {
  Clipboard,
  DiffRow,
  EditMode,
  EnvFile,
  ModalState,
  PendingChange,
  SearchState,
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
// Layout State
// =============================================================================

export const colWidthsAtom = atom<ReadonlyArray<number>>([]);

// =============================================================================
// Search State
// =============================================================================

export const searchStateAtom = atom<SearchState>({
  active: false,
  query: "",
});

// Derived atom: filtered row indices based on search query
export const filteredRowIndicesAtom = atom((get) => {
  const diffRows = get(diffRowsAtom);
  const search = get(searchStateAtom);

  if (!search.active || search.query === "") {
    // Return all indices
    return diffRows.map((_, i) => i);
  }

  const lowerQuery = search.query.toLowerCase();
  return diffRows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => row.key.toLowerCase().includes(lowerQuery))
    .map(({ i }) => i);
});

// =============================================================================
// Modal State
// =============================================================================

export const modalStateAtom = atom<ModalState | null>(null);
