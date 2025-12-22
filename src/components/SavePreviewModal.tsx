/**
 * SavePreviewModal component - preview changes before saving
 */
import type { EnvFile, PendingChange } from "../types.js";
import { Colors } from "../types.js";
import { Modal } from "./Modal.js";
import { truncate } from "../utils/index.js";

interface SavePreviewModalProps {
  readonly files: ReadonlyArray<EnvFile>;
  readonly changes: ReadonlyArray<PendingChange>;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function SavePreviewModal({
  files,
  changes,
  onConfirm,
  onCancel,
}: SavePreviewModalProps) {
  // Group changes by file
  const changesByFile = new Map<number, PendingChange[]>();
  for (const change of changes) {
    const existing = changesByFile.get(change.fileIndex) ?? [];
    existing.push(change);
    changesByFile.set(change.fileIndex, existing);
  }

  return (
    <Modal
      title="Save Changes"
      footer={
        <text>
          <span fg={Colors.identical}>y</span>
          <span fg={Colors.dimText}> save  </span>
          <span fg={Colors.missing}>n</span>
          <span fg={Colors.dimText}> cancel</span>
        </text>
      }
    >
      <text>
        <span fg={Colors.primaryText}>
          {changes.length} change{changes.length !== 1 ? "s" : ""} in{" "}
          {changesByFile.size} file{changesByFile.size !== 1 ? "s" : ""}:
        </span>
      </text>
      <box height={1} />

      {Array.from(changesByFile.entries()).map(([fileIndex, fileChanges]) => {
        const file = files[fileIndex];
        if (!file) return null;

        return (
          <box key={fileIndex} flexDirection="column" marginBottom={1}>
            <text>
              <b>
                <span fg={Colors.selectedBg}>{file.filename}</span>
              </b>
              <span fg={Colors.dimText}> ({fileChanges.length})</span>
            </text>
            {fileChanges.slice(0, 3).map((change, i) => (
              <box key={i} paddingLeft={2}>
                <text>
                  <span fg={Colors.dimText}>
                    {change.newValue === null ? "−" : change.isNew ? "+" : "~"}{" "}
                  </span>
                  <span fg={Colors.primaryText}>{truncate(change.key, 20)}</span>
                  {change.newValue === null ? (
                    <span fg={Colors.dimText}> (deleted)</span>
                  ) : (
                    <>
                      <span fg={Colors.dimText}>=</span>
                      <span fg={Colors.pendingChange}>
                        {change.newValue === ""
                          ? "\"\""
                          : truncate(change.newValue, 15)}
                      </span>
                    </>
                  )}
                </text>
              </box>
            ))}
            {fileChanges.length > 3 && (
              <box paddingLeft={2}>
                <text>
                  <span fg={Colors.dimText}>
                    ...and {fileChanges.length - 3} more
                  </span>
                </text>
              </box>
            )}
          </box>
        );
      })}
    </Modal>
  );
}

