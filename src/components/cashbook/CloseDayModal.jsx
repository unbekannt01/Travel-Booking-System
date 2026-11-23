import { useState, useMemo, useEffect } from "react"
import {
  Modal,
  Button,
  Field,
  Input,
  Textarea,
  Checkbox,
  Badge,
} from "../ui"
import { computeClosePreview, formatINR } from "../../../shared/cashbook"
import { closeDay } from "../../data/cashbook"
import { useToast } from "../common/ToastContext"
import { ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react"

export default function CloseDayModal({
  isOpen,
  onClose,
  onClosed,
  defaultDate = "",
  user = null,
  dayBook = null,
  lockDate = null,
}) {
  const { toast } = useToast()

  const targetDate = defaultDate || new Date().toISOString().slice(0, 10)
  const systemCash = dayBook?.closing?.cash || 0

  const [countedCash, setCountedCash] = useState("")
  const [autoAdjust, setAutoAdjust] = useState(true)
  const [notes, setNotes] = useState("")
  const [password, setPassword] = useState("")
  const [totpToken, setTotpToken] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setCountedCash(systemCash > 0 ? String(systemCash) : "")
      setAutoAdjust(true)
      setNotes("")
      setPassword("")
      setTotpToken("")
      setError(null)
    }
  }, [isOpen, systemCash])

  // Live difference preview calculation
  const preview = useMemo(() => {
    const numCounted = Number(countedCash) || 0
    return computeClosePreview({
      asOfDate: targetDate,
      countedCash: numCounted,
      dayBook,
    })
  }, [targetDate, countedCash, dayBook])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!password) {
      setError("Operator password is required to close books.")
      return
    }

    if (user?.twoFactorEnabled && !totpToken.trim()) {
      setError("Two-factor authentication code (TOTP) is required.")
      return
    }

    if (lockDate && targetDate <= lockDate) {
      setError(`Books are already closed up to ${lockDate}.`)
      return
    }

    setSubmitting(true)
    try {
      const res = await closeDay({
        asOfDate: targetDate,
        countedCash: Number(countedCash) || 0,
        password,
        totpToken: totpToken.trim(),
        notes,
        autoAdjust,
      })

      toast.success(`Books closed successfully for ${targetDate}.`)
      if (onClosed) onClosed(res)
      onClose()
    } catch (err) {
      console.error("Close day error:", err)
      setError(err.message || "Failed to close books.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Close Books for ${targetDate}`}
      description="Verify counted physical cash in hand, record adjustments, and lock transactions for the day."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-danger-soft border border-danger-border text-xs text-danger-text font-medium flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Live Discrepancy Card */}
        <div className="p-4 rounded-xl border border-border-subtle bg-surface-subtle space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">System Cash in Hand:</span>
            <span className="font-bold text-ink">{formatINR(systemCash)}</span>
          </div>

          <Field label="Actual Counted Cash in Hand (₹)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              required
            />
          </Field>

          {/* Difference & Status Badge */}
          <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
            <span className="text-xs text-ink-muted">Cash Discrepancy:</span>
            {preview.status === "balanced" ? (
              <Badge variant="success" size="sm" className="gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Balanced (₹0 difference)
              </Badge>
            ) : preview.status === "excess" ? (
              <Badge variant="primary" size="sm">
                Cash Excess: +{formatINR(preview.difference)}
              </Badge>
            ) : (
              <Badge variant="danger" size="sm">
                Cash Shortage: {formatINR(preview.difference)}
              </Badge>
            )}
          </div>

          {preview.status !== "balanced" && (
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-ink">
                <input
                  type="checkbox"
                  checked={autoAdjust}
                  onChange={(e) => setAutoAdjust(e.target.checked)}
                  className="rounded border-border text-brand focus:ring-brand"
                />
                <span>Auto-record cash adjustment entry for {formatINR(Math.abs(preview.difference))}</span>
              </label>
            </div>
          )}
        </div>

        <Field label="Closing Remarks / Notes">
          <Textarea
            rows={2}
            placeholder="Optional comments regarding day close or register hand-over"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {/* Step-Up Authentication */}
        <div className="p-3.5 rounded-xl border border-border-subtle bg-slate-50 dark:bg-slate-900/60 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
            <ShieldCheck className="w-4 h-4 text-brand" />
            <span>Step-Up Authorization</span>
          </div>
          <p className="text-[11px] text-ink-muted">
            Closing the day locks all transactions up to this date. Re-enter your password to confirm.
          </p>

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
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Closing Books..." : "Confirm & Close Day"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
