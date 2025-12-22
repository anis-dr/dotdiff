/**
 * String utility functions
 */

// Re-export the constant from constants.ts for backward compatibility
export { TRUNCATE_CLIPBOARD } from "../constants.js";

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated
 */
export const truncate = (str: string, maxLen: number): string =>
  str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;

/**
 * Format a value for display in the UI
 * Handles null (missing), empty string, and regular values
 */
export const formatDisplayValue = (value: string | null): string =>
  value === null ? "—" : value === "" ? "\"\"" : value;
