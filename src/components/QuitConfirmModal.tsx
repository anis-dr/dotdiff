/**
 * QuitConfirmModal component - confirms quit with unsaved changes
 */
import { Colors } from "../types.js";
import { Modal } from "./Modal.js";

interface QuitConfirmModalProps {
  readonly pendingCount: number;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function QuitConfirmModal({
  pendingCount,
  onConfirm,
  onCancel,
}: QuitConfirmModalProps) {
  return (
    <Modal
      title="Unsaved Changes"
      footer={
        <text>
          <span fg={Colors.missing}>y</span>
          <span fg={Colors.dimText}> quit without saving  </span>
          <span fg={Colors.identical}>n</span>
          <span fg={Colors.dimText}> cancel</span>
        </text>
      }
    >
      <text>
        <span fg={Colors.pendingChange}>
          You have {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""}.
        </span>
      </text>
      <box height={1} />
      <text>
        <span fg={Colors.primaryText}>Quit without saving?</span>
      </text>
    </Modal>
  );
}

