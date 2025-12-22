/**
 * Footer component - displays clipboard, pending changes, and keybindings
 */
import { useAtomValue } from "@effect-atom/atom-react";
import { appStateAtom, pendingListAtom } from "../state/appState.js";
import { Colors } from "../types.js";
import { truncate, TRUNCATE_CLIPBOARD } from "../utils/index.js";

export function Footer() {
  const state = useAtomValue(appStateAtom);
  const pendingList = useAtomValue(pendingListAtom);
  const { clipboard, conflicts, message } = state;

  const pendingCount = pendingList.length;
  const conflictCount = conflicts.size;

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
            <span fg={Colors.dimText}>📋</span>
            <span fg={clipboard ? Colors.primaryText : Colors.dimText}>
              {clipboardDisplay}
            </span>
          </text>
        </box>

        {/* Pending changes */}
        <box paddingRight={2}>
          <text>
            <span fg={Colors.dimText}>│</span>
            {pendingCount > 0 ?
              (
                <>
                  <span fg={Colors.pendingChange}>✎ {pendingCount}</span>
                  <span fg={Colors.dimText}>pending</span>
                </>
              ) :
              <span fg={Colors.dimText}>✓ synced</span>}
          </text>
        </box>

        {/* Conflicts */}
        {conflictCount > 0 && (
          <box paddingRight={2}>
            <text>
              <span fg={Colors.dimText}>│</span>
              <span fg={Colors.missing}>⚠ {conflictCount}</span>
              <span fg={Colors.dimText}>conflict{conflictCount !== 1 ? "s" : ""}</span>
            </text>
          </box>
        )}

        {/* Message */}
        {message && (
          <box flexGrow={1}>
            <text>
              <span fg={Colors.dimText}>│</span>
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
          <span fg={Colors.secondaryText}>↑↓</span>
          <span fg={Colors.dimText}>nav</span>
          <span fg={Colors.selectedBg}>/</span>
          <span fg={Colors.dimText}>search</span>
          <span fg={Colors.different}>][</span>
          <span fg={Colors.dimText}>diff</span>
          <span fg={Colors.selectedBg}>e</span>
          <span fg={Colors.dimText}>edit</span>
          <span fg={Colors.different}>&lt;&gt;</span>
          <span fg={Colors.dimText}>sync</span>
          <span fg={Colors.pendingChange}>s</span>
          <span fg={Colors.dimText}>save</span>
          <span fg={Colors.missing}>q</span>
          <span fg={Colors.dimText}>quit</span>
          <span fg={Colors.secondaryText}>?</span>
          <span fg={Colors.dimText}>help</span>
        </text>
      </box>
    </box>
  );
}
