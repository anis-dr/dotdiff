/**
 * Tests for envFormat - patch-based .env file handling
 */
import { describe, expect, test } from "bun:test";
import {
  parseEnvLines,
  buildAssignmentLine,
  patchEnvContent,
  parseEnvToMap,
  applyEnvChanges,
} from "../src/services/envFormat.js";

describe("parseEnvLines", () => {
  test("parses simple assignments", () => {
    const content = `KEY1=value1
KEY2=value2`;
    const lines = parseEnvLines(content);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "KEY1",
      value: "value1",
    });
    expect(lines[1]).toMatchObject({
      type: "assignment",
      key: "KEY2",
      value: "value2",
    });
  });

  test("preserves comments", () => {
    const content = `# This is a comment
KEY=value
# Another comment`;
    const lines = parseEnvLines(content);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ type: "comment", raw: "# This is a comment" });
    expect(lines[1]).toMatchObject({ type: "assignment", key: "KEY" });
    expect(lines[2]).toMatchObject({ type: "comment", raw: "# Another comment" });
  });

  test("preserves blank lines", () => {
    const content = `KEY1=value1

KEY2=value2`;
    const lines = parseEnvLines(content);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ type: "assignment", key: "KEY1" });
    expect(lines[1]).toMatchObject({ type: "blank", raw: "" });
    expect(lines[2]).toMatchObject({ type: "assignment", key: "KEY2" });
  });

  test("handles quoted values", () => {
    const content = `DOUBLE="hello world"
SINGLE='another value'`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({ type: "assignment", key: "DOUBLE", value: "hello world" });
    expect(lines[1]).toMatchObject({ type: "assignment", key: "SINGLE", value: "another value" });
  });

  test("handles export prefix", () => {
    const content = `export API_KEY=secret123`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "API_KEY",
      value: "secret123",
    });
  });

  test("handles inline comments for unquoted values", () => {
    const content = `KEY=value # this is a comment`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "KEY",
      value: "value",
    });
  });
});

describe("buildAssignmentLine", () => {
  test("simple values without quotes", () => {
    expect(buildAssignmentLine("KEY", "value")).toBe("KEY=value");
  });

  test("quotes values with spaces", () => {
    expect(buildAssignmentLine("KEY", "hello world")).toBe('KEY="hello world"');
  });

  test("quotes empty values", () => {
    expect(buildAssignmentLine("KEY", "")).toBe('KEY=""');
  });

  test("escapes quotes in values", () => {
    expect(buildAssignmentLine("KEY", 'say "hello"')).toBe('KEY="say \\"hello\\""');
  });
});

describe("patchEnvContent", () => {
  test("modifies existing key in place", () => {
    const original = `# Config
KEY1=old1
KEY2=old2
`;
    const changes = new Map([["KEY1", "new1"]]);
    const result = patchEnvContent(original, changes);

    expect(result).toBe(`# Config
KEY1=new1
KEY2=old2
`);
  });

  test("preserves comments and blank lines", () => {
    const original = `# Header comment

KEY1=value1

# Section
KEY2=value2
`;
    const changes = new Map([["KEY2", "modified"]]);
    const result = patchEnvContent(original, changes);

    expect(result).toBe(`# Header comment

KEY1=value1

# Section
KEY2=modified
`);
  });

  test("deletes keys", () => {
    const original = `KEY1=value1
KEY2=value2
KEY3=value3
`;
    const changes = new Map<string, string | null>([["KEY2", null]]);
    const result = patchEnvContent(original, changes);

    expect(result).toBe(`KEY1=value1
KEY3=value3
`);
  });

  test("adds new keys at end", () => {
    const original = `# Existing
KEY1=value1
`;
    const changes = new Map<string, string | null>();
    const additions = new Map([["NEW_KEY", "new_value"]]);
    const result = patchEnvContent(original, changes, additions);

    expect(result).toBe(`# Existing
KEY1=value1
NEW_KEY=new_value
`);
  });

  test("handles mixed operations", () => {
    const original = `# Config file
API_URL=https://old.example.com
DB_HOST=localhost
DEBUG=true
# End
`;
    const changes = new Map<string, string | null>([
      ["API_URL", "https://new.example.com"],
      ["DEBUG", null], // delete
    ]);
    const additions = new Map([["NEW_VAR", "added"]]);
    const result = patchEnvContent(original, changes, additions);

    expect(result).toBe(`# Config file
API_URL=https://new.example.com
DB_HOST=localhost
# End
NEW_VAR=added
`);
  });

  test("preserves original indentation and formatting", () => {
    const original = `  KEY_WITH_SPACE = value with space  
KEY2=normal
`;
    const changes = new Map([["KEY2", "changed"]]);
    const result = patchEnvContent(original, changes);

    // First line preserved as-is, second line replaced
    expect(result).toContain("  KEY_WITH_SPACE = value with space  ");
    expect(result).toContain("KEY2=changed");
  });
});

