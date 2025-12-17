/**
 * EnvRow component - displays a single variable row with status and inline editing
 */
import { useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { InputRenderable } from "@opentui/core";
import type { DiffRow, VariableStatus } from "../types.js";
import { Colors } from "../types.js";
import { truncate } from "../utils/index.js";
import {
  colWidthsAtom,
  editModeAtom,
  pendingChangesAtom,
  selectedColAtom,
  selectedRowAtom,
} from "../state/atoms.js";

interface EnvRowProps {
  readonly row: DiffRow;
  readonly rowIndex: number;
  readonly onEditInput: (value: string) => void;
  readonly onEditSubmit: (value?: string) => void;
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

export function EnvRow({
  row,
  rowIndex,
  onEditInput,
  onEditSubmit,
}: EnvRowProps) {
  const selectedRow = useAtomValue(selectedRowAtom);
  const selectedCol = useAtomValue(selectedColAtom);
  const pendingChanges = useAtomValue(pendingChangesAtom);
  const colWidths = useAtomValue(colWidthsAtom);
  const [editMode] = useAtom(editModeAtom);
  const inputRef = useRef<InputRenderable>(null);

  const isSelectedRow = rowIndex === selectedRow;
  const icon = statusIcon[row.status];
  const color = statusColor[row.status];

  // Check if this cell is being edited
  const isEditingValue = editMode?.phase === "editValue" && isSelectedRow;

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
          const isEditingThisCell = isEditingValue && isSelectedCell;
          const pending = pendingByFile.get(fileIndex);
          const hasPending = pending !== undefined;
          const width = colWidths[fileIndex] ?? 20;

          const displayValue = value ?? "—";
          const pendingValue = pending?.newValue;

          // Truncate based on actual cell width (minus padding)
          const maxLen = width - 2;
          const truncatedValue = truncate(displayValue, maxLen);
          const truncatedPending = pendingValue
            ? truncate(pendingValue, maxLen)
            : undefined;

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
                    ? { backgroundColor: Colors.pendingChangeBg }
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
                  {hasPending && !isEditingThisCell && (
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

                {/* Value line - show input when editing this cell */}
                {isEditingThisCell ? (
                  <input
                    ref={inputRef}
                    focused
                    value={editMode.inputValue}
                    onInput={onEditInput}
                    onSubmit={onEditSubmit}
                    onPaste={(e: { text: string }) => {
                      if (inputRef.current) {
                        inputRef.current.insertText(e.text);
                      }
                    }}
                    style={{ width: width - 2 }}
                  />
                ) : (
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
                )}
              </box>
            </box>
          );
        })}
      </box>
    </box>
  );
}
