/**
 * Inspector component - shows full key/value details for the selected row
 * Displays old->new when pending changes exist
 */
import { useAtomValue } from "jotai";
import type { DiffRow } from "../types.js";
import { Colors } from "../types.js";
import { appStateAtom, pendingKey } from "../state/appState.js";

interface InspectorProps {
  readonly row: DiffRow | null;
}

export function Inspector({ row }: InspectorProps) {
  const state = useAtomValue(appStateAtom);
  const { files, selection, pending, conflicts } = state;
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
  const pKey = pendingKey(row.key, selectedCol);
  const selectedPending = pending.get(pKey);
  const hasConflict = conflicts.has(pKey);

  const selectedFile = files[selectedCol];
  // Get current disk value (from files state, which is updated by file watcher)
  const diskValue: string | null = selectedFile?.variables.get(row.key) ?? null;
  const selectedValue: string | null = row.values[selectedCol] ?? null;

  const formatValue = (v: string | null): string =>
    v === null ? "—" : v === "" ? '""' : v;

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
          {hasConflict ? (
            <>
              <text>
                <span fg={Colors.dimText}>Old: </span>
                <span fg={Colors.secondaryText}>
                  {formatValue(selectedPending.oldValue)}
                </span>
                <span fg={Colors.missing}> (stale)</span>
              </text>
              <text>
                <span fg={Colors.dimText}>Disk: </span>
                <span fg={Colors.missing}>
                  {formatValue(diskValue)}
                </span>
                <span fg={Colors.missing}> ⚠ changed externally</span>
              </text>
              <text>
                <span fg={Colors.dimText}>Pending: </span>
                <span fg={Colors.pendingChange}>
                  {formatValue(selectedPending.newValue)}
                </span>
              </text>
            </>
          ) : (
            <>
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
                {selectedPending.newValue === null && (
                  <span fg={Colors.missing}> (deleted)</span>
                )}
              </text>
            </>
          )}
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
