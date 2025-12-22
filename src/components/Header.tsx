/**
 * Header component - displays key column header and file names with counts
 * Layout: [Key] | [File A] | [File B]
 */
import { useAtomValue } from "@effect-atom/atom-react";
import { appStateAtom } from "../state/appState.js";
import { Colors } from "../types.js";

export function Header() {
  const state = useAtomValue(appStateAtom);
  const { colWidths, files, selection } = state;
  const selectedCol = selection.col;

  const keyColWidth = colWidths[0] ?? 20;

  return (
    <box flexDirection="row" width="100%">
      {/* Key column header */}
      <box
        width={keyColWidth}
        height={1}
        backgroundColor={Colors.headerBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text>
          <b>
            <span fg={Colors.primaryText}>Key</span>
          </b>
        </text>
      </box>

      {/* File column headers */}
      {files.map((file, index) => {
        const isSelected = index === selectedCol;
        const varCount = file.variables.size;
        const width = colWidths[index + 1] ?? 20;

        return (
          <box
            key={file.path}
            width={width + 1}
            height={1}
            flexDirection="row"
          >
            <box width={1} backgroundColor={Colors.border} />
            <box
              width={width}
              height={1}
              backgroundColor={isSelected ? Colors.selectedBg : Colors.headerBg}
              paddingLeft={1}
              paddingRight={1}
            >
              <text>
                <b>
                  <span
                    fg={isSelected ? Colors.selectedText : Colors.primaryText}
                  >
                    {file.filename}
                  </span>
                </b>
                <span fg={isSelected ? Colors.selectedText : Colors.dimText}>
                  {" "}
                  ({varCount})
                </span>
              </text>
            </box>
          </box>
        );
      })}
    </box>
  );
}
