/**
 * String utility functions
 */

/** Max length for clipboard display in footer */
export const TRUNCATE_CLIPBOARD = 30;

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated
 */
export const truncate = (str: string, maxLen: number): string =>
  str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;

