import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react"
import { cn } from "../../utils/cn"
import { FOCUS_RING_CLASS } from "./variants"

const TOAST_STYLES = {
  success: {
    container: "bg-success-soft text-success-text border-success-border",
    icon: CheckCircle2,
    role: "status",
    live: "polite",
  },
  error: {
    container: "bg-danger-soft text-danger-text border-danger-border",
    icon: AlertCircle,
    role: "alert",
    live: "assertive",
  },
  warning: {
    container: "bg-warning-soft text-warning-text border-warning-border",
    icon: AlertTriangle,
    role: "status",
    live: "polite",
  },
  info: {
    container: "bg-surface-elevated text-ink border-border-subtle",
    icon: Info,
    role: "status",
    live: "polite",
  },
}

/**
 * Single accessible toast notification primitive with icon, message, optional action/undo button, and dismiss button.
 * @param {{
 *   type?: "success" | "error" | "warning" | "info",
 *   message: import("react").ReactNode,
 *   action?: { label?: string, onClick?: () => void },
 *   onDismiss?: () => void,
 *   className?: string,
 * }} props
 */
export function Toast({ type = "info", message, action, onDismiss, className }) {
  const style = TOAST_STYLES[type] || TOAST_STYLES.info
  const Icon = style.icon

  return (
    <div
      role={style.role}
      aria-live={style.live}
      className={cn(
        "pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-[var(--yh-radius-lg)] border shadow-[var(--yh-shadow-lg)] transition-all duration-200 animate-in",
        style.container,
        className,
      )}
    >
      <span className="shrink-0 inline-flex items-center" aria-hidden="true">
        <Icon size={20} strokeWidth={2.25} />
      </span>
      <p className="text-sm font-semibold flex-1 leading-snug">{message}</p>
      {action ? (
        <button
          type="button"
          onClick={() => {
            if (action.onClick) action.onClick()
            if (onDismiss) onDismiss()
          }}
          className={cn(
            "px-3 py-1.5 min-h-9 rounded-[var(--yh-radius-sm)] text-xs font-bold uppercase tracking-wider shrink-0 cursor-pointer transition-colors",
            "bg-accent-warm text-accent-warm-fg hover:bg-accent-warm-hover",
            FOCUS_RING_CLASS,
          )}
        >
          {action.label || "Undo"}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className={cn(
            "p-1.5 min-h-9 min-w-9 inline-flex items-center justify-center rounded-[var(--yh-radius-sm)] hover:bg-surface-hover/50 transition-colors shrink-0 cursor-pointer",
            FOCUS_RING_CLASS,
          )}
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

/**
 * Fixed viewport stack rendering active Toast notifications.
 * @param {{ children: import("react").ReactNode, className?: string }} props
 */
export function ToastContainer({ children, className }) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className={cn(
        "fixed bottom-5 right-5 z-[var(--yh-z-toast)] flex flex-col gap-2.5 max-w-md w-[calc(100%-2.5rem)] pointer-events-none",
        className,
      )}
    >
      {children}
    </div>
  )
}
