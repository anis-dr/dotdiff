/**
 * envFormat - utilities for parsing and patching .env files while preserving formatting
 *
 * Key design: parse file into line records, then patch only the lines that need changes.
 */

/** Types of lines in an .env file */
export type EnvLineType = "assignment" | "comment" | "blank" | "unknown";

/** A single line record from an .env file */
export interface EnvLine {
  readonly type: EnvLineType;
  readonly raw: string; // Original line content (preserved byte-for-byte)
  readonly key?: string; // Only for assignment lines
  readonly value?: string; // Only for assignment lines (parsed value, without quotes)
}

/**
 * Parse an .env file content into line records
 * Preserves the original raw content for each line
 */
export function parseEnvLines(content: string): Array<EnvLine> {
  const lines = content.split("\n");
  // If file ends with a newline, split() creates a trailing empty element.
  // That element is not an actual \"blank line\"; it just represents the final line ending.
  // Remove exactly one trailing empty to avoid injecting phantom blank lines on patch.
  if (content.endsWith("\n")) {
    lines.pop();
  }
  const result: Array<EnvLine> = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();

    // Blank line
    if (trimmed === "") {
      result.push({ type: "blank", raw });
      continue;
    }

    // Comment line
    if (trimmed.startsWith("#")) {
      result.push({ type: "comment", raw });
      continue;
    }

    // Try to parse as assignment
    const assignment = parseAssignment(raw);
    if (assignment) {
      result.push({
        type: "assignment",
        raw,
        key: assignment.key,
        value: assignment.value,
      });
      continue;
    }

    // Unknown line (preserve as-is)
    result.push({ type: "unknown", raw });
  }

  return result;
}

/**
 * Parse a single line as a KEY=VALUE assignment
 * Handles: KEY=VALUE, KEY="VALUE", KEY='VALUE', export KEY=VALUE
 */
function parseAssignment(
  line: string,
): { key: string; value: string; } | null {
  let trimmed = line.trim();

  // Handle 'export' prefix
  if (trimmed.startsWith("export ")) {
    trimmed = trimmed.slice(7).trim();
  }

  // Find the first = sign
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, eqIndex).trim();
  if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  let value = trimmed.slice(eqIndex + 1);

  // Handle quoted values
  const trimmedValue = value.trim();
  if (
    (trimmedValue.startsWith("\"") && trimmedValue.endsWith("\"")) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    value = trimmedValue.slice(1, -1);
  } else {
    // Handle inline comments (only for unquoted values)
    const commentIndex = value.indexOf(" #");
    if (commentIndex !== -1) {
      value = value.slice(0, commentIndex);
    }
    value = value.trim();
  }

  return { key, value };
}

/**
 * Build a new assignment line for a key=value pair
 * Quotes values that contain special characters
 */
export function buildAssignmentLine(key: string, value: string): string {
  // Quote values that contain spaces, #, quotes, or special characters
  const needsQuotes = /[\s#"'\\]/.test(value) || value === "";
  if (needsQuotes) {
    const escapedValue = value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    return `${key}="${escapedValue}"`;
  }
  return `${key}=${value}`;
}

/**
 * Apply changes to parsed env lines and return the new content
 *
 * Changes:
 * - modify: find the line with the matching key and replace it
 * - delete: find the line with the matching key and remove it
 * - add: append new lines at the end (before any trailing blank lines)
 *
 * @param lines - Parsed env lines
 * @param changes - Map of key -> new value (null = delete, undefined = no change)
 * @param additions - Keys to add with their values (keys that don't exist in original)
 * @returns New file content as a string
 */
export function applyEnvChanges(
  lines: Array<EnvLine>,
  changes: Map<string, string | null>,
  additions: Map<string, string>,
): string {
  const resultLines: Array<string> = [];
  const handledKeys = new Set<string>();

  for (const line of lines) {
    if (line.type === "assignment" && line.key) {
      const newValue = changes.get(line.key);

      if (newValue === null) {
        // Delete: skip this line
        handledKeys.add(line.key);
        continue;
      }

      if (newValue !== undefined) {
        // Modify: replace with new value
        resultLines.push(buildAssignmentLine(line.key, newValue));
        handledKeys.add(line.key);
        continue;
      }
    }

    // Keep line as-is
    resultLines.push(line.raw);
  }

  // Add new keys at the end, but *before* any trailing blank lines
  let insertAt = resultLines.length;
  while (insertAt > 0 && resultLines[insertAt - 1]!.trim() === "") {
    insertAt--;
  }
  const additionLines: Array<string> = [];
  for (const [key, value] of additions) {
    if (!handledKeys.has(key)) {
      additionLines.push(buildAssignmentLine(key, value));
    }
  }
  if (additionLines.length > 0) {
    resultLines.splice(insertAt, 0, ...additionLines);
  }

  // Ensure file ends with newline
  let content = resultLines.join("\n");
  if (content.length > 0 && !content.endsWith("\n")) {
    content += "\n";
  }

  return content;
}

/**
 * Convenience function: read content, apply changes, return new content
 */
export function patchEnvContent(
  originalContent: string,
  changes: Map<string, string | null>,
  additions: Map<string, string> = new Map(),
): string {
  const lines = parseEnvLines(originalContent);
  return applyEnvChanges(lines, changes, additions);
}

/**
 * Parse .env file content into a key-value Map
 * This is a convenience wrapper around parseEnvLines for cases where
 * you only need the variables without line-by-line structure.
 */
export function parseEnvToMap(content: string): Map<string, string> {
  const variables = new Map<string, string>();
  for (const line of parseEnvLines(content)) {
    if (line.type === "assignment" && line.key !== undefined && line.value !== undefined) {
      variables.set(line.key, line.value);
    }
  }
  return variables;
}
