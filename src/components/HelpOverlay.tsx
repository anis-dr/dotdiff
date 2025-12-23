/**
 * HelpOverlay component - shows all keybindings
 */
import { Colors } from "../types.js";
import { Kbd } from "./Kbd.js";
import { Modal } from "./Modal.js";

interface HelpOverlayProps {
  readonly onClose: () => void;
}

const keybindings = [
  { key: "↑↓ / j k", action: "Navigate rows" },
  { key: "←→ / h l", action: "Navigate columns" },
  { key: "Tab", action: "Cycle columns" },
  { key: "] / [", action: "Next/prev diff" },
  { key: "/", action: "Search keys" },
  { key: "n / N", action: "Next/prev match" },
  { key: "Esc", action: "Cancel search/edit" },
  { key: "", action: "" }, // Spacer
  { key: "e / Enter", action: "Edit value" },
  { key: "a", action: "Add variable" },
  { key: "d", action: "Delete from file" },
  { key: "D", action: "Delete from all files" },
  { key: "", action: "" }, // Spacer
  { key: "c", action: "Copy value" },
  { key: "v", action: "Paste value" },
  { key: "V", action: "Paste to all files" },
  { key: "< / >", action: "Sync left/right" },
  { key: "", action: "" }, // Spacer
  { key: "r", action: "Revert change" },
  { key: "u", action: "Undo last" },
  { key: "U", action: "Undo all" },
  { key: "", action: "" }, // Spacer
  { key: "s", action: "Save changes" },
  { key: "q", action: "Quit" },
  { key: "?", action: "This help" },
];

export function HelpOverlay({ onClose: _onClose }: HelpOverlayProps) {
  return (
    <Modal
      title="Keybindings"
      footer={
        <text>
          <span fg={Colors.dimText}>{"Press "}</span>
          <Kbd fg={Colors.selectedBg}>Esc</Kbd>
          <span fg={Colors.dimText}>{" or "}</span>
          <Kbd fg={Colors.selectedBg}>?</Kbd>
          <span fg={Colors.dimText}>{" to close"}</span>
        </text>
      }
    >
      {keybindings.map(({ action, key }, i) =>
        key === "" ? <box key={i} height={1} /> : (
          <box key={i} flexDirection="row" width="100%">
            <box width={12}>
              <text>
                <span fg={Colors.selectedBg}>{key}</span>
              </text>
            </box>
            <text>
              <span fg={Colors.secondaryText}>{action}</span>
            </text>
          </box>
        )
      )}
    </Modal>
  );
}
