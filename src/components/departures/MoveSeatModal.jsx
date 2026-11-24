import { useState } from "react"
import { AlertCircle, ArrowRight } from "lucide-react"
import { Modal, Button, Select, Field, Input } from "../ui"
import { useToast } from "../common/ToastContext"
import { getAuthToken } from "../../data/adapters/rest"
import { formatSeatLabel } from "../../utils/formatters"

export default function MoveSeatModal({
  isOpen,
  onClose,
  bookingId,
  passenger,
  availableSeats = [],
  onSuccess,
}) {
  const { toast } = useToast()
  const [targetSeat, setTargetSeat] = useState("")
  const [overrideRequired, setOverrideRequired] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!targetSeat) {
      setError("Please select a target seat.")
      return
    }

    if (overrideRequired && overrideReason.trim().length < 3) {
      setError("Please provide an override reason of at least 3 characters.")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const token = getAuthToken()
      const paxIdentifier = passenger.paxId || passenger.id || passenger.name
      const res = await fetch(`/api/bookings/${bookingId}/passengers/${encodeURIComponent(paxIdentifier)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          seatId: targetSeat,
          overrideLadies: overrideRequired,
          overrideReason: overrideReason.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.code === "LADIES_SEAT") {
          setOverrideRequired(true)
          setError(data.message + " You can provide an override reason below to proceed.")
          return
        }
        throw new Error(data.message || "Failed to move seat")
      }

      toast.success(`Successfully moved ${passenger.name || "passenger"} to seat ${formatSeatLabel(targetSeat)}`)
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Move Passenger Seat"
      description="Reassign this passenger to an available seat without affecting billing or financials."
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 text-xs rounded-[var(--yh-radius-md)] bg-danger-soft text-danger border border-danger-border">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-surface-muted/60 rounded-[var(--yh-radius-md)] border border-border-subtle flex items-center justify-between text-xs">
          <div>
            <span className="text-ink-muted block text-[11px]">Passenger:</span>
            <span className="font-bold text-ink">{passenger?.passengerName || passenger?.name || "Passenger"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 font-bold text-ink">
              {formatSeatLabel(passenger?.seatId || passenger?.seatNumber)}
            </span>
            <ArrowRight size={14} className="text-ink-muted" />
            <span className="px-2 py-1 rounded bg-brand-soft text-brand font-bold border border-brand/20">
              {targetSeat ? formatSeatLabel(targetSeat) : "New Seat"}
            </span>
          </div>
        </div>

        <Field label="Choose Available Target Seat" required>
          <Select
            value={targetSeat}
            onChange={(e) => {
              setTargetSeat(e.target.value)
              setOverrideRequired(false)
              setOverrideReason("")
              if (error) setError(null)
            }}
            required
          >
            <option value="">Select a free seat...</option>
            {availableSeats.map((seat) => (
              <option key={seat.seatId} value={seat.seatId}>
                #{seat.seatNumber} — {formatSeatLabel(seat.seatId || seat.seatName)}
              </option>
            ))}
          </Select>
        </Field>

        {overrideRequired && (
          <div className="p-3 bg-amber-500/10 rounded-[var(--yh-radius-md)] border border-amber-500/25 space-y-2 animate-in fade-in">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
              Ladies Reservation Override
            </span>
            <Field label="Override Reason (min 3 characters)" required>
              <Input
                type="text"
                placeholder="e.g. Traveling with family / operator approval"
                value={overrideReason}
                onChange={(e) => {
                  setOverrideReason(e.target.value)
                  if (error) setError(null)
                }}
                required
              />
            </Field>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading} disabled={!targetSeat}>
            {overrideRequired ? "Confirm Move (with Override)" : "Confirm Move"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
