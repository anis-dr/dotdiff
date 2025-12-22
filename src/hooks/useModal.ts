/**
 * Hook for modal state management
 */
import { useAtom } from "jotai";
import { useCallback } from "react";
import type { ModalState } from "../types.js";
import { modalAtom } from "../state/appState.js";

export interface UseModal {
  modal: ModalState | null;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
}

export function useModal(): UseModal {
  const [modal, setModal] = useAtom(modalAtom);

  const openModal = useCallback(
    (modalState: ModalState) => {
      setModal(modalState);
    },
    [setModal]
  );

  const closeModal = useCallback(() => {
    setModal(null);
  }, [setModal]);

  return {
    modal,
    openModal,
    closeModal,
  };
}

