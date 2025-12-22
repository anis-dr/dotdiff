/**
 * Sorting utility functions
 */

/**
 * Sort string keys alphabetically (case-insensitive)
 */
export const sortKeys = (keys: Iterable<string>): Array<string> =>
  Array.from(keys).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
