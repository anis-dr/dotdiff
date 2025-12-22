/**
 * Hook for sync actions (sync left/right for 2-file mode)
 */
import { useAtomValue } from "@effect-atom/atom-react";
import { useCallback } from "react";
import { currentRowAtom, fileCountAtom } from "../state/appState.js";
import { useFiles } from "./useFiles.js";
import { useMessage } from "./useMessage.js";
import { usePendingChanges } from "./usePendingChanges.js";

export interface UseSyncActions {
  handleSyncToRight: () => void;
  handleSyncToLeft: () => void;
}

export function useSyncActions(): UseSyncActions {
  const currentRow = useAtomValue(currentRowAtom);
  const fileCount = useAtomValue(fileCountAtom);

  const { upsertChange } = usePendingChanges();
  const { getOriginalValue } = useFiles();
  const { showMessage } = useMessage();

  const handleSyncToRight = useCallback(() => {
    if (!currentRow || fileCount !== 2) return;
    const leftValue = currentRow.values[0] ?? null;
    if (leftValue === null) {
      showMessage("⚠ Left value is missing");
      return;
    }
    const rightValue = currentRow.values[1] ?? null;
    if (leftValue === rightValue) {
      showMessage("⚠ Values already match");
      return;
    }
    upsertChange({
      key: currentRow.key,
      fileIndex: 1,
      oldValue: getOriginalValue(currentRow.key, 1),
      newValue: leftValue,
    });
    showMessage("→ Synced to right");
  }, [currentRow, fileCount, getOriginalValue, upsertChange, showMessage]);

  const handleSyncToLeft = useCallback(() => {
    if (!currentRow || fileCount !== 2) return;
    const rightValue = currentRow.values[1] ?? null;
    if (rightValue === null) {
      showMessage("⚠ Right value is missing");
      return;
    }
    const leftValue = currentRow.values[0] ?? null;
    if (rightValue === leftValue) {
      showMessage("⚠ Values already match");
      return;
    }
    upsertChange({
      key: currentRow.key,
      fileIndex: 0,
      oldValue: getOriginalValue(currentRow.key, 0),
      newValue: rightValue,
    });
    showMessage("← Synced to left");
  }, [currentRow, fileCount, getOriginalValue, upsertChange, showMessage]);

  return {
    handleSyncToRight,
    handleSyncToLeft,
  };
}
