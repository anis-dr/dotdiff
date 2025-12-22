/**
 * Hook for message state management with proper timeout cleanup
 */
import { useAtom } from "jotai";
import { useCallback, useRef, useEffect } from "react";
import { messageAtom } from "../state/appState.js";
import { MESSAGE_DISPLAY_DURATION_MS } from "../constants.js";

export interface UseMessage {
  message: string | null;
  showMessage: (message: string, durationMs?: number) => void;
}

export function useMessage(): UseMessage {
  const [message, setMessage] = useAtom(messageAtom);
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
        setMessage((current) => {
          // Only clear if it's still the same message
          if (current === newMessage) {
            return null;
          }
          return current;
        });
        timeoutRef.current = null;
      }, durationMs);
    },
    [setMessage]
  );

  return {
    message,
    showMessage,
  };
}

