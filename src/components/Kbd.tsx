/**
 * Kbd component - consistent rendering for keycaps in the TUI
 *
 * Important: We avoid relying on literal whitespace between spans, as formatters
 * and eslint rules can rewrite it. Spacing should be handled by surrounding
 * layout (boxes) or explicit string literals.
 */
import { Colors } from "../types.js";

interface KbdProps {
  readonly children: string;
  readonly fg?: string;
  readonly wrap?: "square" | "angle" | "none";
}

export function Kbd({ children, fg = Colors.secondaryText, wrap = "square" }: KbdProps) {
  const text = wrap === "none" ?
    children
    : wrap === "angle" ?
    `⟨${children}⟩`
    : `[${children}]`;

  return (
    <b>
      <span fg={fg}>{text}</span>
    </b>
  );
}
