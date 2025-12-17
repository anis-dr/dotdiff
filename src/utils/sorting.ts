/**
 * Sorting utility functions
 */

/**
 * Sort items alphabetically by a string key (case-insensitive)
 */
export const sortAlphabetically = <T>(
  items: ReadonlyArray<T>,
  getKey: (item: T) => string
): T[] =>
  [...items].sort((a, b) =>
    getKey(a).toLowerCase().localeCompare(getKey(b).toLowerCase())
  );

/**
 * Sort string keys alphabetically (case-insensitive)
 */
export const sortKeys = (keys: Iterable<string>): string[] =>
  Array.from(keys).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

