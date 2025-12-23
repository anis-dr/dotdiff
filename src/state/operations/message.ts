/**
 * Message operations
 *
 * Operations for flash messages.
 */
import { Atom } from "@effect-atom/atom-react";
import { messageAtom } from "../atoms/base.js";

/**
 * Set message (for flash messages)
 */
export const setMessageOp = Atom.fnSync((message: string | null, get) => {
  get.set(messageAtom, message);
});
