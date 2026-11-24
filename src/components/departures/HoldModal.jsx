import { useState, useEffect } from "react"
import { Clock, ShieldAlert, AlertCircle, Check } from "lucide-react"
import { Modal, Button, Input, Select, Textarea, Field } from "../ui"
import { useToast } from "../common/ToastContext"
import { getAuthToken } from "../../data/adapters/rest"

const PRESET_DURATIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "6 hours", value: 360 },
  { label: "12 hours", value: 720 },
  { label: "1 day", value: 1440 },
  { label: "2 days", value: 2880 },
  { label: "3 days", value: 4320 },
  { label: "7 days", value: 10080 },
]

export default function HoldModal({
  isOpen,
  onClose,
  departureKey,
  selectedSeats = [],
  initialKind = "hold",
  onSuccess,
}) {
  const { toast } = useToast()
  const [kind, setKind] = useState(initialKind) // "hold" | "block"
  const [mode, setMode] = useState("timed") // "timed" | "manual"
  const [selectedPreset, setSelectedPreset] = useState(60) // minutes
  const [isCustom, setIsCustom] = useState(false)
  const [customValue, setCustomValue] = useState("1")
  const [customUnit, setCustomUnit] = useState("hours") // "minutes" | "hours" | "days"

  const [holderName, setHolderName] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setKind(initialKind)
      setMode("timed")
      setSelectedPreset(60)
      setIsCustom(false)
      setCustomValue("1")
      setCustomUnit("hours")
      setHolderName("")
      setPhone("")
      setNote("")
      setError(null)
    }
  }, [isOpen, initialKind])

  const calculateDurationMinutes = () => {
    if (mode === "manual") return undefined
    if (!isCustom) return selectedPreset

    const val = parseInt(customValue, 10)
    if (isNaN(val) || val <= 0) return 60
    if (customUnit === "minutes") return val
    if (customUnit === "hours") return val * 60
    if (customUnit === "days") return val * 1440
    return 60
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!selectedSeats || selectedSeats.length === 0) {
      setError("Please select at least one seat.")
      return
    }

    const durationMinutes = calculateDurationMinutes()
    if (mode === "timed") {
      if (!durationMinutes || durationMinutes < 5 || durationMinutes > 43200) {
        setError("Duration must be between 5 minutes and 30 days (43,200 minutes).")
        return
      }
    }

    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim().replace(/\D/g, ""))) {
      setError("Please provide a valid 10-digit Indian mobile number.")
      return
    }

    setLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch("/api/seat-holds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: departureKey,
          seatIds: selectedSeats,
          kind,
          mode,
          durationMinutes: mode === "timed" ? durationMinutes : undefined,
          holderName: holderName.trim() || undefined,
          phone: phone.trim() || undefined,
          note: note.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Failed to create seat hold")
      }

      toast.success(
        kind === "block"
          ? `Successfully blocked ${selectedSeats.length} seat(s)`
          : `Successfully held ${selectedSeats.length} seat(s)`,
      )
      if (onSuccess) onSuccess(data)
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
      title={kind === "block" ? "Block Seat(s)" : "Hold Seat(s)"}
      description={`Departure: ${decodeURIComponent(departureKey || "").replace(/___/g, " • ")}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 text-xs rounded-[var(--yh-radius-md)] bg-danger-soft text-danger border border-danger-border">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-surface-muted/60 rounded-[var(--yh-radius-md)] border border-border-subtle">
          <span className="text-xs font-semibold text-ink-muted block mb-1.5">Target Seats ({selectedSeats.length}):</span>
          <div className="flex flex-wrap gap-1.5">
            {selectedSeats.map((s) => (
              <span
                key={s}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-brand-soft text-brand border border-border-subtle"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Kind selector: Hold vs Block */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind("hold")}
            className={`min-h-11 px-3 py-2 rounded-[var(--yh-radius-md)] text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              kind === "hold"
                ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500"
                : "bg-surface border-border-subtle text-ink-muted hover:bg-surface-hover"
            }`}
          >
            <Clock size={15} />
            <span>Customer Hold</span>
          </button>
          <button
            type="button"
            onClick={() => setKind("block")}
            className={`min-h-11 px-3 py-2 rounded-[var(--yh-radius-md)] text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              kind === "block"
                ? "bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500"
                : "bg-surface border-border-subtle text-ink-muted hover:bg-surface-hover"
            }`}
          >
            <ShieldAlert size={15} />
            <span>Operational Block</span>
          </button>
        </div>

        {/* Mode selector: Timed vs Manual */}
        <Field label="Hold Type & Expiry Mode">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("timed")}
              className={`min-h-11 px-3 py-2 rounded-[var(--yh-radius-md)] text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === "timed"
                  ? "bg-brand-soft border-brand text-brand ring-1 ring-brand"
                  : "bg-surface border-border-subtle text-ink-muted hover:bg-surface-hover"
              }`}
            >
              <span>⏱ Timed (Auto-expires)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`min-h-11 px-3 py-2 rounded-[var(--yh-radius-md)] text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === "manual"
                  ? "bg-brand-soft border-brand text-brand ring-1 ring-brand"
                  : "bg-surface border-border-subtle text-ink-muted hover:bg-surface-hover"
              }`}
            >
              <span>📌 Manual (Operator releases)</span>
            </button>
          </div>
        </Field>

        {mode === "timed" && (
          <div className="space-y-3 p-3 bg-surface-muted/40 rounded-[var(--yh-radius-lg)] border border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Duration Presets</span>
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-xs text-brand hover:underline font-semibold cursor-pointer"
              >
                {isCustom ? "Use standard presets" : "Enter custom duration"}
              </button>
            </div>

            {!isCustom ? (
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_DURATIONS.map((preset) => {
                  const active = selectedPreset === preset.value
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setSelectedPreset(preset.value)}
                      className={`min-h-10 px-2 py-1.5 rounded-[var(--yh-radius-md)] text-xs font-semibold border transition-colors cursor-pointer text-center ${
                        active
                          ? "bg-brand text-brand-fg border-brand font-bold shadow-xs"
                          : "bg-surface border-border-subtle text-ink hover:bg-surface-hover"
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Custom Amount">
                  <Input
                    type="number"
                    min="1"
                    max="43200"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Unit">
                  <Select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}>
                    <option value="minutes">Minutes (min 5)</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days (max 30)</option>
                  </Select>
                </Field>
              </div>
            )}
          </div>
        )}

        {/* Optional Holder Details */}
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <Field label={kind === "block" ? "Reason / Authority (Optional)" : "Customer / Passenger Name (Optional)"}>
            <Input
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder={kind === "block" ? "e.g. VIP / Staff Reserved / Maintenance" : "e.g. Rajeshbhai Patel"}
              maxLength={100}
            />
          </Field>

          {kind === "hold" && (
            <Field label="Customer Contact Phone (Optional)">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={15}
              />
            </Field>
          )}

          <Field label="Internal Operator Note (Optional)">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Will confirm advance payment by 4 PM"
              rows={2}
              maxLength={200}
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {kind === "block" ? "Confirm Block" : "Confirm Hold"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
