import { useState, useEffect, useCallback } from "react"
import { UserPlus, AlertCircle, Check } from "lucide-react"
import { Modal, Button, Checkbox } from "../ui"
import { useToast } from "../common/ToastContext"
import { formatINR } from "../../utils/formatters"

export default function AddGroupMemberModal({
  isOpen,
  onClose,
  group,
  onMemberAdded,
}) {
  const { toast } = useToast()
  const [candidates, setCandidates] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const fetchCandidates = useCallback(async () => {
    if (!group) return
    setLoading(true)
    try {
      const departureKey = `${group.tourName}___${group.journeyDate}___${group.busType}`
      const res = await fetch(`/api/departures/${encodeURIComponent(departureKey)}/bookings`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      })
      if (!res.ok) throw new Error("Failed to load departure bookings")
      const data = await res.json()
      // Filter out bookings that already have a groupId
      const unassigned = (data.bookings || []).filter((b) => !b.groupId && !b.deletedAt)
      setCandidates(unassigned)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [group])

  useEffect(() => {
    if (isOpen && group) {
      setSelectedIds(new Set())
      setError("")
      fetchCandidates()
    }
  }, [isOpen, group, fetchCandidates])

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedIds.size === 0 || !group) return

    setIsSubmitting(true)
    setError("")

    try {
      const res = await fetch(`/api/groups/${group._id}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ bookingIds: Array.from(selectedIds) }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to add members")

      toast.success(data.message || "Members added to group successfully")
      if (onMemberAdded) onMemberAdded()
      onClose()
    } catch (err) {
      setError(err.message)
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
      title={`Add Existing Bookings to ${group?.name || "Group"}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="p-3 rounded-[var(--yh-radius-md)] bg-danger-soft border border-danger/30 text-danger-text text-sm flex items-start gap-2"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-danger" />
            <p>{error}</p>
          </div>
        )}

        <p className="text-xs text-ink-muted">
          Select bookings from this departure that do not currently belong to any group.
        </p>

        {loading ? (
          <div className="py-8 text-center text-xs text-ink-muted">Loading bookings...</div>
        ) : candidates.length === 0 ? (
          <div className="py-6 text-center text-xs text-ink-muted border border-dashed border-border-subtle rounded-[var(--yh-radius-md)]">
            No unassigned bookings found on this departure.
          </div>
        ) : (
          <div
            role="region"
            aria-label="Available Bookings List"
            className="border border-border-subtle rounded-[var(--yh-radius-md)] divide-y divide-border-subtle max-h-60 overflow-y-auto"
          >
            {candidates.map((b) => {
              const isChecked = selectedIds.has(b._id)
              const seatCount = b.passengers?.length || 0
              const checkboxId = `candidate-${b._id}`
              return (
                <div
                  key={b._id}
                  className="p-2.5 flex items-center justify-between hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(b._id)}
                      className="rounded border-border text-brand focus:ring-brand cursor-pointer"
                    />
                    <label
                      htmlFor={checkboxId}
                      className="cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-ink">{b.contactName}</p>
                      <p className="text-[11px] text-ink-muted">
                        Invoice: <span className="font-mono">{b.invoiceNo}</span> · {seatCount} seat{seatCount === 1 ? "" : "s"}
                      </p>
                    </label>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold text-ink tabular-nums">{formatINR(b.totalAmount)}</p>
                    <p className="text-[10px] text-ink-muted">
                      Bal: {formatINR(Math.max(0, b.totalAmount - (b.advanceReceived || 0)))}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
          <span className="text-ink-muted">
            Selected: <strong className="text-ink">{selectedIds.size}</strong> booking(s)
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={selectedIds.size === 0 || isSubmitting}
              leftIcon={<Check size={14} />}
            >
              {isSubmitting ? "Adding..." : "Add Selected"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
