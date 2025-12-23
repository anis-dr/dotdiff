/**
 * SavePreviewModal component - preview changes before saving
 */
import { SAVE_PREVIEW_MAX_ITEMS } from "../constants.js";
import type { EnvFile, PendingChange } from "../types.js";
import { Colors } from "../types.js";
import { groupChangesByFile, truncate } from "../utils/index.js";
import { Kbd } from "./Kbd.js";
import { Modal } from "./Modal.js";

interface SavePreviewModalProps {
  readonly files: ReadonlyArray<EnvFile>;
  readonly changes: ReadonlyArray<PendingChange>;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function SavePreviewModal({
  changes,
  files,
  onCancel: _onCancel,
  onConfirm: _onConfirm,
}: SavePreviewModalProps) {
  const changesByFile = groupChangesByFile(changes);

  return (
    <Modal
      title="Save Changes"
      footer={
        <box flexDirection="row">
          <box paddingRight={4}>
            <text>
              <Kbd fg={Colors.identical}>y</Kbd>
              <span fg={Colors.dimText}>{" save"}</span>
            </text>
          </box>
          <text>
            <Kbd fg={Colors.missing}>n</Kbd>
            <span fg={Colors.dimText}>{" cancel"}</span>
          </text>
        </box>
      }
    >
      <text>
        <span fg={Colors.primaryText}>
          {changes.length} change{changes.length !== 1 ? "s" : ""} in {changesByFile.size}{" "}
          file{changesByFile.size !== 1 ? "s" : ""}:
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
              <span fg={Colors.dimText}>({fileChanges.length})</span>
            </text>
            {fileChanges.slice(0, SAVE_PREVIEW_MAX_ITEMS).map((change, i) => {
              // Determine if this is an addition (oldValue was null)
              const isAddition = change.oldValue === null && change.newValue !== null;
              const isDeletion = change.newValue === null;
              const prefix = isDeletion ? "−" : isAddition ? "+" : "~";

              return (
                <box key={i} paddingLeft={2}>
                  <text>
                    <span fg={Colors.dimText}>{prefix}</span>
                    <span fg={Colors.primaryText}>{truncate(change.key, 20)}</span>
                    {isDeletion ? <span fg={Colors.dimText}>(deleted)</span> : (
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
              );
            })}
            {fileChanges.length > SAVE_PREVIEW_MAX_ITEMS && (
              <box paddingLeft={2}>
                <text>
                  <span fg={Colors.dimText}>
                    ...and {fileChanges.length - SAVE_PREVIEW_MAX_ITEMS} more
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
