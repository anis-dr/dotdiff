/**
 * EnvRow component - displays a single variable row with status and inline editing
 * Layout: [Key/Status column] | [File A value] | [File B value]
 */
import { useAtomValue } from "@effect-atom/atom-react";
import type { InputRenderable } from "@opentui/core";
import { useCallback, useRef } from "react";
import { colWidthsAtom, conflictsAtom, editModeAtom, pendingAtom, pendingKey, selectionAtom } from "../state/index.js";
import type { DiffRow, VariableStatus } from "../types.js";
import { Colors, FileIndex, getVariableStatus } from "../types.js";
import { truncate } from "../utils/index.js";
import { ValueCell } from "./ValueCell.js";

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
  onEditInput,
  onEditSubmit,
  row,
  rowIndex,
}: EnvRowProps) {
  // Use focused atoms for granular re-renders
  const selection = useAtomValue(selectionAtom);
  const pending = useAtomValue(pendingAtom);
  const conflicts = useAtomValue(conflictsAtom);
  const colWidths = useAtomValue(colWidthsAtom);
  const editMode = useAtomValue(editModeAtom);

  const selectedRow = selection.row;
  const selectedCol = selection.col;

  const inputRef = useRef<InputRenderable>(null);

  const isSelectedRow = rowIndex === selectedRow;

  // Check edit modes
  const isEditingValue = editMode?.phase === "editValue" && isSelectedRow;
  const isEditingKey = editMode?.phase === "addKey" && isSelectedRow;

  // Find pending changes for this row
  const pendingByFile = new Map<number, { oldValue: string | null; newValue: string | null; }>();
  for (let i = 0; i < row.values.length; i++) {
    const pKey = pendingKey(row.key, FileIndex.make(i));
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

  // Check for conflicts
  const hasAnyConflict = Array.from(pendingByFile.keys()).some((i) =>
    conflicts.has(pendingKey(row.key, FileIndex.make(i)))
  );

  const handlePaste = useCallback((e: { text: string; }) => {
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
          {isEditingKey && editMode ?
            (
              <box flexDirection="row">
                <text>
                  <span fg={Colors.selectedText}>{icon + " "}</span>
                </text>
                <input
                  ref={inputRef}
                  focused
                  value={editMode.value}
                  onInput={onEditInput}
                  onSubmit={onEditSubmit}
                  onPaste={handlePaste}
                  style={{ width: keyColWidth - 4 }}
                />
              </box>
            ) :
            (
              <text>
                <span fg={color}>{icon + " "}</span>
                {isSelectedRow ?
                  (
                    <b>
                      <span fg={Colors.primaryText}>
                        {truncate(row.key || "(new variable)", keyColWidth - 4)}
                      </span>
                    </b>
                  ) :
                  (
                    <span fg={Colors.primaryText}>
                      {truncate(row.key || "(new variable)", keyColWidth - 4)}
                    </span>
                  )}
                {hasAnyPending && !isEditingKey && (
                  <span
                    fg={hasAnyConflict && isSelectedRow
                      ? Colors.primaryText
                      : hasAnyConflict
                      ? Colors.missing
                      : Colors.pendingChange}
                  >
                    {hasAnyConflict ? " ⚠" : " ✎"}
                  </span>
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
          const hasConflict = conflicts.has(pendingKey(row.key, FileIndex.make(fileIndex)));
          const width = colWidths[fileIndex + 1] ?? 20;

          return (
            <ValueCell
              key={fileIndex}
              value={value}
              fileIndex={fileIndex}
              width={width}
              isSelectedCell={isSelectedCell}
              isEditing={isEditingThisCell}
              hasPending={hasPending}
              hasConflict={hasConflict}
              pendingValue={pendingChange?.newValue}
              editMode={editMode}
              inputRef={inputRef}
              onEditInput={onEditInput}
              onEditSubmit={onEditSubmit}
              onPaste={handlePaste}
            />
          );
        })}
      </box>
    </box>
  );
}
