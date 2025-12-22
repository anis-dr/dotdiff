/**
 * Shared types for env-differ TUI application
 * 
 * Uses Effect Schema for runtime validation and branded types for type safety.
 */
import { Schema } from "effect";

// =============================================================================
// Branded Types
// =============================================================================

/** Branded type for environment variable keys */
export const EnvKey = Schema.String.pipe(Schema.brand("EnvKey"));
export type EnvKey = typeof EnvKey.Type;

/** Branded type for file indices (0-based) */
export const FileIndex = Schema.Int.pipe(
  Schema.nonNegative(),
  Schema.brand("FileIndex")
);
export type FileIndex = typeof FileIndex.Type;

/** Branded type for file paths */
export const FilePath = Schema.String.pipe(Schema.brand("FilePath"));
export type FilePath = typeof FilePath.Type;

// =============================================================================
// Status Variant
// =============================================================================

/** Status of a variable across all files */
export const VariableStatus = Schema.Literal("identical", "different", "missing");
export type VariableStatus = typeof VariableStatus.Type;

// =============================================================================
// Domain Models
// =============================================================================

/** Parsed environment file */
export class EnvFile extends Schema.Class<EnvFile>("EnvFile")({
  path: FilePath,
  filename: Schema.String,
  variables: Schema.ReadonlyMap({ key: Schema.String, value: Schema.String }),
}) {}

/** A single row in the diff view */
export class DiffRow extends Schema.Class<DiffRow>("DiffRow")({
  key: Schema.String,
  values: Schema.Array(Schema.NullOr(Schema.String)),
  status: VariableStatus,
}) {}

/** Clipboard state for copy/paste */
export class Clipboard extends Schema.Class<Clipboard>("Clipboard")({
  key: Schema.String,
  value: Schema.String,
}) {}

/** A pending change to be applied */
export class PendingChange extends Schema.Class<PendingChange>("PendingChange")({
  key: Schema.String,
  fileIndex: Schema.Number,
  oldValue: Schema.NullOr(Schema.String),
  newValue: Schema.NullOr(Schema.String),
}) {}

/** Edit mode phase */
export const EditPhase = Schema.Literal("editValue", "addKey");
export type EditPhase = typeof EditPhase.Type;

/** Edit mode state */
export class EditMode extends Schema.Class<EditMode>("EditMode")({
  phase: EditPhase,
  inputValue: Schema.String,
  dirty: Schema.optional(Schema.Boolean),
  isNewRow: Schema.optional(Schema.Boolean),
}) {}

/** Search state */
export class SearchState extends Schema.Class<SearchState>("SearchState")({
  active: Schema.Boolean,
  query: Schema.String,
}) {}

/** Modal types */
export const ModalType = Schema.Literal("quit", "save", "help");
export type ModalType = typeof ModalType.Type;

/** Modal state */
export class ModalState extends Schema.Class<ModalState>("ModalState")({
  type: ModalType,
  data: Schema.optional(Schema.Unknown),
}) {}

// =============================================================================
// Helper Functions
// =============================================================================

/** Determine the status of a variable across all files */
export const getVariableStatus = (values: ReadonlyArray<string | null>): VariableStatus => {
  const nonNullValues = values.filter((v): v is string => v !== null);
  if (nonNullValues.length < values.length) {
    return "missing";
  }
  const firstValue = nonNullValues[0];
  return nonNullValues.every((v) => v === firstValue) ? "identical" : "different";
};

// =============================================================================
// UI Constants
// =============================================================================

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
  pendingChangeBg: "#3D2F1F", // dark amber/brown

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
