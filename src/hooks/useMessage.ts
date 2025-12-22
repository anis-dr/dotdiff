/**
 * Hook for message state management with proper timeout cleanup
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 * Note: Timeout logic is kept imperative as it involves React refs.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useCallback, useEffect, useRef } from "react";
import { MESSAGE_DISPLAY_DURATION_MS } from "../constants.js";
import { messageAtom } from "../state/appState.js";
import { setMessageOp } from "../state/atomicOps.js";

export interface UseMessage {
  message: string | null;
  showMessage: (message: string, durationMs?: number) => void;
}

export function useMessage(): UseMessage {
  // Read state
  const message = useAtomValue(messageAtom);

  // Atomic operations
  const setMessage = useAtomSet(setMessageOp);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showMessage = useCallback(
    (newMessage: string, durationMs = MESSAGE_DISPLAY_DURATION_MS) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setMessage(newMessage);

      timeoutRef.current = setTimeout(() => {
        // Clear the message after timeout
        setMessage(null);
        timeoutRef.current = null;
      }, durationMs);
    },
    [setMessage],
  );

  return {
    message,
    showMessage,
  };
}
