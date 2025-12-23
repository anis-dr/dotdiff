/**
 * Hook for clipboard-related actions (copy, paste, paste all)
 *
 * Thin wrapper around atomic operations in atomicOps.ts
 */
import { useAtomSet } from "@effect-atom/atom-react";
import {
  copyActionOp,
  pasteActionOp,
  pasteAllActionOp,
} from "../state/atomicOps.js";

export interface UseClipboardActions {
  handleCopy: () => void;
  handlePaste: () => void;
  handlePasteAll: () => void;
}

export function useClipboardActions(): UseClipboardActions {
  const copy = useAtomSet(copyActionOp);
  const paste = useAtomSet(pasteActionOp);
  const pasteAll = useAtomSet(pasteAllActionOp);

  return {
    handleCopy: copy,
    handlePaste: paste,
    handlePasteAll: pasteAll,
  };
}
