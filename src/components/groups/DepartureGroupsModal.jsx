import { useState, useEffect, useCallback } from "react"
import { Users, Plus, DollarSign, ChevronRight, AlertCircle } from "lucide-react"
import { Modal, Button, Badge, Card } from "../ui"
import { formatINR } from "../../utils/formatters"
import { formatDisplayDate } from "../../utils/date"
import { request } from "../../data/client"

export default function DepartureGroupsModal({
  isOpen,
  onClose,
  departure, // { key, tourName, journeyDate, busType }
  onOpenGroupDetail,
  onOpenNewGroupBooking,
}) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const fetchGroups = useCallback(async () => {
    if (!departure?.key) return
    setLoading(true)
    setError("")
    try {
      const data = await request(`/api/groups/departure/${encodeURIComponent(departure.key)}`)
      setGroups(data.groups || [])
    } catch (err) {
      setError(err.message || "Failed to load departure groups")
    } finally {
      setLoading(false)
    }
  }, [departure])

  useEffect(() => {
    if (isOpen && departure?.key) {
      fetchGroups()
    } else {
      setGroups([])
    }
  }, [isOpen, departure, fetchGroups])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={departure ? `Groups for ${departure.tourName}` : "Departure Groups"}
      size="lg"
    >
      <div className="space-y-4">
        {/* Departure metadata */}
        {departure && (
          <div className="p-3 bg-surface-muted/50 border border-border-subtle rounded-[var(--yh-radius-md)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-bold text-ink">{departure.tourName}</span> ·{" "}
              <span className="text-ink-muted">
                {formatDisplayDate(departure.journeyDate)} • {departure.busType}
              </span>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => {
                onClose()
                if (onOpenNewGroupBooking) onOpenNewGroupBooking(departure)
              }}
            >
              New Group Booking
            </Button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 rounded-[var(--yh-radius-md)] bg-danger-soft border border-danger/30 text-danger-text text-xs flex items-start gap-2"
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-danger" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-ink-muted">Loading departure groups...</div>
        ) : groups.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-border-subtle rounded-[var(--yh-radius-lg)] space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Users size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-ink">No Groups on this Departure</h4>
              <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                Create a group booking to manage families, corporate groups, and split payments.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => {
                onClose()
                if (onOpenNewGroupBooking) onOpenNewGroupBooking(departure)
              }}
            >
              Create Group Booking
            </Button>
          </div>
        ) : (
          <div
            role="region"
            aria-label="Departure Groups List"
            className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1"
          >
            {groups.map((g) => (
              <Card
                key={g._id}
                padding="md"
                elevation="sm"
                className="space-y-3 border border-border-subtle hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-ink">{g.name}</h4>
                      <Badge variant={g.status === "active" ? "success" : "neutral"} size="xs">
                        {g.status}
                      </Badge>
                    </div>
                    {g.leaderName && (
                      <p className="text-xs text-ink-muted mt-0.5">
                        Leader: <strong className="text-ink font-medium">{g.leaderName}</strong>
                        {g.leaderPhone ? ` (${g.leaderPhone})` : ""}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      onClose()
                      if (onOpenGroupDetail) onOpenGroupDetail(g._id)
                    }}
                    rightIcon={<ChevronRight size={13} />}
                  >
                    View Group
                  </Button>
                </div>

                <div className="grid grid-cols-5 gap-2 text-center text-xs pt-2 border-t border-border-subtle/80 bg-surface-muted/30 p-2 rounded">
                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase">Bookings</span>
                    <strong className="text-ink">{g.memberCount}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase">Seats</span>
                    <strong className="text-ink">{g.seatCount}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase">Total Fare</span>
                    <strong className="text-ink">{formatINR(g.totalAmount)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase">Paid</span>
                    <strong className="text-success-text">{formatINR(g.advanceReceived || 0)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-muted block uppercase">Balance Due</span>
                    <strong className={g.balanceDue > 0 ? "text-danger-text" : "text-success-text"}>
                      {formatINR(g.balanceDue)}
                    </strong>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border-subtle">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
