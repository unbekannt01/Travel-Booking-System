import { useState, useEffect } from "react"
import { Sliders, AlertCircle, Check, Info } from "lucide-react"
import { Modal, Button, Field, Input } from "../ui"
import { useToast } from "../common/ToastContext"
import { getAuthToken } from "../../data/adapters/rest"

export default function SeatSettingsModal({
  isOpen,
  onClose,
  departureKey,
  initialConfig,
  onSuccess,
}) {
  const { toast } = useToast()
  const [lowerFare, setLowerFare] = useState("")
  const [upperFare, setUpperFare] = useState("")
  const [rearFare, setRearFare] = useState("")
  const [seatFare, setSeatFare] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (initialConfig?.fares) {
      setLowerFare(initialConfig.fares.lower ? String(initialConfig.fares.lower / 100) : "")
      setUpperFare(initialConfig.fares.upper ? String(initialConfig.fares.upper / 100) : "")
      setRearFare(initialConfig.fares.rear ? String(initialConfig.fares.rear / 100) : "")
      setSeatFare(initialConfig.fares.seat ? String(initialConfig.fares.seat / 100) : "")
    } else {
      setLowerFare("")
      setUpperFare("")
      setRearFare("")
      setSeatFare("")
    }
    setError(null)
  }, [initialConfig, isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const numLower = lowerFare ? Math.max(0, Math.round(parseFloat(lowerFare) * 100)) : 0
      const numUpper = upperFare ? Math.max(0, Math.round(parseFloat(upperFare) * 100)) : 0
      const numRear = rearFare ? Math.max(0, Math.round(parseFloat(rearFare) * 100)) : 0
      const numSeat = seatFare ? Math.max(0, Math.round(parseFloat(seatFare) * 100)) : 0

      const payload = {
        ladiesSeats: initialConfig?.ladiesSeats || [],
        couplePairs: initialConfig?.couplePairs || [],
        fares: {
          lower: numLower,
          upper: numUpper,
          rear: numRear,
          seat: numSeat,
        },
      }

      const token = getAuthToken()
      const res = await fetch(`/api/departures/${encodeURIComponent(departureKey)}/seat-config`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to save departure seat settings.")
      }

      toast.success("Departure seat settings updated successfully.")
      if (onSuccess) onSuccess(data.config)
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
      title="Departure Seat Settings & Fare Presets"
      description="Configure default fare suggestions, ladies-reserved seats, and couple pairs for this departure."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 text-xs rounded-[var(--yh-radius-md)] bg-danger-soft text-danger border border-danger-border">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Existing Config Stats Ribbon */}
        <div className="p-3 bg-surface-muted/60 rounded-[var(--yh-radius-lg)] border border-border-subtle grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-ink-muted block text-[11px] font-bold uppercase tracking-wider">Ladies Seats:</span>
            <span className="text-sm font-bold text-ink">
              {initialConfig?.ladiesSeats?.length || 0} seats reserved
            </span>
          </div>
          <div>
            <span className="text-ink-muted block text-[11px] font-bold uppercase tracking-wider">Couple Pairs:</span>
            <span className="text-sm font-bold text-ink">
              {initialConfig?.couplePairs?.length || 0} pairs linked
            </span>
          </div>
        </div>

        {/* Fare Presets Section */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink uppercase tracking-wider">
            <Sliders size={14} className="text-brand" />
            <span>Fare Presets (₹ per passenger)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Lower Berth Fare (₹)">
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 800"
                value={lowerFare}
                onChange={(e) => setLowerFare(e.target.value)}
              />
            </Field>

            <Field label="Upper Berth Fare (₹)">
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 700"
                value={upperFare}
                onChange={(e) => setUpperFare(e.target.value)}
              />
            </Field>

            <Field label="Rear Seat / Box Fare (₹)">
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 750"
                value={rearFare}
                onChange={(e) => setRearFare(e.target.value)}
              />
            </Field>

            <Field label="Seater Seat Fare (₹)">
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 500"
                value={seatFare}
                onChange={(e) => setSeatFare(e.target.value)}
              />
            </Field>
          </div>

          <p className="text-[11px] text-ink-muted flex items-start gap-1.5 pt-1">
            <Info size={13} className="text-brand shrink-0 mt-0.5" />
            <span>
              Fare presets provide convenient 1-click pricing suggestions when booking passengers on this departure. They never override custom rates or alter existing invoices.
            </span>
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading} icon={<Check size={14} />}>
            Save Seat Settings
          </Button>
        </div>
      </form>
    </Modal>
  )
}
