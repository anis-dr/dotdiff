/**
 * Footer component - displays clipboard, pending changes, and keybindings
 * When in search mode, replaces keybindings bar with search input
 */
import { useAtomValue } from "@effect-atom/atom-react";
import type { InputRenderable } from "@opentui/core";
import { useCallback, useRef } from "react";
import { appStateAtom, isSearchActiveAtom, pendingListAtom } from "../state/appState.js";
import { Colors } from "../types.js";
import { truncate, TRUNCATE_CLIPBOARD } from "../utils/index.js";
import { Kbd } from "./Kbd.js";

interface KeyHint {
  readonly keys: React.ReactNode;
  readonly label: string;
}

function KeyHint({ keys, label }: KeyHint) {
  return (
    <box paddingRight={2}>
      <text>
        {keys}
        <span fg={Colors.dimText}>{" " + label}</span>
      </text>
    </box>
  );
}

interface FooterProps {
  readonly searchQuery?: string;
  readonly matchCount?: number;
  readonly currentMatchIndex?: number;
  readonly onSearchInput?: (value: string) => void;
}

export function Footer({
  currentMatchIndex = 0,
  matchCount = 0,
  onSearchInput,
  searchQuery = "",
}: FooterProps) {
  const state = useAtomValue(appStateAtom);
  const pendingList = useAtomValue(pendingListAtom);
  const isSearchActive = useAtomValue(isSearchActiveAtom);
  const { clipboard, conflicts, message } = state;

  const inputRef = useRef<InputRenderable>(null);

  const pendingCount = pendingList.length;
  const conflictCount = conflicts.size;

  const clipboardDisplay = clipboard
    ? `${clipboard.key}=${truncate(clipboard.value, TRUNCATE_CLIPBOARD)}`
    : "empty";

  const handlePaste = useCallback((e: { text: string; }) => {
    inputRef.current?.insertText(e.text);
  }, []);

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
            <span fg={Colors.dimText}>{"📋 "}</span>
            <span fg={clipboard ? Colors.primaryText : Colors.dimText}>
              {clipboardDisplay}
            </span>
          </text>
        </box>

        {/* Pending changes */}
        <box paddingRight={2}>
          <text>
            <span fg={Colors.dimText}>{"| "}</span>
            {pendingCount > 0
              ? (
                <>
                  <span fg={Colors.pendingChange}>{"✎ " + pendingCount + " "}</span>
                  <span fg={Colors.dimText}>pending</span>
                </>
              )
              : <span fg={Colors.dimText}>✓ synced</span>}
          </text>
        </box>

        {/* Conflicts */}
        {conflictCount > 0 && (
          <box paddingRight={2}>
            <text>
              <span fg={Colors.dimText}>{"| "}</span>
              <span fg={Colors.missing}>{"⚠ " + conflictCount + " "}</span>
              <span fg={Colors.dimText}>
                {"conflict" + (conflictCount !== 1 ? "s" : "")}
              </span>
            </text>
          </box>
        )}

        {/* Message */}
        {message && (
          <box flexGrow={1}>
            <text>
              <span fg={Colors.dimText}>{"| "}</span>
              <span fg={Colors.selectedBg}>{" " + message}</span>
            </text>
          </box>
        )}
      </box>

      {/* Keybindings bar OR Search bar */}
      {isSearchActive
        ? (
          <box
            flexDirection="row"
            backgroundColor={Colors.headerBg}
            height={1}
            paddingLeft={1}
            paddingRight={1}
            width="100%"
          >
            <text>
              <span fg={Colors.selectedBg}>/</span>
            </text>
            <input
              ref={inputRef}
              focused
              value={searchQuery}
              onInput={onSearchInput ?? (() => {})}
              onPaste={handlePaste}
              style={{ flexGrow: 1, marginLeft: 1 }}
            />
            <box paddingLeft={2}>
              <text>
                <span fg={matchCount > 0 ? Colors.identical : Colors.missing}>
                  {currentMatchIndex > 0 ? `${currentMatchIndex}/${matchCount}` : `${matchCount}`}
                </span>
                <span fg={Colors.dimText}>{" matches"}</span>
              </text>
            </box>
            <box paddingLeft={2}>
              <text>
                <Kbd fg={Colors.dimText} wrap="none">↑↓</Kbd>
                <span fg={Colors.dimText}>{" nav  "}</span>
                <Kbd fg={Colors.dimText} wrap="none">ESC</Kbd>
                <span fg={Colors.dimText}>{" close"}</span>
              </text>
            </box>
          </box>
        )
        : (
          <box
            flexDirection="row"
            backgroundColor={Colors.headerBg}
            height={1}
            paddingLeft={1}
            paddingRight={1}
          >
            {(
              [
                {
                  keys: <Kbd fg={Colors.identical} wrap="none">↑↓</Kbd>,
                  label: "nav",
                },
                {
                  keys: <Kbd fg={Colors.selectedBg} wrap="none">/</Kbd>,
                  label: "search",
                },
                {
                  keys: (
                    <>
                      <Kbd fg={Colors.different} wrap="none">
                        ]
                      </Kbd>
                      <span fg={Colors.dimText}>{" / "}</span>
                      <Kbd fg={Colors.different} wrap="none">
                        [
                      </Kbd>
                    </>
                  ),
                  label: "diff",
                },
                {
                  keys: (
                    <>
                      <Kbd fg={Colors.selectedBg} wrap="none">e</Kbd>
                      <span fg={Colors.dimText}>{" / "}</span>
                      <Kbd fg={Colors.selectedBg} wrap="none">⏎</Kbd>
                    </>
                  ),
                  label: "edit",
                },
                {
                  keys: (
                    <>
                      <Kbd fg={Colors.different} wrap="none">
                        &lt;
                      </Kbd>
                      <span fg={Colors.dimText}>{" / "}</span>
                      <Kbd fg={Colors.different} wrap="none">
                        &gt;
                      </Kbd>
                    </>
                  ),
                  label: "sync",
                },
                {
                  keys: <Kbd fg={Colors.pendingChange} wrap="none">s</Kbd>,
                  label: "save",
                },
                {
                  keys: <Kbd fg={Colors.missing} wrap="none">q</Kbd>,
                  label: "quit",
                },
                {
                  keys: <Kbd fg={Colors.secondaryText} wrap="none">?</Kbd>,
                  label: "help",
                },
              ] satisfies ReadonlyArray<KeyHint>
            ).map((hint) => <KeyHint key={hint.label} {...hint} />)}
          </box>
        )}
    </box>
  );
}