// =============================================================================
// Additional tests for parseEnvToMap
// =============================================================================

describe("parseEnvToMap", () => {
  test("converts content to Map", () => {
    const content = `KEY1=value1
KEY2=value2
KEY3=value3
`;
    const result = parseEnvToMap(content);

    expect(result.size).toBe(3);
    expect(result.get("KEY1")).toBe("value1");
    expect(result.get("KEY2")).toBe("value2");
    expect(result.get("KEY3")).toBe("value3");
  });

  test("handles duplicates (last wins)", () => {
    const content = `KEY=first
KEY=second
KEY=third
`;
    const result = parseEnvToMap(content);

    expect(result.size).toBe(1);
    expect(result.get("KEY")).toBe("third");
  });

  test("ignores comments and blank lines", () => {
    const content = `# Comment
KEY1=value1

# Another comment
KEY2=value2
`;
    const result = parseEnvToMap(content);

    expect(result.size).toBe(2);
    expect(result.has("# Comment")).toBe(false);
  });

  test("handles empty content", () => {
    const result = parseEnvToMap("");
    expect(result.size).toBe(0);
  });

  test("handles content with only comments", () => {
    const content = `# Just a comment
# Another one
`;
    const result = parseEnvToMap(content);
    expect(result.size).toBe(0);
  });
});

// =============================================================================
// Additional tests for applyEnvChanges
// =============================================================================

