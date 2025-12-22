/**
 * Sorting utility functions
 */

/**
 * Sort string keys alphabetically (case-insensitive)
 */
export const sortKeys = (keys: Iterable<string>): string[] =>
  Array.from(keys).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

