/**
 * EnvRow component - displays a single variable row with status and inline editing
 * Layout: [Key/Status column] | [File A value] | [File B value]
 */
import { useCallback, useRef } from "react";
import { useAtomValue } from "jotai";
import type { InputRenderable } from "@opentui/core";
import type { DiffRow, VariableStatus } from "../types.js";
import { Colors, getVariableStatus } from "../types.js";
import { truncate } from "../utils/index.js";
import { appStateAtom, pendingKey } from "../state/appState.js";

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
  const state = useAtomValue(appStateAtom);
  const { selection, pending, colWidths, editMode } = state;
  const selectedRow = selection.row;
  const selectedCol = selection.col;

  const inputRef = useRef<InputRenderable>(null);

  const isSelectedRow = rowIndex === selectedRow;

  // Check edit modes
  const isEditingValue = editMode?.phase === "editValue" && isSelectedRow;
  const isEditingKey = editMode?.phase === "addKey" && isSelectedRow;

  // Find pending changes for this row
  const pendingByFile = new Map<number, { oldValue: string | null; newValue: string | null }>();
  for (let i = 0; i < (row.values.length); i++) {
    const pKey = pendingKey(row.key, i);
    const change = pending.get(pKey);
    if (change) {
      pendingByFile.set(i, { oldValue: change.oldValue, newValue: change.newValue });
    }
  }

  // Compute effective values (original + pending changes) for status calculation
  const effectiveValues = row.values.map((value, i) => {
    const pendingChange = pendingByFile.get(i);
    return pendingChange !== undefined ? pendingChange.newValue : value;
  });
  const effectiveStatus = pendingByFile.size > 0 ? getVariableStatus(effectiveValues) : row.status;
  const icon = statusIcon[effectiveStatus];
  const color = statusColor[effectiveStatus];

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
        backgroundColor={isSelectedRow ? Colors.selectedRowBg : Colors.background}
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
              <span fg={color}>{icon} </span>
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
                <span fg={Colors.pendingChange}> ✎</span>
              )}
            </text>
          )}
        </box>

        {/* Value columns (one per file) */}
        {row.values.map((value, fileIndex) => {
          const isSelectedCell = isSelectedRow && fileIndex === selectedCol;
          const isEditingThisCell = isEditingValue && isSelectedCell;
          const pendingChange = pendingByFile.get(fileIndex);
          const hasPending = pendingChange !== undefined;
          const width = colWidths[fileIndex + 1] ?? 20;

          const displayValue = value === null ? "—" : value === "" ? '""' : value;
          const pendingValue = pendingChange?.newValue;

          const maxLen = width - 2;
          const truncatedValue = truncate(displayValue, maxLen);
          const truncatedPending =
            pendingValue !== undefined
              ? pendingValue === null
                ? "—"
                : pendingValue === ""
                  ? '""'
                  : truncate(pendingValue, maxLen)
              : undefined;

          return (
            <box key={fileIndex} width={width + 1} flexDirection="row">
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
                        fg={isSelectedCell ? Colors.selectedText : Colors.pendingChange}
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