describe("applyEnvChanges", () => {
  test("applies modifications to existing keys", () => {
    const lines = parseEnvLines("KEY1=old1\nKEY2=old2\n");
    const changes = new Map<string, string | null>([["KEY1", "new1"]]);
    const additions = new Map<string, string>();

    const result = applyEnvChanges(lines, changes, additions);
    expect(result).toContain("KEY1=new1");
    expect(result).toContain("KEY2=old2");
  });

  test("deletes keys with null value", () => {
    const lines = parseEnvLines("KEEP=value\nDELETE=gone\n");
    const changes = new Map<string, string | null>([["DELETE", null]]);
    const additions = new Map<string, string>();

    const result = applyEnvChanges(lines, changes, additions);
    expect(result).toContain("KEEP=value");
    expect(result).not.toContain("DELETE");
  });

  test("adds new keys from additions map", () => {
    const lines = parseEnvLines("EXISTING=value\n");
    const changes = new Map<string, string | null>();
    const additions = new Map([["NEW", "added"]]);

    const result = applyEnvChanges(lines, changes, additions);
    expect(result).toContain("EXISTING=value");
    expect(result).toContain("NEW=added");
  });

  test("adds before trailing blank lines", () => {
    const lines = parseEnvLines("KEY=value\n\n\n");
    const changes = new Map<string, string | null>();
    const additions = new Map([["NEW", "added"]]);

    const result = applyEnvChanges(lines, changes, additions);
    // NEW should be added before trailing blanks
    const newIndex = result.indexOf("NEW=added");
    const lastBlankIndex = result.lastIndexOf("\n\n");
    expect(newIndex).toBeLessThan(lastBlankIndex);
  });

  test("ensures file ends with newline", () => {
    const lines = parseEnvLines("KEY=value");
    const changes = new Map<string, string | null>();
    const additions = new Map<string, string>();

    const result = applyEnvChanges(lines, changes, additions);
    expect(result.endsWith("\n")).toBe(true);
  });

  test("does not add duplicate from additions if already modified", () => {
    const lines = parseEnvLines("KEY=original\n");
    const changes = new Map<string, string | null>([["KEY", "modified"]]);
    const additions = new Map([["KEY", "from_additions"]]); // shouldn't be added again

    const result = applyEnvChanges(lines, changes, additions);
    // KEY should only appear once, with value "modified"
    expect(result.match(/KEY=/g)?.length).toBe(1);
    expect(result).toContain("KEY=modified");
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("parseEnvLines edge cases", () => {
  test("handles special characters in values", () => {
    const content = `URL=https://example.com?foo=bar&baz=qux
PASSWORD="p@ss!word#123"
`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "URL",
      value: "https://example.com?foo=bar&baz=qux",
    });
    // Quoted value preserves # character
    expect(lines[1]).toMatchObject({
      type: "assignment",
      key: "PASSWORD",
      value: "p@ss!word#123",
    });
  });

  test("handles inline comment in unquoted values", () => {
    const content = `KEY=value #this is stripped
`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "KEY",
      value: "value",  // # starts inline comment for unquoted
    });
  });

  test("handles unicode in values", () => {
    const content = `GREETING=Hello 世界 🌍
MESSAGE=Привет мир
`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "GREETING",
      value: "Hello 世界 🌍",
    });
    expect(lines[1]).toMatchObject({
      type: "assignment",
      key: "MESSAGE",
      value: "Привет мир",
    });
  });

  test("handles very long values", () => {
    const longValue = "x".repeat(10000);
    const content = `LONG_KEY=${longValue}\n`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "LONG_KEY",
      value: longValue,
    });
  });

  test("handles equals sign in quoted values", () => {
    const content = `CONNECTION="host=localhost;port=5432"
FORMULA='a=b+c'
`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "CONNECTION",
      value: "host=localhost;port=5432",
    });
    expect(lines[1]).toMatchObject({
      type: "assignment",
      key: "FORMULA",
      value: "a=b+c",
    });
  });

  test("handles empty value without quotes", () => {
    const content = `EMPTY=
ANOTHER=value
`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "EMPTY",
      value: "",
    });
  });

  test("handles keys with underscores and numbers", () => {
    const content = `MY_VAR_123=value
_PRIVATE=secret
A1B2C3=test
`;
    const lines = parseEnvLines(content);

    expect(lines[0]).toMatchObject({ type: "assignment", key: "MY_VAR_123" });
    expect(lines[1]).toMatchObject({ type: "assignment", key: "_PRIVATE" });
    expect(lines[2]).toMatchObject({ type: "assignment", key: "A1B2C3" });
  });

  test("treats lines starting with numbers as unknown", () => {
    const content = `123KEY=invalid
`;
    const lines = parseEnvLines(content);

    expect(lines[0]?.type).toBe("unknown");
  });

  test("handles Windows line endings (CRLF)", () => {
    const content = "KEY1=value1\r\nKEY2=value2\r\n";
    const lines = parseEnvLines(content);

    // The \r will be part of raw/value but parsing should still work
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]?.key).toBe("KEY1");
  });

  test("handles file without trailing newline", () => {
    const content = "KEY=value";
    const lines = parseEnvLines(content);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      type: "assignment",
      key: "KEY",
      value: "value",
    });
  });
});

describe("buildAssignmentLine edge cases", () => {
  test("quotes values with hash character", () => {
    expect(buildAssignmentLine("KEY", "value#comment")).toBe('KEY="value#comment"');
  });

  test("quotes values with backslash", () => {
    expect(buildAssignmentLine("KEY", "path\\to\\file")).toBe('KEY="path\\\\to\\\\file"');
  });

  test("handles single quotes in values", () => {
    expect(buildAssignmentLine("KEY", "it's working")).toBe('KEY="it\'s working"');
  });

  test("handles newlines in value by quoting", () => {
    // Newlines are treated as whitespace requiring quotes
    expect(buildAssignmentLine("KEY", "line1\nline2")).toBe('KEY="line1\nline2"');
  });
});

