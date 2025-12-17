/**
 * Footer component - displays clipboard, pending changes, and keybindings
 */
import { useAtomValue } from "jotai";
import { Colors } from "../types.js";
import { truncate, TRUNCATE_CLIPBOARD } from "../utils/index.js";
import {
  clipboardAtom,
  messageAtom,
  pendingChangesAtom,
} from "../state/atoms.js";

export function Footer() {
  const clipboard = useAtomValue(clipboardAtom);
  const pendingChanges = useAtomValue(pendingChangesAtom);
  const message = useAtomValue(messageAtom);

  const pendingCount = pendingChanges.length;

  // Truncate long clipboard values
  const clipboardDisplay = clipboard
    ? `${clipboard.key}=${truncate(clipboard.value, TRUNCATE_CLIPBOARD)}`
    : "empty";

  return (
    <box flexDirection="column" width="100%">
      {/* Status bar */}
      <box
        flexDirection="row"
        backgroundColor={Colors.surface}
        height={1}
        width="100%"
      >
        {/* Clipboard indicator */}
        <box paddingLeft={1} paddingRight={2}>
          <text>
            <span fg={Colors.dimText}>📋 </span>
            <span fg={clipboard ? Colors.primaryText : Colors.dimText}>
              {clipboardDisplay}
            </span>
          </text>
        </box>

        {/* Pending changes */}
        <box paddingRight={2}>
          <text>
            <span fg={Colors.dimText}>│ </span>
            {pendingCount > 0 ? (
              <>
                <span fg={Colors.pendingChange}>✎ {pendingCount}</span>
                <span fg={Colors.dimText}> pending</span>
              </>
            ) : (
              <span fg={Colors.dimText}>✓ synced</span>
            )}
          </text>
        </box>

        {/* Message */}
        {message && (
          <box flexGrow={1}>
            <text>
              <span fg={Colors.dimText}>│ </span>
              <span fg={Colors.selectedBg}>{message}</span>
            </text>
          </box>
        )}
      </box>

      {/* Keybindings bar */}
      <box
        flexDirection="row"
        backgroundColor={Colors.headerBg}
        height={1}
        paddingLeft={1}
        paddingRight={1}
      >
        <text>
          <span fg={Colors.secondaryText}>↑↓←→</span>
          <span fg={Colors.dimText}> nav </span>
          <span fg={Colors.selectedBg}>e</span>
          <span fg={Colors.dimText}> edit </span>
          <span fg={Colors.identical}>a</span>
          <span fg={Colors.dimText}> add </span>
          <span fg={Colors.missing}>d</span>
          <span fg={Colors.dimText}> del </span>
          <span fg={Colors.different}>c</span>
          <span fg={Colors.dimText}> copy </span>
          <span fg={Colors.different}>v</span>
          <span fg={Colors.dimText}> paste </span>
          <span fg={Colors.pendingChange}>u</span>
          <span fg={Colors.dimText}> undo </span>
          <span fg={Colors.selectedBg}>s</span>
          <span fg={Colors.dimText}> save </span>
          <span fg={Colors.missing}>q</span>
          <span fg={Colors.dimText}> quit</span>
        </text>
      </box>
    </box>
  );
}
