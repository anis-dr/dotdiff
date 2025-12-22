/**
 * Hook for clipboard state management
 */
import { useAtom } from "jotai";
import { useCallback } from "react";
import type { Clipboard } from "../types.js";
import { clipboardAtom } from "../state/appState.js";

export interface UseClipboard {
  clipboard: Clipboard | null;
  setClipboard: (clipboard: Clipboard) => void;
}

export function useClipboard(): UseClipboard {
  const [clipboard, setClipboardAtom] = useAtom(clipboardAtom);

  const setClipboard = useCallback(
    (newClipboard: Clipboard) => {
      setClipboardAtom(newClipboard);
    },
    [setClipboardAtom]
  );

  return {
    clipboard,
    setClipboard,
  };
}

