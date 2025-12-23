/**
 * Hook for modal state management
 *
 * Uses atomic operations from keyboardDispatch.ts for mode transitions.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useCallback } from "react";
import { appModeAtom, closeModalOp, modalTypeAtom, openModalOp } from "../state/index.js";
import type { ModalType } from "../types.js";

/** Modal state compatible with existing code */
export interface ModalState {
  readonly type: ModalType;
}

export interface UseModal {
  modal: ModalState | null;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
}

export function useModal(): UseModal {
  // Read modal type from derived atom
  const modalType = useAtomValue(modalTypeAtom);

  // Mode transition operations
  const doOpenModal = useAtomSet(openModalOp);
  const closeModal = useAtomSet(closeModalOp);

  // Wrap to convert ModalState to ModalType
  const openModal = useCallback(
    (modal: ModalState) => {
      doOpenModal(modal.type);
    },
    [doOpenModal],
  );

  // Convert to ModalState format for backward compatibility
  const modal: ModalState | null = modalType ? { type: modalType } : null;

  return {
    modal,
    openModal,
    closeModal,
  };
}

/** Hook to get full AppMode for rendering decisions */
export function useAppMode() {
  return useAtomValue(appModeAtom);
}
