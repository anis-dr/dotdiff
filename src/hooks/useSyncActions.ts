/**
 * Hook for sync actions (sync left/right for 2-file mode)
 *
 * Thin wrapper around atomic operations in atomicOps.ts
 */
import { useAtomSet } from "@effect-atom/atom-react";
import { syncToLeftActionOp, syncToRightActionOp } from "../state/index.js";

export interface UseSyncActions {
  handleSyncToRight: () => void;
  handleSyncToLeft: () => void;
}

export function useSyncActions(): UseSyncActions {
  const syncToRight = useAtomSet(syncToRightActionOp);
  const syncToLeft = useAtomSet(syncToLeftActionOp);

  return {
    handleSyncToRight: syncToRight,
    handleSyncToLeft: syncToLeft,
  };
}
