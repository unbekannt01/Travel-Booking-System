import { useState } from "react"
import { AlertTriangle, ShieldAlert } from "lucide-react"
import { formatDisplayDate } from "../../utils/date"
import { formatINR } from "../../utils/formatters"
import { formatSeatLabel } from "../../utils/seatFormatting"
import { Modal, Button, Field, Input, Select, Badge, FOCUS_RING_CLASS } from "../ui"
import { cn } from "../../utils/cn"

export default function CancelBookingModal({ booking, onClose, onConfirm, isOpen = true }) {
  const totalPaid = Math.round((booking?.advanceReceived || 0) * 100) / 100
  const [cancellationCharge, setCancellationCharge] = useState("0")
  const [refundPaymentMode, setRefundPaymentMode] = useState("Cash")
  const [reason, setReason] = useState("Customer requested cancellation")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState("")

  if (!booking) return null

  const fee = Math.max(0, Number(cancellationCharge) || 0)
  const refundAmount = Math.max(0, Math.round((totalPaid - fee) * 100) / 100)
  const isFeeTooHigh = fee > totalPaid

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (isFeeTooHigh) return
    setServerError("")
    setIsSubmitting(true)
    try {
      await onConfirm({
        bookingId: booking._id || booking.id,
        cancellationCharge: fee,
        refundPaymentMode,
        reason,
      })
      onClose()
    } catch (err) {
      setServerError(err?.message || "Failed to cancel booking. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const assignedSeats = (booking.passengers || [])
    .map((p) => p.seatId)
    .filter(Boolean)

  const modalFooter = (
    <div className="flex items-center justify-end gap-2 w-full">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClose}
        disabled={isSubmitting}
      >
        Keep Reservation
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isSubmitting || isFeeTooHigh}
        onClick={handleSubmit}
      >
        {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
      </Button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-[var(--yh-radius-md)] bg-danger-soft text-danger-text shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-base sm:text-lg font-bold text-ink">Cancel Booking</span>
            <p className="text-xs text-ink-muted font-normal mt-0.5 truncate">
              Invoice #{booking.invoiceNo} • {booking.contactName}
            </p>
          </div>
        </div>
      }
      footer={modalFooter}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-[var(--yh-radius-md)] bg-danger-soft text-danger-text border border-border-subtle text-xs font-semibold flex items-center gap-2"
          >
            <AlertTriangle size={15} className="shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Booking Summary Box */}
        <div className="bg-surface-muted/60 p-3.5 rounded-[var(--yh-radius-md)] border border-border-subtle grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-ink-muted block font-medium">Tour & Date</span>
            <span className="font-semibold text-ink block leading-snug">{booking.tourName}</span>
            <span className="text-ink-muted text-[11px]">{formatDisplayDate(booking.journeyDate)}</span>
          </div>
          <div>
            <span className="text-ink-muted block font-medium">Total Collected</span>
            <span className="font-bold text-success-text text-base tabular-nums">
              {formatINR(totalPaid, 0)}
            </span>
          </div>
        </div>

        {/* Cancellation Charge */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label htmlFor="cancel-charge" className="text-xs font-semibold text-ink-secondary">
              Cancellation Fee Retained (₹)
            </label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setCancellationCharge("0")}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-semibold rounded-[var(--yh-radius-sm)] bg-surface-muted text-ink-secondary hover:bg-surface-hover border border-border-subtle transition-colors cursor-pointer",
                  FOCUS_RING_CLASS,
                )}
              >
                ₹0 (Full Refund)
              </button>
              <button
                type="button"
                onClick={() => setCancellationCharge(totalPaid.toString())}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-semibold rounded-[var(--yh-radius-sm)] bg-surface-muted text-ink-secondary hover:bg-surface-hover border border-border-subtle transition-colors cursor-pointer",
                  FOCUS_RING_CLASS,
                )}
              >
                Retain All
              </button>
            </div>
          </div>
          <Input
            id="cancel-charge"
            type="number"
            min="0"
            max={totalPaid}
            tabular
            value={cancellationCharge}
            onChange={(e) => setCancellationCharge(e.target.value)}
            invalid={isFeeTooHigh}
            placeholder="0"
          />
          {isFeeTooHigh && (
            <p role="alert" className="text-xs font-semibold text-danger-text">
              Fee cannot exceed collected amount of {formatINR(totalPaid, 0)}
            </p>
          )}
        </div>

        {/* Refund Calculation Box */}
        <div className="p-3.5 rounded-[var(--yh-radius-md)] bg-warning-soft border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-warning-text block">
              Refund Due to Traveler
            </span>
            <span className="text-xl font-bold text-warning-text tabular-nums">
              {formatINR(refundAmount, 0)}
            </span>
          </div>
          {refundAmount > 0 && (
            <div className="w-full sm:w-44 space-y-1">
              <label htmlFor="cancel-refund-mode" className="text-[11px] font-semibold text-warning-text block">
                Refund Payment Mode
              </label>
              <Select
                id="cancel-refund-mode"
                value={refundPaymentMode}
                onChange={(e) => setRefundPaymentMode(e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Net Banking">Net Banking</option>
              </Select>
            </div>
          )}
        </div>

        {/* Reason */}
        <Field id="cancel-reason" label="Reason for Cancellation">
          {({ id }) => (
            <Input
              id={id}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Passenger family emergency"
            />
          )}
        </Field>

        {/* Seat Release Notice */}
        <div className="flex items-start gap-2 p-3 rounded-[var(--yh-radius-md)] bg-danger-soft text-danger-text border border-border-subtle text-xs">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>
            Reserved seats (
            <strong className="font-semibold">
              {assignedSeats.length > 0
                ? assignedSeats.map((s) => formatSeatLabel(s)).join(", ")
                : "None"}
            </strong>
            ) will be immediately freed for other travelers.
          </span>
        </div>
      </form>
    </Modal>
  )
}
