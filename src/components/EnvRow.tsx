/**
 * EnvRow component - displays a single variable row with status and inline editing
 * Layout: [Key/Status column] | [File A value] | [File B value]
 */
import { useCallback, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { InputRenderable } from "@opentui/core";
import type { DiffRow, VariableStatus } from "../types.js";
import { Colors, getVariableStatus } from "../types.js";
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

  // Check edit modes
  const isEditingValue = editMode?.phase === "editValue" && isSelectedRow;
  const isEditingKey = editMode?.phase === "addKey" && isSelectedRow;

  // Find pending changes for this row
  const pendingByFile = new Map<number, (typeof pendingChanges)[number]>();
  for (const change of pendingChanges) {
    if (change.key === row.key) {
      pendingByFile.set(change.fileIndex, change);
    }
  }

  // Compute effective values (original + pending changes) for status calculation
  const effectiveValues = row.values.map((value, i) => {
    const pending = pendingByFile.get(i);
    return pending !== undefined ? pending.newValue : value;
  });
  const effectiveStatus = pendingByFile.size > 0 ? getVariableStatus(effectiveValues) : row.status;
  const icon = statusIcon[effectiveStatus];
  const color = statusColor[effectiveStatus];

  // Has any pending change for this row?
  const hasAnyPending = pendingByFile.size > 0;

  const handlePaste = useCallback((e: { text: string }) => {
    inputRef.current?.insertText(e.text);
  }, []);

  const keyColWidth = colWidths[0] ?? 20;

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
        {/* Key/Status column (fixed left) */}
        <box
          width={keyColWidth}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={isSelectedRow ? Colors.selectedRowBg : Colors.background}
        >
          {isEditingKey ? (
            <box flexDirection="row">
              <text>
                <span fg={Colors.selectedText}>{icon} </span>
              </text>
              <input
                ref={inputRef}
                focused
                value={editMode.inputValue}
                onInput={onEditInput}
                onSubmit={onEditSubmit}
                onPaste={handlePaste}
                style={{ width: keyColWidth - 4 }}
              />
            </box>
          ) : (
            <text>
              <span fg={color}>
                {icon}{" "}
              </span>
              {isSelectedRow ? (
                <b>
                  <span fg={Colors.primaryText}>
                    {truncate(row.key || "(new variable)", keyColWidth - 4)}
                  </span>
                </b>
              ) : (
                <span fg={Colors.primaryText}>
                  {truncate(row.key || "(new variable)", keyColWidth - 4)}
                </span>
              )}
              {hasAnyPending && !isEditingKey && (
                <span fg={Colors.pendingChange}>
                  {" "}✎
                </span>
              )}
            </text>
          )}
        </box>

        {/* Value columns (one per file) */}
        {row.values.map((value, fileIndex) => {
          const isSelectedCell = isSelectedRow && fileIndex === selectedCol;
          const isEditingThisCell = isEditingValue && isSelectedCell;
          const pending = pendingByFile.get(fileIndex);
          const hasPending = pending !== undefined;
          const width = colWidths[fileIndex + 1] ?? 20; // +1 because colWidths[0] is key col

          const displayValue =
            value === null ? "—" : value === "" ? "\"\"" : value;
          const pendingValue = pending?.newValue;

          // Truncate based on actual cell width (minus padding)
          const maxLen = width - 2;
          const truncatedValue = truncate(displayValue, maxLen);
          const truncatedPending =
            pendingValue !== undefined
              ? pendingValue === null
                ? "—"
                : pendingValue === ""
                  ? "\"\""
                  : truncate(pendingValue, maxLen)
              : undefined;

          return (
            <box
              key={fileIndex}
              width={width + 1} // +1 for separator
              flexDirection="row"
            >
              {/* Separator */}
              <box width={1} backgroundColor={Colors.border} />
              <box
                width={width}
                paddingLeft={1}
                paddingRight={1}
                {...(isSelectedCell
                  ? { backgroundColor: Colors.selectedBg }
                  : hasPending
                    ? { backgroundColor: Colors.pendingChangeBg }
                    : {})}
              >
                {/* Value - show input when editing this cell */}
                {isEditingThisCell ? (
                  <input
                    ref={inputRef}
                    focused
                    value={editMode.inputValue}
                    onInput={onEditInput}
                    onSubmit={onEditSubmit}
                    onPaste={handlePaste}
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
                        {truncatedPending}
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
