import { useState, useMemo, useEffect, useRef } from "react"
import { DollarSign, AlertCircle, Check, Info } from "lucide-react"
import { Modal, Button, Input, Select, Textarea, Field } from "../ui"
import { useToast } from "../common/ToastContext"
import { formatINR } from "../../utils/formatters"
import { toDateInputValue } from "../../utils/date"
import {
  toPaise,
  fromPaise,
  calculateProportionalAllocation,
  calculateEqualAllocation,
  validateManualAllocation,
} from "../../../shared/groupPayments.js"

export default function RecordGroupPaymentModal({
  isOpen,
  onClose,
  group,
  members = [],
  onPaymentSuccess,
}) {
  const { toast } = useToast()
  const [amountRupees, setAmountRupees] = useState("")
  const [paymentDate, setPaymentDate] = useState(() => toDateInputValue(new Date()))
  const [paymentMode, setPaymentMode] = useState("Cash")
  const [referenceNo, setReferenceNo] = useState("")
  const [notes, setNotes] = useState("")
  const [allocationMethod, setAllocationMethod] = useState("proportional") // proportional | equal | manual
  const [manualInputs, setManualInputs] = useState({}) // bookingId -> string rupee value
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState("")

  const idempotencyKeyRef = useRef("")
  useEffect(() => {
    if (isOpen) {
      idempotencyKeyRef.current = `grp-pay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      setAmountRupees("")
      setPaymentDate(toDateInputValue(new Date()))
      setPaymentMode("Cash")
      setReferenceNo("")
      setNotes("")
      setAllocationMethod("proportional")
      setManualInputs({})
      setServerError("")
      setIsSubmitting(false)
    }
  }, [isOpen])

  // Prepare members list with integer paise
  const membersWithBalances = useMemo(() => {
    return members.map((m) => {
      const bal = Math.max(0, (m.totalAmount || 0) - (m.advanceReceived || 0))
      return {
        bookingId: String(m._id || m.id),
        name: m.contactName || "Traveler",
        invoiceNo: m.invoiceNo || "",
        balancePaise: toPaise(bal),
        balanceRupees: bal,
      }
    })
  }, [members])

  const totalGroupBalancePaise = useMemo(() => {
    return membersWithBalances.reduce((acc, m) => acc + m.balancePaise, 0)
  }, [membersWithBalances])

  const totalPaise = useMemo(() => {
    return toPaise(amountRupees)
  }, [amountRupees])

  // Compute live allocation preview
  const allocationResult = useMemo(() => {
    if (totalPaise <= 0 || totalGroupBalancePaise <= 0) {
      return { valid: false, allocations: [], error: null }
    }
    if (totalPaise > totalGroupBalancePaise) {
      return {
        valid: false,
        allocations: [],
        error: `Entered amount ₹${fromPaise(totalPaise)} exceeds total group balance due ₹${fromPaise(totalGroupBalancePaise)}. Maximum payable is ₹${fromPaise(totalGroupBalancePaise)}.`,
      }
    }

    if (allocationMethod === "proportional") {
      return calculateProportionalAllocation({
        totalPaise,
        members: membersWithBalances,
      })
    } else if (allocationMethod === "equal") {
      return calculateEqualAllocation({
        totalPaise,
        members: membersWithBalances,
      })
    } else if (allocationMethod === "manual") {
      const manualPaise = {}
      for (const [bId, val] of Object.entries(manualInputs)) {
        manualPaise[bId] = toPaise(val)
      }
      return validateManualAllocation({
        totalPaise,
        members: membersWithBalances,
        manualAllocations: manualPaise,
      })
    }
    return { valid: false, allocations: [], error: null }
  }, [totalPaise, totalGroupBalancePaise, allocationMethod, membersWithBalances, manualInputs])

  const isFormValid =
    totalPaise > 0 &&
    totalPaise <= totalGroupBalancePaise &&
    allocationResult?.valid &&
    !isSubmitting

  const handleManualInputChange = (bookingId, val) => {
    setManualInputs((prev) => ({
      ...prev,
      [bookingId]: val,
    }))
  }

  const handleFillMax = () => {
    setAmountRupees(fromPaise(totalGroupBalancePaise).toString())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid || !group) return

    setServerError("")
    setIsSubmitting(true)

    try {
      const manualPaiseForPayload = {}
      if (allocationMethod === "manual") {
        for (const [k, v] of Object.entries(manualInputs)) {
          manualPaiseForPayload[k] = fromPaise(toPaise(v))
        }
      }

      const res = await fetch(`/api/groups/${group._id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          amount: fromPaise(totalPaise),
          paymentDate,
          paymentMode,
          referenceNo: referenceNo.trim(),
          notes: notes.trim(),
          allocationMethod,
          manualAllocations: manualPaiseForPayload,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Failed to record group payment")
      }

      toast.success(data.message || "Group payment recorded successfully!")
      if (onPaymentSuccess) {
        onPaymentSuccess(data.groupPayment)
      }
      onClose()
    } catch (err) {
      setServerError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose()
      }}
      title={`Record Group Payment — ${group?.name || "Group"}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-[var(--yh-radius-md)] bg-danger-soft border border-danger/30 text-danger-text text-sm flex items-start gap-2"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-danger" />
            <div>
              <p className="font-semibold">Payment failed</p>
              <p className="text-xs mt-0.5">{serverError}</p>
            </div>
          </div>
        )}

        {/* Group balance banner */}
        <div className="p-3 bg-surface-muted/60 border border-border-subtle rounded-[var(--yh-radius-md)] flex items-center justify-between text-xs sm:text-sm">
          <div>
            <span className="text-ink-muted">Total Group Balance Due:</span>{" "}
            <strong className="text-ink font-bold tabular-nums">
              {formatINR(fromPaise(totalGroupBalancePaise))}
            </strong>
          </div>
          <button
            type="button"
            onClick={handleFillMax}
            className="text-xs text-brand font-semibold hover:underline cursor-pointer"
          >
            Pay Full Balance
          </button>
        </div>

        {/* Payment input grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            id="group-payment-amount"
            label="Total Amount (₹)"
            required
            hint={`Up to ₹${fromPaise(totalGroupBalancePaise).toLocaleString("en-IN")}`}
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                type="number"
                step="0.01"
                min="0.01"
                max={fromPaise(totalGroupBalancePaise)}
                placeholder="e.g. 5000"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                aria-describedby={describedBy}
                required
              />
            )}
          </Field>

          <Field id="group-payment-date" label="Payment Date" required>
            {({ id, describedBy }) => (
              <Input
                id={id}
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                aria-describedby={describedBy}
                required
              />
            )}
          </Field>

          <Field id="group-payment-mode" label="Payment Mode" required>
            {({ id, describedBy }) => (
              <Select
                id={id}
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                aria-describedby={describedBy}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cheque">Cheque</option>
              </Select>
            )}
          </Field>

          <Field id="group-payment-ref" label="Reference / Txn ID (Optional)">
            {({ id, describedBy }) => (
              <Input
                id={id}
                type="text"
                placeholder="UPI ref, cheque no, etc."
                value={referenceNo}
                maxLength={80}
                onChange={(e) => setReferenceNo(e.target.value)}
                aria-describedby={describedBy}
              />
            )}
          </Field>
        </div>

        {/* Allocation Method Selector */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-ink block">Allocation Method</span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "proportional", label: "Proportional", desc: "By balance due ratio" },
              { id: "equal", label: "Equal Share", desc: "Capped at balance" },
              { id: "manual", label: "Manual", desc: "Custom per member" },
            ].map((m) => {
              const active = allocationMethod === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAllocationMethod(m.id)}
                  className={`p-2 rounded-[var(--yh-radius-md)] border text-left cursor-pointer transition-colors ${
                    active
                      ? "border-brand bg-brand-soft text-brand-dark"
                      : "border-border-subtle bg-surface hover:bg-surface-hover text-ink"
                  }`}
                >
                  <p className="text-xs font-bold">{m.label}</p>
                  <p className="text-[10px] text-ink-muted leading-tight">{m.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Allocation Preview Table */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">Allocation Preview</span>
            {totalPaise > 0 && (
              <span className="text-ink-muted">
                Allocated: <strong className="text-ink">{formatINR(fromPaise(totalPaise))}</strong>
              </span>
            )}
          </div>

          <div
            role="region"
            aria-label="Member Payment Allocation Breakdown"
            className="border border-border-subtle rounded-[var(--yh-radius-md)] overflow-x-auto max-h-56"
          >
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-muted border-b border-border-subtle sticky top-0">
                <tr>
                  <th className="py-1.5 px-2.5 font-semibold text-ink-muted">Member</th>
                  <th className="py-1.5 px-2.5 font-semibold text-ink-muted">Invoice</th>
                  <th className="py-1.5 px-2.5 font-semibold text-ink-muted text-right">Balance Due</th>
                  <th className="py-1.5 px-2.5 font-semibold text-ink-muted text-right">
                    {allocationMethod === "manual" ? "Enter Amount (₹)" : "Allocated"}
                  </th>
                  <th className="py-1.5 px-2.5 font-semibold text-ink-muted text-right">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {membersWithBalances.map((m) => {
                  const allocObj = allocationResult?.allocations?.find((a) => a.bookingId === m.bookingId)
                  const allocatedPaise = allocObj?.allocatedPaise || 0
                  const balAfterPaise = Math.max(0, m.balancePaise - allocatedPaise)

                  return (
                    <tr key={m.bookingId} className="hover:bg-surface-hover">
                      <td className="py-1.5 px-2.5 font-medium text-ink max-w-[120px] truncate">
                        {m.name}
                      </td>
                      <td className="py-1.5 px-2.5 font-mono text-[11px] text-ink-muted">
                        {m.invoiceNo}
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums text-ink-secondary">
                        {formatINR(m.balanceRupees)}
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums">
                        {allocationMethod === "manual" ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={m.balanceRupees}
                            value={manualInputs[m.bookingId] ?? ""}
                            onChange={(e) => handleManualInputChange(m.bookingId, e.target.value)}
                            className="w-20 text-right px-1.5 py-0.5 border border-border-subtle rounded text-xs"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="font-semibold text-success-text">
                            {formatINR(fromPaise(allocatedPaise))}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums text-ink-muted">
                        {formatINR(fromPaise(balAfterPaise))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Rounding rule explanation */}
          <div className="flex items-start gap-1.5 text-[11px] text-ink-muted p-2 bg-surface-muted/40 rounded">
            <Info size={13} className="shrink-0 text-brand mt-0.5" />
            <p>
              Allocations are computed in exact integer paise. Any rounding remainder is distributed
              1 paise at a time starting with the member having the largest balance due.
            </p>
          </div>

          {allocationResult?.error && (
            <p className="text-xs font-semibold text-danger" role="alert">
              {allocationResult.error}
            </p>
          )}
        </div>

        <Field id="group-payment-notes" label="Notes (Optional)">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              rows={2}
              placeholder="e.g. Paid by tour leader for entire family"
              value={notes}
              maxLength={200}
              onChange={(e) => setNotes(e.target.value)}
              aria-describedby={describedBy}
            />
          )}
        </Field>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!isFormValid}
            leftIcon={isSubmitting ? undefined : <Check size={14} />}
            aria-describedby={!isFormValid ? "group-pay-btn-hint" : undefined}
          >
            {isSubmitting ? "Recording Payment..." : "Record Payment"}
          </Button>
        </div>

        {!isFormValid && (
          <p id="group-pay-btn-hint" className="sr-only">
            Enter a valid payment amount up to the group balance due to enable recording.
          </p>
        )}
      </form>
    </Modal>
  )
}
