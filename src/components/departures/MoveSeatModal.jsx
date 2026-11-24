import { useState } from "react"
import { AlertCircle, ArrowRight } from "lucide-react"
import { Modal, Button, Select, Field } from "../ui"
import { useToast } from "../common/ToastContext"
import { getAuthToken } from "../../data/adapters/rest"

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!targetSeat) {
      setError("Please select a target seat.")
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
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Failed to move seat")
      }

      toast.success(`Successfully moved ${passenger.name || "passenger"} to seat ${targetSeat}`)
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
              {passenger?.seatNumber ? `#${passenger.seatNumber}` : passenger?.seatId || "Current"}
            </span>
            <ArrowRight size={14} className="text-ink-muted" />
            <span className="px-2 py-1 rounded bg-brand-soft text-brand font-bold border border-brand/20">
              {targetSeat || "New Seat"}
            </span>
          </div>
        </div>

        <Field label="Choose Available Target Seat" required>
          <Select
            value={targetSeat}
            onChange={(e) => {
              setTargetSeat(e.target.value)
              if (error) setError(null)
            }}
            required
          >
            <option value="">Select a free seat...</option>
            {availableSeats.map((seat) => (
              <option key={seat.seatId} value={seat.seatId}>
                Seat {seat.seatNumber} — {seat.seatName || seat.seatId}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading} disabled={!targetSeat}>
            Confirm Move
          </Button>
        </div>
      </form>
    </Modal>
  )
}
