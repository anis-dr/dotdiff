/**
 * ValueCell component - displays a single value cell in the diff view
 * Extracted from EnvRow to reduce JSX nesting
 */
import type { InputRenderable } from "@opentui/core";
import type { RefObject } from "react";
import type { AppMode } from "../types.js";
import { Colors } from "../types.js";
import { formatDisplayValue, truncate } from "../utils/index.js";

interface ValueCellProps {
  readonly value: string | null;
  readonly fileIndex: number;
  readonly width: number;
  readonly isSelectedCell: boolean;
  readonly isEditing: boolean;
  readonly hasPending: boolean;
  readonly hasConflict: boolean;
  readonly pendingValue: string | null | undefined;
  readonly editMode: Extract<AppMode, { readonly _tag: "Edit"; }> | null;
  readonly inputRef: RefObject<InputRenderable | null>;
  readonly onEditInput: (value: string) => void;
  readonly onEditSubmit: (value?: string) => void;
  readonly onPaste: (e: { text: string; }) => void;
}

export function ValueCell({
  editMode,
  fileIndex,
  hasConflict,
  hasPending,
  inputRef,
  isEditing,
  isSelectedCell,
  onEditInput,
  onEditSubmit,
  onPaste,
  pendingValue,
  value,
  width,
}: ValueCellProps) {
  const maxLen = width - 2;
  const truncatedValue = truncate(formatDisplayValue(value), maxLen);
  const truncatedPending = pendingValue !== undefined
    ? truncate(formatDisplayValue(pendingValue), maxLen)
    : undefined;

  // Determine background color
  const backgroundColor = isSelectedCell
    ? Colors.selectedBg
    : hasPending
    ? Colors.pendingChangeBg
    : undefined;

  return (
    <box key={fileIndex} width={width + 1} flexDirection="row">
      {/* Separator */}
      <box width={1} backgroundColor={Colors.border} />
      <box
        width={width}
        paddingLeft={1}
        paddingRight={1}
        {...(backgroundColor ? { backgroundColor } : {})}
      >
        {isEditing && editMode ?
          (
            <input
              ref={inputRef}
              focused
              value={editMode.value}
              onInput={onEditInput}
              onSubmit={onEditSubmit}
              onPaste={onPaste}
              style={{ width: width - 2 }}
            />
          ) :
          (
            <ValueText
              hasPending={hasPending}
              hasConflict={hasConflict}
              isSelectedCell={isSelectedCell}
              truncatedPending={truncatedPending}
              truncatedValue={truncatedValue}
              value={value}
            />
          )}
      </box>
    </box>
  );
}

/** Text display for a value cell (pending or original) */
interface ValueTextProps {
  readonly hasPending: boolean;
  readonly hasConflict: boolean;
  readonly isSelectedCell: boolean;
  readonly truncatedPending: string | undefined;
  readonly truncatedValue: string;
  readonly value: string | null;
}

function ValueText({
  hasConflict,
  hasPending,
  isSelectedCell,
  truncatedPending,
  truncatedValue,
  value,
}: ValueTextProps) {
  if (hasPending) {
    const textColor = isSelectedCell
      ? Colors.selectedText
      : hasConflict
      ? Colors.missing
      : Colors.pendingChange;

    return (
      <text>
        <span fg={textColor}>{truncatedPending}</span>
        {hasConflict && <span fg={isSelectedCell ? Colors.selectedText : Colors.missing}>{" "}⚠</span>}
      </text>
    );
  }

  const textColor = isSelectedCell
    ? Colors.selectedText
    : value === null
    ? Colors.missing
    : Colors.secondaryText;

  return (
    <text>
      <span fg={textColor}>{truncatedValue}</span>
    </text>
  );
}
