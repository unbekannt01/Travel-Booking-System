import { useState, useEffect } from "react"
import {
  Modal,
  Button,
  Field,
  Input,
  Textarea,
} from "../ui"
import { reopenDay } from "../../data/cashbook"
import { useToast } from "../common/ToastContext"
import { AlertTriangle, ShieldAlert } from "lucide-react"

export default function ReopenCloseModal({
  isOpen,
  onClose,
  onReopened,
  lastClose = null,
  user = null,
}) {
  const { toast } = useToast()

  const [reason, setReason] = useState("")
  const [password, setPassword] = useState("")
  const [totpToken, setTotpToken] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setReason("")
      setPassword("")
      setTotpToken("")
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!reason || reason.trim().length < 5) {
      setError("Please provide a detailed reason (at least 5 characters) for reopening the books.")
      return
    }

    if (!password) {
      setError("Operator password is required to reopen books.")
      return
    }

    if (user?.twoFactorEnabled && !totpToken.trim()) {
      setError("Two-factor authentication code (TOTP) is required.")
      return
    }

    setSubmitting(true)
    try {
      const res = await reopenDay({
        reason: reason.trim(),
        password,
        totpToken: totpToken.trim(),
      })

      toast.success(res.message || "Books reopened successfully.")
      if (onReopened) onReopened(res)
      onClose()
    } catch (err) {
      console.error("Reopen books error:", err)
      setError(err.message || "Failed to reopen books.")
    } finally {
      setSubmitting(false)
    }
  }

  const lockDateStr = lastClose?.closedUpTo || "previous date"

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reopen Closed Day"
      description={`Unlock day close of ${lockDateStr} for adjustments or corrections.`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-danger-soft border border-danger-border text-xs text-danger-text font-medium"
          >
            {error}
          </div>
        )}

        <div className="p-3.5 rounded-xl border border-warning-border bg-warning-soft text-xs text-warning-text flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold">Caution: Books Unlock</strong>
            Reopening will unlock transactions up to <strong>{lockDateStr}</strong> and restore
            editability for bookings, payments, expenses, and cash entries. Any auto-generated closing adjustment will be voided.
          </div>
        </div>

        <Field label="Reason for Reopening" required hint="Minimum 5 characters for operational audit trail">
          <Textarea
            rows={2}
            placeholder="e.g. Missing fuel cash slip received late from conductor"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </Field>

        {/* Step-Up Authentication */}
        <div className="p-3.5 rounded-xl border border-border-subtle bg-slate-50 dark:bg-slate-900/60 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
            <ShieldAlert className="w-4 h-4 text-brand" />
            <span>Step-Up Authorization</span>
          </div>

          <Field label="Account Password" required>
            <Input
              type="password"
              placeholder="Your login password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          {user?.twoFactorEnabled && (
            <Field label="2FA Authenticator Code" required>
              <Input
                type="text"
                placeholder="6-digit code"
                maxLength={6}
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value)}
                required
              />
            </Field>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={submitting}>
            {submitting ? "Reopening..." : "Reopen Books"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
