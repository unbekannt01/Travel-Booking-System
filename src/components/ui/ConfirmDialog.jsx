import { AlertTriangle, HelpCircle } from "lucide-react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { cn } from "../../utils/cn"

/**
 * Accessible confirmation dialog built on Modal, supporting destructive and primary intents.
 * @param {{
 *   isOpen: boolean,
 *   title?: import("react").ReactNode,
 *   message?: import("react").ReactNode,
 *   confirmText?: string,
 *   cancelText?: string,
 *   isDestructive?: boolean,
 *   loading?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export function ConfirmDialog({
  isOpen,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      hideCloseButton
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
    >
      <div className="flex flex-col items-center text-center">
        <div
          aria-hidden="true"
          className={cn(
            "inline-flex h-12 w-12 items-center justify-center rounded-[var(--yh-radius-lg)] border mb-4",
            isDestructive
              ? "bg-danger-soft text-danger-text border-danger-border"
              : "bg-brand-soft text-brand border-border-subtle",
          )}
        >
          {isDestructive ? <AlertTriangle size={24} strokeWidth={2.25} /> : <HelpCircle size={24} strokeWidth={2.25} />}
        </div>

        <h3 className="text-lg font-bold text-ink tracking-tight leading-snug">{title}</h3>
        {message ? (
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">{message}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 w-full mt-6">
          <Button variant="secondary" onClick={onCancel} disabled={loading} fullWidth>
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            fullWidth
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
