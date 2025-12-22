/**
 * Modal component - overlay for confirmations and previews
 */
import { Colors } from "../types.js";

interface ModalProps {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
}

export function Modal({ title, children, footer }: ModalProps) {
  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      backgroundColor={Colors.background}
      justifyContent="center"
      alignItems="center"
    >
      <box
        flexDirection="column"
        backgroundColor={Colors.surface}
        borderStyle="single"
        borderColor={Colors.border}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        minWidth={40}
        maxWidth={60}
      >
        {/* Title */}
        <box marginBottom={1}>
          <text>
            <b>
              <span fg={Colors.selectedBg}>{title}</span>
            </b>
          </text>
        </box>

        {/* Content */}
        <box flexDirection="column" marginBottom={1}>
          {children}
        </box>

        {/* Footer */}
        {footer && (
          <box marginTop={1}>
            {footer}
          </box>
        )}
      </box>
    </box>
  );
}

