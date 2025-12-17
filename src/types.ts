/**
 * Shared types for env-differ TUI application
 */

/** Status of a variable across all files */
export type VariableStatus = "identical" | "different" | "missing";

/** Parsed environment file */
export interface EnvFile {
  readonly path: string;
  readonly filename: string;
  readonly variables: ReadonlyMap<string, string>;
}

/** A single row in the diff view */
export interface DiffRow {
  readonly key: string;
  readonly values: ReadonlyArray<string | null>; // null = missing in that file
  readonly status: VariableStatus;
}

/** Clipboard state for copy/paste */
export interface Clipboard {
  readonly key: string;
  readonly value: string;
}

/** A pending change to be applied */
export interface PendingChange {
  readonly key: string;
  readonly fileIndex: number;
  readonly oldValue: string | null;
  readonly newValue: string | null; // null = deletion
  readonly isNew?: boolean; // true = adding new variable
}

/** Edit mode state */
export interface EditMode {
  readonly phase: "editValue" | "addKey" | "addValue";
  readonly inputValue: string;
  readonly newKey?: string; // when adding, stores the key being added
}

/** Application state */
export interface AppState {
  readonly files: ReadonlyArray<EnvFile>;
  readonly diffRows: ReadonlyArray<DiffRow>;
  readonly selectedRow: number;
  readonly selectedCol: number;
  readonly clipboard: Clipboard | null;
  readonly pendingChanges: ReadonlyArray<PendingChange>;
}

/** Determine the status of a variable across all files */
export const getVariableStatus = (values: ReadonlyArray<string | null>): VariableStatus => {
  const nonNullValues = values.filter((v): v is string => v !== null);
  if (nonNullValues.length < values.length) {
    return "missing";
  }
  const firstValue = nonNullValues[0];
  return nonNullValues.every((v) => v === firstValue) ? "identical" : "different";
};

/** Colors - Dark theme with amber/orange accents */
export const Colors = {
  // Status colors
  identical: "#4ADE80", // bright green
  different: "#FBBF24", // amber
  missing: "#F87171", // soft red

  // Selection colors
  selectedBg: "#D97706", // amber-600
  selectedText: "#1C1917", // dark for contrast
  selectedRowBg: "#292524", // stone-800

  // Pending change
  pendingChange: "#FB923C", // orange-400

  // General UI
  dimText: "#78716C", // stone-500
  border: "#44403C", // stone-700
  background: "#1C1917", // stone-900
  surface: "#292524", // stone-800
  headerBg: "#44403C", // stone-700

  // Text
  primaryText: "#F5F5F4", // stone-100
  secondaryText: "#A8A29E", // stone-400
} as const;
