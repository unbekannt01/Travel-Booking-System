import { useState } from "react"
import {
  User,
  Clock,
  ShieldAlert,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Phone,
  MapPin,
  Calendar,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Drawer, Button, ConfirmDialog, Field, Select, Input } from "../ui"
import { formatINR, formatSeatLabel } from "../../utils/formatters"
import { getAuthToken } from "../../data/adapters/rest"
import { useToast } from "../common/ToastContext"

export default function SeatActionDrawer({
  isOpen,
  onClose,
  seat,
  onOpenHoldModal,
  onOpenMoveModal,
  onBookSeat,
  onRefresh,
}) {
  const { toast } = useToast()
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [extendMinutes, setExtendMinutes] = useState(60)
  const [showExtendControls, setShowExtendControls] = useState(false)

  if (!seat) return null

  const isBooked = seat.status === "booked"
  const isHeld = seat.status === "held"
  const isBlocked = seat.status === "blocked"
  const isAvailable = seat.status === "available"

  const handleRelease = async () => {
    if (!seat.holdId) return
    setActionLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/seat-holds/${seat.holdId}/release`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to release seat hold")
      }
      toast.success(`Successfully released ${seat.kind || "hold"} on seat ${formatSeatLabel(seat.seatId || seat.seatName || seat.seatNumber)}`)
      setReleaseConfirmOpen(false)
      onClose()
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleExtend = async () => {
    if (!seat.holdId) return
    setActionLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/seat-holds/${seat.holdId}/extend`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ durationMinutes: Number(extendMinutes) }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to extend hold")
      }
      toast.success(`Hold extended by ${extendMinutes} minutes`)
      setShowExtendControls(false)
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleMode = async () => {
    if (!seat.holdId) return
    const targetMode = seat.mode === "timed" ? "manual" : "timed"
    setActionLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/seat-holds/${seat.holdId}/convert-mode`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: targetMode,
          durationMinutes: targetMode === "timed" ? 120 : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || "Failed to convert mode")
      }
      toast.success(`Hold converted to ${targetMode} mode`)
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">
              Seat #{seat.seatNumber} — {formatSeatLabel(seat.seatId || seat.seatName)}
            </span>
          </div>
        }
        description={`Deck: ${seat.deck || "Standard"} • Cabin: ${seat.cabin || "Single"}`}
        side="right"
      >
        <div className="space-y-5 py-2">
          {/* Status Badge Ribbon */}
          <div className="flex items-center justify-between p-3 rounded-[var(--yh-radius-lg)] border border-border-subtle bg-surface-muted/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Status:</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isAvailable
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : isBooked
                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                      : isHeld
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                }`}
              >
                {isAvailable && "Available"}
                {isBooked && "Booked"}
                {isHeld && (seat.mode === "manual" ? "📌 Manual Hold" : `⏱ Held (${seat.remainingText || "Timed"})`)}
                {isBlocked && "🔒 Blocked"}
              </span>
            </div>

            {seat.groupId && (
              <span className="text-xs font-mono font-bold text-ink-muted bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                Group #{seat.bookingRef?.split("-").slice(-1)[0] || seat.groupId.slice(-3).toUpperCase()}
              </span>
            )}
          </div>

          {/* ── AVAILABLE ACTIONS ── */}
          {isAvailable && (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">
                This berth is currently unoccupied and ready to be booked, held for a customer, or blocked for operational requirements.
              </p>

              <div className="grid grid-cols-1 gap-2 pt-2">
                <Button
                  variant="primary"
                  className="w-full justify-center min-h-11"
                  onClick={() => {
                    onClose()
                    onBookSeat({ seatId: seat.seatId })
                  }}
                >
                  Book This Seat Now
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    className="w-full justify-center min-h-11 border-amber-400/40 text-amber-700 dark:text-amber-300"
                    onClick={() => {
                      onClose()
                      onOpenHoldModal({ seatId: seat.seatId, kind: "hold" })
                    }}
                  >
                    Hold for Customer
                  </Button>

                  <Button
                    variant="secondary"
                    className="w-full justify-center min-h-11 border-rose-400/40 text-rose-700 dark:text-rose-300"
                    onClick={() => {
                      onClose()
                      onOpenHoldModal({ seatId: seat.seatId, kind: "block" })
                    }}
                  >
                    Operational Block
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── BOOKED PASSENGER DETAILS ── */}
          {isBooked && (
            <div className="space-y-4">
              <div className="p-3.5 bg-surface rounded-[var(--yh-radius-xl)] border border-border-subtle shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-brand" />
                    <span className="font-bold text-ink text-sm">{seat.passengerName || "Traveler"}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      seat.gender?.toLowerCase() === "female"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                    }`}
                  >
                    {seat.gender || "Passenger"} {seat.age ? `• ${seat.age} yrs` : ""}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-ink-muted block text-[11px]">Contact Phone</span>
                    <span className="font-medium text-ink flex items-center gap-1 mt-0.5">
                      <Phone size={12} className="text-ink-muted" />
                      {seat.contactPhone || "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-muted block text-[11px]">Boarding / Pickup</span>
                    <span className="font-medium text-ink flex items-center gap-1 mt-0.5 truncate" title={seat.pickupPoint}>
                      <MapPin size={12} className="text-ink-muted" />
                      {seat.pickupPoint || seat.city || "Departure point"}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-muted block text-[11px]">Booking Invoice</span>
                    <span className="font-mono font-bold text-brand mt-0.5 block">{seat.bookingRef || "N/A"}</span>
                  </div>

                  <div>
                    <span className="text-ink-muted block text-[11px]">Ledger Payment</span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold mt-0.5 ${
                        seat.paymentState === "paid"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : seat.paymentState === "partial"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {seat.paymentState === "paid" && "✓ Fully Paid"}
                      {seat.paymentState === "partial" && `½ Partial (${formatINR(seat.balanceDue || 0)} due)`}
                      {seat.paymentState === "unpaid" && `✗ Unpaid (${formatINR(seat.balanceDue || seat.totalAmount || 0)})`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-2">
                <Button
                  variant="secondary"
                  className="w-full justify-center min-h-11"
                  onClick={() => {
                    onClose()
                    onOpenMoveModal({
                      bookingId: seat.bookingId,
                      passenger: {
                        paxId: seat.paxId,
                        name: seat.passengerName,
                        seatId: seat.seatId,
                        seatNumber: seat.seatNumber,
                      },
                    })
                  }}
                  icon={<ArrowRightLeft size={15} />}
                >
                  Move Passenger to Another Seat
                </Button>
              </div>
            </div>
          )}

          {/* ── HELD SEAT DETAILS ── */}
          {isHeld && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-500/10 rounded-[var(--yh-radius-xl)] border border-amber-500/25 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <span className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                    {seat.holderName ? `Held for: ${seat.holderName}` : "Customer Hold"}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300">
                    {seat.mode === "manual" ? "No Auto-Expiry" : seat.remainingText || "Active"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {seat.phone && (
                    <div className="flex items-center gap-1.5 text-ink">
                      <Phone size={13} className="text-ink-muted" />
                      <span>{seat.phone}</span>
                    </div>
                  )}

                  {seat.expiresAt && (
                    <div className="flex items-center gap-1.5 text-ink-muted">
                      <Clock size={13} />
                      <span>Expires at: {new Date(seat.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}

                  {seat.note && (
                    <div className="p-2 rounded bg-surface/80 border border-border-subtle text-ink italic text-[11px]">
                      "{seat.note}"
                    </div>
                  )}
                </div>
              </div>

              {/* Extend Controls */}
              {seat.mode === "timed" && (
                <div className="space-y-2">
                  {!showExtendControls ? (
                    <Button
                      variant="secondary"
                      className="w-full justify-center text-xs min-h-10"
                      onClick={() => setShowExtendControls(true)}
                      icon={<Clock size={14} />}
                    >
                      Extend Hold Duration
                    </Button>
                  ) : (
                    <div className="p-3 bg-surface-muted/60 rounded-[var(--yh-radius-lg)] border border-border-subtle space-y-2.5">
                      <span className="text-xs font-bold text-ink block">Add extra time:</span>
                      <div className="flex items-center gap-2">
                        <Select
                          value={extendMinutes}
                          onChange={(e) => setExtendMinutes(Number(e.target.value))}
                          className="text-xs"
                        >
                          <option value={15}>+ 15 minutes</option>
                          <option value={30}>+ 30 minutes</option>
                          <option value={60}>+ 1 hour</option>
                          <option value={120}>+ 2 hours</option>
                          <option value={360}>+ 6 hours</option>
                          <option value={1440}>+ 1 day</option>
                        </Select>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleExtend}
                          loading={actionLoading}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowExtendControls(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mode toggle */}
              <Button
                variant="secondary"
                className="w-full justify-center text-xs min-h-10"
                onClick={handleToggleMode}
                disabled={actionLoading}
              >
                {seat.mode === "timed" ? "Convert to Manual Hold" : "Convert to Timed (Auto-expires)"}
              </Button>

              {/* Convert to booking */}
              <Button
                variant="primary"
                className="w-full justify-center min-h-11"
                onClick={() => {
                  onClose()
                  onBookSeat({
                    seatId: seat.seatId,
                    holdId: seat.holdId,
                    holderName: seat.holderName,
                    phone: seat.phone,
                  })
                }}
              >
                Book This Seat (Converts Hold)
              </Button>

              {/* Release button */}
              <Button
                variant="danger"
                className="w-full justify-center min-h-11"
                onClick={() => setReleaseConfirmOpen(true)}
                disabled={actionLoading}
                icon={<Trash2 size={15} />}
              >
                Release Hold Immediately
              </Button>
            </div>
          )}

          {/* ── BLOCKED SEAT DETAILS ── */}
          {isBlocked && (
            <div className="space-y-4">
              <div className="p-3.5 bg-rose-500/10 rounded-[var(--yh-radius-xl)] border border-rose-500/25 space-y-2">
                <span className="font-bold text-rose-900 dark:text-rose-200 text-sm block">
                  Operational Block
                </span>
                {seat.holderName && (
                  <p className="text-xs text-ink font-medium">Authority: {seat.holderName}</p>
                )}
                {seat.note && (
                  <p className="text-xs text-ink-muted italic">"{seat.note}"</p>
                )}
              </div>

              <Button
                variant="danger"
                className="w-full justify-center min-h-11"
                onClick={() => setReleaseConfirmOpen(true)}
                disabled={actionLoading}
              >
                Release Operational Block
              </Button>
            </div>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        isOpen={releaseConfirmOpen}
        onCancel={() => setReleaseConfirmOpen(false)}
        onConfirm={handleRelease}
        title={seat.kind === "block" ? "Release Seat Block?" : "Release Customer Hold?"}
        message={`Are you sure you want to release seat ${formatSeatLabel(seat.seatId || seat.seatName || seat.seatNumber)}? The seat will immediately become free and bookable for any customer.`}
        confirmText="Release Seat"
        isDestructive
        loading={actionLoading}
      />
    </>
  )
}
