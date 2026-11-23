import { useState, useEffect } from "react"
import {
  Modal,
  Button,
  Field,
  Input,
  Select,
  Textarea,
} from "../ui"
import { validateManualEntry } from "../../../shared/cashbook"
import { createCashEntry, updateCashEntry } from "../../data/cashbook"
import { useToast } from "../common/ToastContext"

const TYPE_OPTIONS = [
  { value: "transfer-to-bank", label: "Cash Deposit to Bank (Cash Out → Bank In)" },
  { value: "transfer-to-cash", label: "Cash Withdrawal from Bank (Bank Out → Cash In)" },
  { value: "owner-in", label: "Capital Introduced / Owner In (+)" },
  { value: "owner-out", label: "Drawings / Personal Expense / Owner Out (-)" },
  { value: "adjustment", label: "Cash Difference Adjustment" },
]

export default function ManualEntryModal({
  isOpen,
  onClose,
  onSaved,
  entry = null,
  defaultDate = "",
  lockDate = null,
}) {
  const { toast } = useToast()
  const isEditing = Boolean(entry)

  const [type, setType] = useState(entry?.type || "transfer-to-bank")
  const [account, setAccount] = useState(entry?.account || "cash")
  const [amount, setAmount] = useState(entry?.amount !== undefined ? String(entry.amount) : "")
  const [date, setDate] = useState(
    entry?.date ? entry.date.slice(0, 10) : defaultDate || new Date().toISOString().slice(0, 10),
  )
  const [voucherNo, setVoucherNo] = useState(entry?.voucherNo || "")
  const [referenceNo, setReferenceNo] = useState(entry?.referenceNo || "")
  const [partyName, setPartyName] = useState(entry?.partyName || "")
  const [notes, setNotes] = useState(entry?.notes || "")
  const [direction, setDirection] = useState(entry?.direction || "debit")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (entry) {
      setType(entry.type || "transfer-to-bank")
      setAccount(entry.account || "cash")
      setAmount(entry.amount !== undefined ? String(entry.amount) : "")
      setDate(entry.date ? entry.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
      setVoucherNo(entry.voucherNo || "")
      setReferenceNo(entry.referenceNo || "")
      setPartyName(entry.partyName || "")
      setNotes(entry.notes || "")
      setDirection(entry.direction || "debit")
    } else {
      setType("transfer-to-bank")
      setAccount("cash")
      setAmount("")
      setDate(defaultDate || new Date().toISOString().slice(0, 10))
      setVoucherNo("")
      setReferenceNo("")
      setPartyName("")
      setNotes("")
      setDirection("debit")
    }
    setError(null)
  }, [entry, defaultDate, isOpen])

  // Sync account based on entry type
  useEffect(() => {
    if (type === "transfer-to-bank") {
      setAccount("cash")
      setDirection("debit")
    } else if (type === "transfer-to-cash") {
      setAccount("bank")
      setDirection("debit")
    } else if (type === "owner-in") {
      setDirection("credit")
    } else if (type === "owner-out") {
      setDirection("debit")
    }
  }, [type])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const numAmount = Number(amount)
    const validation = validateManualEntry({
      type,
      amount: numAmount,
      account,
      date,
      notes,
    })

    if (!validation.valid) {
      if (validation.errors.includes("ADJUSTMENT_REQUIRES_NOTES")) {
        setError("Please enter a note / reason for this adjustment entry.")
      } else if (validation.errors.includes("INVALID_AMOUNT")) {
        setError("Please enter a valid positive amount.")
      } else {
        setError(`Validation error: ${validation.errors.join(", ")}`)
      }
      return
    }

    if (lockDate && date <= lockDate) {
      setError(`Books are closed up to ${lockDate}. Cannot add or edit entries on or before this date.`)
      return
    }

    setSaving(true)
    try {
      const payload = {
        type,
        amount: numAmount,
        account,
        date,
        voucherNo,
        referenceNo,
        partyName,
        notes,
        direction,
      }

      let res
      if (isEditing && entry?._id) {
        res = await updateCashEntry(entry._id, payload)
        toast.success("Entry updated successfully.")
      } else {
        res = await createCashEntry(payload)
        toast.success("Entry recorded successfully.")
      }

      if (onSaved) onSaved(res)
      onClose()
    } catch (err) {
      console.error("Save cash entry error:", err)
      if (err.status === 423) {
        setError(err.message || "Books are closed up to this date. Action locked.")
      } else {
        setError(err.message || "Failed to save entry.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Cash Book Entry" : "Record Cash / Bank Entry"}
      description="Record manual cash deposits, bank withdrawals, owner investments, or adjustments."
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Transaction Type" required>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={isEditing}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Account" required>
            <Select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              disabled={type.startsWith("transfer-")}
            >
              <option value="cash">Cash Account</option>
              <option value="bank">Bank / Digital Account</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Amount (₹)" required>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>

          <Field label="Date" required>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
        </div>

        {type === "adjustment" && (
          <Field label="Adjustment Direction" required>
            <div className="flex items-center gap-4 text-xs font-medium text-ink pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  value="debit"
                  checked={direction === "debit"}
                  onChange={() => setDirection("debit")}
                />
                <span>Cash Shortage (Debit - Reduces System Balance)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  value="credit"
                  checked={direction === "credit"}
                  onChange={() => setDirection("credit")}
                />
                <span>Cash Excess (Credit + Increases System Balance)</span>
              </label>
            </div>
          </Field>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Voucher / Slip #">
            <Input
              type="text"
              placeholder="e.g. SLIP-101"
              value={voucherNo}
              onChange={(e) => setVoucherNo(e.target.value)}
            />
          </Field>

          <Field label="Party / Person Name">
            <Input
              type="text"
              placeholder="e.g. Ramesh Patel, Driver, Bank"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Particulars / Reason"
          required={type === "adjustment"}
          hint={type === "adjustment" ? "Explain cause of discrepancy" : "Optional transaction details"}
        >
          <Textarea
            rows={2}
            placeholder={
              type === "adjustment"
                ? "Discrepancy reason (e.g. Counted cash short by ₹200 on closing)"
                : "Additional notes or remarks"
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            required={type === "adjustment"}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : isEditing ? "Update Entry" : "Save Entry"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
