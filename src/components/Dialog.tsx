import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <D.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <D.Portal>
        <D.Overlay className="dialog-overlay" />
        <D.Content
          className={`dialog ${wide ? "wide" : ""}`}
          aria-describedby={description ? "dialog-description" : undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <D.Title>{title}</D.Title>
          {description && (
            <D.Description id="dialog-description">{description}</D.Description>
          )}
          <D.Close
            className="icon-button dialog-close"
            aria-label="Fechar janela"
          >
            <X size={19} />
          </D.Close>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
