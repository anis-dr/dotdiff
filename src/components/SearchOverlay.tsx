/**
 * SearchOverlay component - inline search input
 */
import { useRef, useCallback } from "react";
import type { InputRenderable } from "@opentui/core";
import { Colors } from "../types.js";

interface SearchOverlayProps {
  readonly query: string;
  readonly matchCount: number;
  readonly totalCount: number;
  readonly onInput: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}

export function SearchOverlay({
  query,
  matchCount,
  totalCount,
  onInput,
  onSubmit,
  onCancel,
}: SearchOverlayProps) {
  const inputRef = useRef<InputRenderable>(null);

  const handlePaste = useCallback((e: { text: string }) => {
    inputRef.current?.insertText(e.text);
  }, []);

  return (
    <box
      flexDirection="row"
      backgroundColor={Colors.surface}
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
        value={query}
        onInput={onInput}
        onSubmit={onSubmit}
        onPaste={handlePaste}
        style={{ flexGrow: 1, marginLeft: 1 }}
      />
      <box paddingLeft={2}>
        <text>
          <span fg={matchCount > 0 ? Colors.identical : Colors.missing}>
            {matchCount}
          </span>
          <span fg={Colors.dimText}>/{totalCount}</span>
        </text>
      </box>
    </box>
  );
}

