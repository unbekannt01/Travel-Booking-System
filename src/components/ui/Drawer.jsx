import { useRef, useId } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "../../utils/cn"
import { IconButton } from "./IconButton"
import { useFocusTrap } from "./focusTrap"

const SIDE_LAYOUT = {
  right: {
    backdrop: "justify-end items-stretch",
    panel: "h-full w-full max-w-md border-l rounded-l-[var(--yh-radius-xl)]",
  },
  left: {
    backdrop: "justify-start items-stretch",
    panel: "h-full w-full max-w-md border-r rounded-r-[var(--yh-radius-xl)]",
  },
  bottom: {
    backdrop: "justify-center items-end",
    panel: "w-full max-w-2xl max-h-[85vh] border-t rounded-t-[var(--yh-radius-xl)]",
  },
}

/**
 * Accessible slide-over drawer panel with focus trap, Escape to close, aria-modal, focus restoration, and scroll lock.
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title?: import("react").ReactNode,
 *   description?: import("react").ReactNode,
 *   side?: "right" | "left" | "bottom",
 *   closeOnBackdrop?: boolean,
 *   closeOnEscape?: boolean,
 *   footer?: import("react").ReactNode,
 *   className?: string,
 *   children?: import("react").ReactNode,
 * }} props
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  side = "right",
  closeOnBackdrop = true,
  closeOnEscape = true,
  footer,
  className,
  children,
}) {
  const panelRef = useRef(null)
  const titleId = useId()
  const descId = useId()
  const layout = SIDE_LAYOUT[side] || SIDE_LAYOUT.right

  useFocusTrap({ isOpen, containerRef: panelRef, onClose, closeOnEscape })

  if (!isOpen || typeof document === "undefined") return null

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[var(--yh-z-modal)] flex",
        layout.backdrop,
      )}
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-0 bg-ink/50 backdrop-blur-[2px]"
        aria-hidden="true"
        onMouseDown={closeOnBackdrop && onClose ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 bg-surface-elevated text-ink border-border-subtle shadow-[var(--yh-shadow-overlay)] flex flex-col overflow-hidden focus:outline-none",
          layout.panel,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="min-w-0">
            {title ? (
              <h2 id={titleId} className="text-base font-bold text-ink tracking-tight">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descId} className="mt-0.5 text-xs text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          {onClose ? (
            <IconButton aria-label="Close drawer" variant="ghost" size="sm" onClick={onClose}>
              <X size={18} />
            </IconButton>
          ) : null}
        </div>

        <div className="p-5 overflow-y-auto flex-1">{children}</div>

        {footer ? (
          <div className="px-5 py-3.5 border-t border-border-subtle bg-surface-muted/40 flex flex-wrap items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
