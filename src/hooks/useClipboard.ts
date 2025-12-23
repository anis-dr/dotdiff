/**
 * Hook for clipboard state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { clipboardAtom, setClipboardOp } from "../state/index.js";
import type { Clipboard } from "../types.js";

export interface UseClipboard {
  clipboard: Clipboard | null;
  setClipboard: (clipboard: Clipboard) => void;
}

export function useClipboard(): UseClipboard {
  // Read state
  const clipboard = useAtomValue(clipboardAtom);

  // Atomic operations
  const setClipboard = useAtomSet(setClipboardOp);

  return {
    clipboard,
    setClipboard,
  };
}
