/**
 * Hook for modal state management
 *
 * Uses atomic operations from atomicOps.ts for clean state updates.
 */
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import type { ModalState } from "../types.js";
import { modalAtom } from "../state/appState.js";
import { openModalOp, closeModalOp } from "../state/atomicOps.js";

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
