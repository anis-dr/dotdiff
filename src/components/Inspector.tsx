/**
 * Inspector component - shows full key/value details for the selected row
 * Displays old->new when pending changes exist
 */
import { useAtomValue } from "@effect-atom/atom-react";
import { conflictsAtom, filesAtom, pendingAtom, pendingKey, selectionAtom } from "../state/index.js";
import type { DiffRow } from "../types.js";
import { Colors, FileIndex } from "../types.js";
import { formatDisplayValue } from "../utils/index.js";

interface InspectorProps {
  readonly row: DiffRow | null;
}

export function Inspector({ row }: InspectorProps) {
  const conflicts = useAtomValue(conflictsAtom);
  const files = useAtomValue(filesAtom);
  const pending = useAtomValue(pendingAtom);
  const selection = useAtomValue(selectionAtom);
  const selectedCol = selection.col;

  if (!row) {
    return (
      <box height={2} backgroundColor={Colors.surface} paddingLeft={1}>
        <text>
          <span fg={Colors.dimText}>No row selected</span>
        </text>
      </box>
    );
  }

  // Find pending change for selected cell
  const pKey = pendingKey(row.key, FileIndex.make(selectedCol));
  const selectedPending = pending.get(pKey);
  const hasConflict = conflicts.has(pKey);

  const selectedFile = files[selectedCol];
  // Get current disk value (from files state, which is updated by file watcher)
  const diskValue: string | null = selectedFile?.variables.get(row.key) ?? null;
  const selectedValue: string | null = row.values[selectedCol] ?? null;

  // Need more height when showing conflict (3 lines: old, disk, pending)
  const inspectorHeight = hasConflict ? 4 : 3;

  return (
    <box
      flexDirection="column"
      height={inspectorHeight}
      backgroundColor={Colors.surface}
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Key line */}
      <box flexDirection="row">
        <text>
          <span fg={Colors.dimText}>Key:{" "}</span>
          <b>
            <span fg={Colors.primaryText}>{row.key || "(new variable)"}</span>
          </b>
          {selectedFile && (
            <>
              <span fg={Colors.dimText}>{" "}in{" "}</span>
              <span fg={Colors.selectedBg}>{selectedFile.filename}</span>
            </>
          )}
        </text>
      </box>

      {/* Value line(s) */}
      {selectedPending ?
        (
          <box flexDirection="column">
            {hasConflict ?
              (
                <>
                  <text>
                    <span fg={Colors.dimText}>Old:{" "}</span>
                    <span fg={Colors.secondaryText}>
                      {formatDisplayValue(selectedPending.oldValue)}
                    </span>
                    <span fg={Colors.missing}>{" "}(stale)</span>
                  </text>
                  <text>
                    <span fg={Colors.dimText}>Disk:{" "}</span>
                    <span fg={Colors.missing}>
                      {formatDisplayValue(diskValue)}
                    </span>
                    <span fg={Colors.missing}>{" "}⚠ changed externally</span>
                  </text>
                  <text>
                    <span fg={Colors.dimText}>Pending:{" "}</span>
                    <span fg={Colors.pendingChange}>
                      {formatDisplayValue(selectedPending.newValue)}
                    </span>
                  </text>
                </>
              ) :
              (
                <>
                  <text>
                    <span fg={Colors.dimText}>Old:{" "}</span>
                    <span fg={Colors.secondaryText}>
                      {formatDisplayValue(selectedPending.oldValue)}
                    </span>
                  </text>
                  <text>
                    <span fg={Colors.dimText}>New:{" "}</span>
                    <span fg={Colors.pendingChange}>
                      {formatDisplayValue(selectedPending.newValue)}
                    </span>
                    {selectedPending.newValue === null && <span fg={Colors.missing}>{" "}(deleted)</span>}
                  </text>
                </>
              )}
          </box>
        ) :
        (
          <text>
            <span fg={Colors.dimText}>Value:{" "}</span>
            <span fg={selectedValue === null ? Colors.missing : Colors.primaryText}>
              {formatDisplayValue(selectedValue)}
            </span>
          </text>
        )}
    </box>
  );
}
