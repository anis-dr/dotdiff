/**
 * Header component - displays file names and variable counts
 */
import { useAtomValue } from "jotai";
import { Colors } from "../types.js";
import { colWidthsAtom, filesAtom, selectedColAtom } from "../state/atoms.js";

export function Header() {
  const files = useAtomValue(filesAtom);
  const selectedCol = useAtomValue(selectedColAtom);
  const colWidths = useAtomValue(colWidthsAtom);

  return (
    <box flexDirection="row" width="100%">
      {files.map((file, index) => {
        const isSelected = index === selectedCol;
        const varCount = file.variables.size;
        const width = colWidths[index] ?? 20;

        return (
          <box
            key={file.path}
            width={width + (index > 0 ? 1 : 0)}
            height={3}
            flexDirection="row"
          >
            {index > 0 && <box width={1} backgroundColor={Colors.border} />}
            <box
              width={width}
              height={3}
              backgroundColor={isSelected ? Colors.selectedBg : Colors.headerBg}
              paddingLeft={1}
              paddingRight={1}
              justifyContent="center"
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
