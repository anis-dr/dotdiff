/**
 * Hook for delete-related actions
 *
 * Thin wrapper around atomic operations in atomicOps.ts
 */
import { useAtomSet } from "@effect-atom/atom-react";
import {
  deleteAllActionOp,
  deleteVariableActionOp,
} from "../state/atomicOps.js";

export interface UseDeleteActions {
  handleDeleteVariable: () => void;
  handleDeleteAll: () => void;
}

export function useDeleteActions(): UseDeleteActions {
  const deleteVariable = useAtomSet(deleteVariableActionOp);
  const deleteAll = useAtomSet(deleteAllActionOp);

  return {
    handleDeleteVariable: deleteVariable,
    handleDeleteAll: deleteAll,
  };
}
