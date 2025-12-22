/**
 * Hook for modal state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { modalAtom } from "../state/appState.js";
import { closeModalOp, openModalOp } from "../state/atomicOps.js";
import type { ModalState } from "../types.js";

export interface UseModal {
  modal: ModalState | null;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
}

export function useModal(): UseModal {
  // Read state
  const modal = useAtomValue(modalAtom);

  // Atomic operations
  const openModal = useAtomSet(openModalOp);
  const closeModal = useAtomSet(closeModalOp);

  return {
    modal,
    openModal,
    closeModal,
  };
}
