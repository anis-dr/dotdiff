/**
 * Inspector component - shows full key/value details for the selected row
 * Displays old->new when pending changes exist
 */
import { useAtomValue } from "jotai";
import type { DiffRow, PendingChange } from "../types.js";
import { Colors } from "../types.js";
import {
  filesAtom,
  pendingChangesAtom,
  selectedColAtom,
} from "../state/atoms.js";

interface InspectorProps {
  readonly row: DiffRow | null;
}

export function Inspector({ row }: InspectorProps) {
  const files = useAtomValue(filesAtom);
  const selectedCol = useAtomValue(selectedColAtom);
  const pendingChanges = useAtomValue(pendingChangesAtom);

  if (!row) {
    return (
      <box height={2} backgroundColor={Colors.surface} paddingLeft={1}>
        <text>
          <span fg={Colors.dimText}>No row selected</span>
        </text>
      </box>
    );
  }

  // Find pending changes for this row
  const pendingByFile = new Map<number, PendingChange>();
  for (const change of pendingChanges) {
    if (change.key === row.key) {
      pendingByFile.set(change.fileIndex, change);
    }
  }

  const selectedFile = files[selectedCol];
  const selectedValue = row.values[selectedCol] ?? null;
  const selectedPending = pendingByFile.get(selectedCol);

  const formatValue = (v: string | null): string =>
    v === null ? "—" : v === "" ? "\"\"" : v;

  return (
    <box
      flexDirection="column"
      height={3}
      backgroundColor={Colors.surface}
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Key line */}
      <box flexDirection="row">
        <text>
          <span fg={Colors.dimText}>Key: </span>
          <b>
            <span fg={Colors.primaryText}>{row.key || "(new variable)"}</span>
          </b>
          {selectedFile && (
            <>
              <span fg={Colors.dimText}> in </span>
              <span fg={Colors.selectedBg}>{selectedFile.filename}</span>
            </>
          )}
        </text>
      </box>

      {/* Value line(s) */}
      {selectedPending ? (
        <box flexDirection="column">
          <text>
            <span fg={Colors.dimText}>Old: </span>
            <span fg={Colors.secondaryText}>
              {formatValue(selectedPending.oldValue)}
            </span>
          </text>
          <text>
            <span fg={Colors.dimText}>New: </span>
            <span fg={Colors.pendingChange}>
              {formatValue(selectedPending.newValue)}
            </span>
            {selectedPending.isNew && (
              <span fg={Colors.identical}> (new)</span>
            )}
            {selectedPending.newValue === null && (
              <span fg={Colors.missing}> (deleted)</span>
            )}
          </text>
        </box>
      ) : (
        <text>
          <span fg={Colors.dimText}>Value: </span>
          <span fg={selectedValue === null ? Colors.missing : Colors.primaryText}>
            {formatValue(selectedValue)}
          </span>
        </text>
      )}
    </box>
  );
}

