import { useState, useEffect } from "react"
import {
  Modal,
  Button,
  Field,
  Input,
  Textarea,
} from "../ui"
import { saveCashBookSetup } from "../../data/cashbook"
import { useToast } from "../common/ToastContext"
import { Lock } from "lucide-react"

export default function SetupModal({
  isOpen,
  onClose,
  onSaved,
  setup = null,
  isEditable = true,
}) {
  const { toast } = useToast()

  const [cashOpening, setCashOpening] = useState("0")
  const [bankOpening, setBankOpening] = useState("0")
  const [asOfDate, setAsOfDate] = useState("2026-01-01")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (setup) {
      setCashOpening(String(setup.cashOpening !== undefined ? setup.cashOpening : 0))
      setBankOpening(String(setup.bankOpening !== undefined ? setup.bankOpening : 0))
      setAsOfDate(setup.asOfDate || "2026-01-01")
      setNotes(setup.notes || "")
    } else {
      setCashOpening("0")
      setBankOpening("0")
      setAsOfDate("2026-01-01")
      setNotes("")
    }
    setError(null)
  }, [setup, isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!isEditable) {
      setError("Setup cannot be modified because active books closes exist.")
      return
    }

    const numCash = Number(cashOpening)
    const numBank = Number(bankOpening)

    if (isNaN(numCash) || numCash < 0 || isNaN(numBank) || numBank < 0) {
      setError("Opening balances must be valid non-negative numbers.")
      return
    }

    if (!asOfDate) {
      setError("Please select a valid as-of date.")
      return
    }

    setSaving(true)
    try {
      const res = await saveCashBookSetup({
        cashOpening: numCash,
        bankOpening: numBank,
        asOfDate,
        notes,
      })

      toast.success("Cash book opening setup saved successfully.")
      if (onSaved) onSaved(res)
      onClose()
    } catch (err) {
      console.error("Save setup error:", err)
      setError(err.message || "Failed to save setup.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cash Book Opening Setup"
      description="Establish opening cash in hand and bank balances before tracking daily books."
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

        {!isEditable && (
          <div className="p-3 rounded-lg bg-surface-subtle border border-border-subtle text-xs text-ink-muted flex items-center gap-2">
            <Lock className="w-4 h-4 text-warning shrink-0" />
            <span>
              <strong>Locked:</strong> Opening setup cannot be modified while past books closes are
              active. Reopen past closes if you need to alter opening balances.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cash Opening Balance (₹)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={cashOpening}
              onChange={(e) => setCashOpening(e.target.value)}
              disabled={!isEditable}
              required
            />
          </Field>

          <Field label="Bank Opening Balance (₹)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={bankOpening}
              onChange={(e) => setBankOpening(e.target.value)}
              disabled={!isEditable}
              required
            />
          </Field>
        </div>

        <Field label="As of Date" required hint="Transactions before this date are excluded from the Day Book">
          <Input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            disabled={!isEditable}
            required
          />
        </Field>

        <Field label="Setup Notes">
          <Textarea
            rows={2}
            placeholder="e.g. Balances verified against bank statement and cash register"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!isEditable}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {isEditable && (
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : "Save Setup"}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
