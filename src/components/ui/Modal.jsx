import { useRef, useId } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "../../utils/cn"
import { IconButton } from "./IconButton"
import { useFocusTrap } from "./focusTrap"

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
}

/**
 * Accessible modal dialog with focus trap, Escape to close, aria-modal, focus restoration, and body scroll lock.
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title?: import("react").ReactNode,
 *   description?: import("react").ReactNode,
 *   size?: "sm" | "md" | "lg" | "xl",
 *   closeOnBackdrop?: boolean,
 *   closeOnEscape?: boolean,
 *   hideCloseButton?: boolean,
 *   footer?: import("react").ReactNode,
 *   className?: string,
 *   children?: import("react").ReactNode,
 * }} props
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  hideCloseButton = false,
  footer,
  className,
  children,
}) {
  const panelRef = useRef(null)
  const titleId = useId()
  const descId = useId()

  useFocusTrap({ isOpen, containerRef: panelRef, onClose, closeOnEscape })

  if (!isOpen || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--yh-z-modal)] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget && onClose) {
          onClose()
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "w-full rounded-[var(--yh-radius-xl)] bg-surface-elevated text-ink border border-border-subtle shadow-[var(--yh-shadow-overlay)]",
          "max-h-[90vh] flex flex-col overflow-hidden focus:outline-none",
          SIZE_CLASSES[size] || SIZE_CLASSES.md,
          className,
        )}
      >
        {(title || !hideCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border-subtle shrink-0">
            <div className="min-w-0">
              {title ? (
                <h2 id={titleId} className="text-lg font-bold text-ink tracking-tight leading-snug">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descId} className="mt-1 text-sm text-ink-muted leading-relaxed">
                  {description}
                </p>
              ) : null}
            </div>
            {!hideCloseButton && onClose ? (
              <IconButton aria-label="Close dialog" variant="ghost" size="sm" onClick={onClose}>
                <X size={18} />
              </IconButton>
            ) : null}
          </div>
        )}

        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {footer ? (
          <div className="px-6 py-4 border-t border-border-subtle bg-surface-muted/40 flex flex-wrap items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export const Dialog = Modal
