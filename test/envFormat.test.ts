/**
 * Tests for envFormat - patch-based .env file handling
 */
import { describe, expect, test } from "bun:test";
import {
  parseEnvLines,
  buildAssignmentLine,
  patchEnvContent,
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

