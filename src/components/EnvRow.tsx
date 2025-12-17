/**
 * EnvRow component - displays a single variable row with status
 */
import { useAtomValue } from "jotai";
import type { DiffRow, VariableStatus } from "../types.js";
import { Colors } from "../types.js";
import {
  colWidthsAtom,
  pendingChangesAtom,
  selectedColAtom,
  selectedRowAtom,
} from "../state/atoms.js";

interface EnvRowProps {
  readonly row: DiffRow;
  readonly rowIndex: number;
}

const statusIcon: Record<VariableStatus, string> = {
  identical: "●",
  different: "◐",
  missing: "○",
};

const statusColor: Record<VariableStatus, string> = {
  identical: Colors.identical,
  different: Colors.different,
  missing: Colors.missing,
};

export function EnvRow({ row, rowIndex }: EnvRowProps) {
  const selectedRow = useAtomValue(selectedRowAtom);
  const selectedCol = useAtomValue(selectedColAtom);
  const pendingChanges = useAtomValue(pendingChangesAtom);
  const colWidths = useAtomValue(colWidthsAtom);

  const isSelectedRow = rowIndex === selectedRow;
  const icon = statusIcon[row.status];
  const color = statusColor[row.status];

  // Find pending changes for this row
  const pendingByFile = new Map<number, (typeof pendingChanges)[number]>();
  for (const change of pendingChanges) {
    if (change.key === row.key) {
      pendingByFile.set(change.fileIndex, change);
    }
  }

  return (
    <box flexDirection="column" width="100%">
      {/* Separator line */}
      <box height={1} backgroundColor={Colors.border} width="100%" />
      <box
        flexDirection="row"
        width="100%"
        backgroundColor={
          isSelectedRow ? Colors.selectedRowBg : Colors.background
        }
      >
        {row.values.map((value, fileIndex) => {
          const isSelectedCell = isSelectedRow && fileIndex === selectedCol;
          const pending = pendingByFile.get(fileIndex);
          const hasPending = pending !== undefined;
          const width = colWidths[fileIndex] ?? 20;

          const displayValue = value ?? "—";
          const pendingValue = pending?.newValue;

          // Truncate long values
          const truncatedValue =
            displayValue.length > 40
              ? displayValue.slice(0, 37) + "…"
              : displayValue;
          const truncatedPending =
            pendingValue && pendingValue.length > 40
              ? pendingValue.slice(0, 37) + "…"
              : pendingValue;

          return (
            <box
              key={fileIndex}
              width={width + (fileIndex > 0 ? 1 : 0)}
              flexDirection="row"
            >
              {/* Separator */}
              {fileIndex > 0 && (
                <box width={1} backgroundColor={Colors.border} />
              )}
              <box
                width={width}
                paddingLeft={1}
                paddingRight={1}
                {...(isSelectedCell
                  ? { backgroundColor: Colors.selectedBg }
                  : hasPending
                    ? { backgroundColor: "#3D2F1F" }
                    : {})}
                flexDirection="column"
              >
                {/* Key line */}
                <text>
                  <span fg={isSelectedCell ? Colors.selectedText : color}>
                    {icon}{" "}
                  </span>
                  {isSelectedCell ? (
                    <b>
                      <span fg={Colors.selectedText}>{row.key}</span>
                    </b>
                  ) : (
                    <span fg={Colors.primaryText}>{row.key}</span>
                  )}
                  {hasPending && (
                    <span
                      fg={
                        isSelectedCell
                          ? Colors.selectedText
                          : Colors.pendingChange
                      }
                    >
                      {" "}
                      ✎
                    </span>
                  )}
                </text>

                {/* Value line */}
                <text>
                  {hasPending ? (
                    <span
                      fg={
                        isSelectedCell
                          ? Colors.selectedText
                          : Colors.pendingChange
                      }
                    >
                      {truncatedPending ?? "—"}
                    </span>
                  ) : (
                    <span
                      fg={
                        isSelectedCell
                          ? Colors.selectedText
                          : value === null
                            ? Colors.missing
                            : Colors.secondaryText
                      }
                    >
                      {truncatedValue}
                    </span>
                  )}
                </text>
              </box>
            </box>
          );
        })}
      </box>
    </box>
  );
}
