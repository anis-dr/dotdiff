/**
 * Hook for clipboard state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import type { Clipboard } from "../types.js";
import { clipboardAtom } from "../state/appState.js";
import { setClipboardOp } from "../state/atomicOps.js";

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
