import { useState, useEffect, useCallback } from "react"
import {
  Users,
  DollarSign,
  UserPlus,
  Trash2,
  Share2,
  AlertCircle,
  Copy,
  RotateCcw,
  Check,
  Printer,
} from "lucide-react"
import { Drawer, Button, Badge, ConfirmDialog } from "../ui"
import { useToast } from "../common/ToastContext"
import { formatINR } from "../../utils/formatters"
import { formatDisplayDate } from "../../utils/date"
import { request } from "../../data/client"
import RecordGroupPaymentModal from "./RecordGroupPaymentModal"
import AddGroupMemberModal from "./AddGroupMemberModal"
import PaymentSummaryModal from "../common/PaymentSummaryModal"

export default function GroupDetailDrawer({
  isOpen,
  onClose,
  groupId,
  onGroupUpdated,
  user,
}) {
  const { toast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [showPaymentSummaryModal, setShowPaymentSummaryModal] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [paymentToUndo, setPaymentToUndo] = useState(null)
  const [showDisbandConfirm, setShowDisbandConfirm] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchGroupDetail = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    setError("")
    try {
      const result = await request(`/api/groups/${groupId}`)
      setData(result)
    } catch (err) {
      setError(err.message || "Failed to load group details")
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    if (isOpen && groupId) {
      fetchGroupDetail()
    } else {
      setData(null)
    }
  }, [isOpen, groupId, fetchGroupDetail])

  const handleRemoveMember = async () => {
    if (!memberToRemove || !groupId) return
    setActionLoading(true)
    try {
      await request(`/api/groups/${groupId}/members/${memberToRemove._id}`, {
        method: "DELETE",
      })
      toast.success("Member removed from group")
      setMemberToRemove(null)
      fetchGroupDetail()
      if (onGroupUpdated) onGroupUpdated()
    } catch (err) {
      toast.error(err.message || "Failed to remove member")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDisbandGroup = async () => {
    if (!groupId) return
    setActionLoading(true)
    try {
      await request(`/api/groups/${groupId}/disband`, {
        method: "POST",
      })
      toast.success("Group disbanded successfully")
      setShowDisbandConfirm(false)
      if (onGroupUpdated) onGroupUpdated()
      onClose()
    } catch (err) {
      toast.error(err.message || "Failed to disband group")
    } finally {
      setActionLoading(false)
    }
  }

  const handleUndoPayment = async () => {
    if (!paymentToUndo || !groupId) return
    setActionLoading(true)
    try {
      const resData = await request(
        `/api/groups/${groupId}/payments/${paymentToUndo.groupPaymentId}/undo`,
        {
          method: "POST",
          body: JSON.stringify({ reason: "Undone by operator from group drawer" }),
        }
      )
      toast.success(resData.message || "Group payment undone")
      setPaymentToUndo(null)
      fetchGroupDetail()
      if (onGroupUpdated) onGroupUpdated()
    } catch (err) {
      toast.error(err.message || "Failed to undo payment")
    } finally {
      setActionLoading(false)
    }
  }

  const handleCopyWhatsAppSummary = async () => {
    if (!data?.group) return
    const g = data.group
    const totals = data.totals || {}
    let text = `*👥 GROUP BOOKING: ${g.name.toUpperCase()}*\n`
    text += `🚌 *Tour:* ${g.tourName}\n`
    text += `📅 *Date:* ${formatDisplayDate(g.journeyDate)} • *Bus:* ${g.busType}\n`
    if (g.leaderName) {
      text += `👤 *Leader:* ${g.leaderName}${g.leaderPhone ? ` (${g.leaderPhone})` : ""}\n`
    }
    text += `──────────────────────\n`
    text += `👥 *Total Members:* ${totals.memberCount} bookings (${totals.seatCount} seats)\n`
    text += `💰 *Total Fare:* ${formatINR(totals.totalAmount)}\n`
    text += `✅ *Total Paid:* ${formatINR(totals.advanceReceived)}\n`
    text += `⏳ *Balance Due:* ${formatINR(totals.balanceDue)}\n`
    text += `──────────────────────\n\n`

    text += `*Member Breakdown:*\n`
    ;(data.members || []).forEach((m, idx) => {
      const seats = (m.passengers || []).map((p) => p.seatId).filter(Boolean).join(", ")
      const bal = Math.max(0, (m.totalAmount || 0) - (m.advanceReceived || 0))
      text += `${idx + 1}. *${m.contactName}* (${m.invoiceNo})\n`
      text += `   Seats: ${seats || "None"} · Fare: ${formatINR(m.totalAmount)} · Bal: ${formatINR(bal)}\n`
    })

    try {
      await navigator.clipboard.writeText(text.trim())
      toast.success("Group summary copied for WhatsApp!")
    } catch {
      toast.error("Failed to copy summary to clipboard")
    }
  }

  const group = data?.group
  const members = data?.members || []
  const payments = data?.payments || []
  const totals = data?.totals || {}

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={group ? `Group: ${group.name}` : "Group Details"}
        size="lg"
      >
        {loading ? (
          <div className="py-12 text-center text-xs text-ink-muted">Loading group details...</div>
        ) : error ? (
          <div
            role="alert"
            className="p-4 rounded-[var(--yh-radius-md)] bg-danger-soft border border-danger/30 text-danger-text text-sm flex items-start gap-2"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-danger" />
            <p>{error}</p>
          </div>
        ) : group ? (
          <div className="space-y-6">
            {/* Header / Metadata Card */}
            <div className="p-3.5 bg-surface-muted/60 border border-border-subtle rounded-[var(--yh-radius-lg)] space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-ink">{group.name}</h3>
                  <p className="text-xs text-ink-muted">
                    {group.tourName} · {formatDisplayDate(group.journeyDate)} · {group.busType}
                  </p>
                </div>
                <Badge variant={group.status === "active" ? "success" : "neutral"} size="sm">
                  {group.status}
                </Badge>
              </div>

              {(group.leaderName || group.leaderPhone || group.note) && (
                <div className="pt-2 border-t border-border-subtle text-xs space-y-0.5 text-ink-secondary">
                  {group.leaderName && (
                    <p>
                      Leader: <strong className="text-ink">{group.leaderName}</strong>
                      {group.leaderPhone ? ` (${group.leaderPhone})` : ""}
                    </p>
                  )}
                  {group.note && <p className="text-ink-muted italic">"{group.note}"</p>}
                </div>
              )}
            </div>

            {/* Financial Totals Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-surface border border-border-subtle rounded-[var(--yh-radius-md)]">
                <p className="text-[10px] text-ink-muted uppercase font-bold">Members / Seats</p>
                <p className="text-sm font-bold text-ink tabular-nums mt-0.5">
                  {totals.memberCount} / {totals.seatCount}
                </p>
              </div>
              <div className="p-2.5 bg-surface border border-border-subtle rounded-[var(--yh-radius-md)]">
                <p className="text-[10px] text-ink-muted uppercase font-bold">Total Fare</p>
                <p className="text-sm font-bold text-ink tabular-nums mt-0.5">
                  {formatINR(totals.totalAmount)}
                </p>
              </div>
              <div className="p-2.5 bg-surface border border-border-subtle rounded-[var(--yh-radius-md)]">
                <p className="text-[10px] text-ink-muted uppercase font-bold">Paid</p>
                <p className="text-sm font-bold text-success-text tabular-nums mt-0.5">
                  {formatINR(totals.advanceReceived)}
                </p>
              </div>
              <div className="p-2.5 bg-surface border border-border-subtle rounded-[var(--yh-radius-md)]">
                <p className="text-[10px] text-ink-muted uppercase font-bold">Balance Due</p>
                <p className="text-sm font-bold text-danger-text tabular-nums mt-0.5">
                  {formatINR(totals.balanceDue)}
                </p>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="primary"
                size="sm"
                leftIcon={<DollarSign size={14} />}
                onClick={() => setShowPaymentModal(true)}
                disabled={totals.balanceDue <= 0 || group.status !== "active"}
              >
                Record Group Payment
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<UserPlus size={14} />}
                onClick={() => setShowAddMemberModal(true)}
                disabled={group.status !== "active"}
              >
                Add Member
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Copy size={14} />}
                onClick={handleCopyWhatsAppSummary}
              >
                Copy for WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Printer size={14} />}
                onClick={() => setShowPaymentSummaryModal(true)}
              >
                Payment Summary
              </Button>
              {group.status === "active" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger-dark"
                  onClick={() => setShowDisbandConfirm(true)}
                >
                  Disband
                </Button>
              )}
            </div>

            {/* Members Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-ink">Group Member Bookings ({members.length})</h4>
              </div>

              {members.length === 0 ? (
                <p className="text-xs text-ink-muted p-4 border border-dashed rounded text-center">
                  No member bookings assigned to this group.
                </p>
              ) : (
                <div
                  role="region"
                  aria-label="Group Members Table"
                  className="border border-border-subtle rounded-[var(--yh-radius-md)] overflow-x-auto"
                >
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-muted border-b border-border-subtle">
                      <tr>
                        <th className="py-2 px-2.5 font-semibold text-ink-muted">Member</th>
                        <th className="py-2 px-2.5 font-semibold text-ink-muted">Invoice</th>
                        <th className="py-2 px-2.5 font-semibold text-ink-muted">Seats</th>
                        <th className="py-2 px-2.5 font-semibold text-ink-muted text-right">Fare</th>
                        <th className="py-2 px-2.5 font-semibold text-ink-muted text-right">Paid</th>
                        <th className="py-2 px-2.5 font-semibold text-ink-muted text-right">Balance</th>
                        <th className="py-2 px-2.5 font-semibold text-ink-muted text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {members.map((m) => {
                        const bal = Math.max(0, (m.totalAmount || 0) - (m.advanceReceived || 0))
                        const seats = (m.passengers || []).map((p) => p.seatId).filter(Boolean)
                        return (
                          <tr key={m._id} className="hover:bg-surface-hover">
                            <td className="py-2 px-2.5 font-medium text-ink">
                              {m.contactName}
                              {m.contactPhone && (
                                <span className="block text-[10px] text-ink-muted font-normal">
                                  {m.contactPhone}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 font-mono text-[11px] text-ink-muted">
                              {m.invoiceNo}
                            </td>
                            <td className="py-2 px-2.5">
                              <div className="flex flex-wrap gap-1">
                                {seats.map((s) => (
                                  <Badge key={s} variant="primary" size="xs">
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-right tabular-nums text-ink">
                              {formatINR(m.totalAmount)}
                            </td>
                            <td className="py-2 px-2.5 text-right tabular-nums font-semibold text-success-text">
                              {formatINR(m.advanceReceived || 0)}
                            </td>
                            <td className="py-2 px-2.5 text-right tabular-nums font-semibold">
                              <span className={bal > 0 ? "text-danger-text" : "text-success-text"}>
                                {formatINR(bal)}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => setMemberToRemove(m)}
                                className="text-ink-muted hover:text-danger p-1 rounded cursor-pointer"
                                title="Remove from group"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Group Payments History */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-ink">Group Payments History ({payments.length})</h4>

              {payments.length === 0 ? (
                <p className="text-xs text-ink-muted p-4 border border-dashed rounded text-center">
                  No group payments recorded yet.
                </p>
              ) : (
                <div
                  role="region"
                  aria-label="Group Payments History"
                  className="space-y-2"
                >
                  {payments.map((p) => {
                    const isUndone = p.status === "undone"
                    return (
                      <div
                        key={p._id}
                        className={`p-3 rounded-[var(--yh-radius-md)] border text-xs space-y-1.5 ${
                          isUndone
                            ? "bg-surface-muted/40 border-border-subtle opacity-70"
                            : "bg-surface border-border-subtle"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-ink">{p.groupPaymentId}</span>
                            <Badge variant={isUndone ? "neutral" : "success"} size="xs">
                              {p.status}
                            </Badge>
                          </div>
                          <span className="font-bold tabular-nums text-sm text-ink">
                            {formatINR(p.totalAmount)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-ink-muted text-[11px]">
                          <span>
                            {formatDisplayDate(p.date)} · Mode: {p.paymentMode}
                            {p.referenceNo ? ` · Ref: ${p.referenceNo}` : ""}
                          </span>
                          {!isUndone && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              className="text-danger hover:text-danger-dark h-auto p-0 font-medium"
                              onClick={() => setPaymentToUndo(p)}
                            >
                              <RotateCcw size={11} className="mr-1" />
                              Undo Payment
                            </Button>
                          )}
                        </div>

                        {p.notes && <p className="text-[11px] text-ink-muted italic">"{p.notes}"</p>}

                        {/* Allocations detail */}
                        {p.allocations?.length > 0 && (
                          <div className="pt-1.5 border-t border-border-subtle/60 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                            {p.allocations.map((a, i) => (
                              <span key={i}>
                                Rec #{a.receiptNo || "—"}: <strong>{formatINR(a.amount)}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Record Group Payment Modal */}
      {showPaymentModal && group && (
        <RecordGroupPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          group={group}
          members={members}
          onPaymentSuccess={() => {
            fetchGroupDetail()
            if (onGroupUpdated) onGroupUpdated()
          }}
        />
      )}

      {/* Add Group Member Modal */}
      {showAddMemberModal && group && (
        <AddGroupMemberModal
          isOpen={showAddMemberModal}
          onClose={() => setShowAddMemberModal(false)}
          group={group}
          onMemberAdded={() => {
            fetchGroupDetail()
            if (onGroupUpdated) onGroupUpdated()
          }}
        />
      )}

      {/* Confirm Remove Member Dialog */}
      {memberToRemove && (
        <ConfirmDialog
          isOpen={Boolean(memberToRemove)}
          onClose={() => setMemberToRemove(null)}
          title="Remove Member from Group"
          message={`Are you sure you want to remove ${memberToRemove.contactName} (${memberToRemove.invoiceNo}) from this group? The booking will remain active on the departure.`}
          confirmLabel="Remove Member"
          variant="danger"
          onConfirm={handleRemoveMember}
          loading={actionLoading}
        />
      )}

      {/* Confirm Undo Payment Dialog */}
      {paymentToUndo && (
        <ConfirmDialog
          isOpen={Boolean(paymentToUndo)}
          onClose={() => setPaymentToUndo(null)}
          title="Undo Group Payment"
          message={`Are you sure you want to undo group payment ${paymentToUndo.groupPaymentId} for ${formatINR(paymentToUndo.totalAmount)}? This will void all associated receipt records and restore member balances.`}
          confirmLabel="Undo Payment"
          variant="danger"
          onConfirm={handleUndoPayment}
          loading={actionLoading}
        />
      )}

      {/* Confirm Disband Group Dialog */}
      {showDisbandConfirm && group && (
        <ConfirmDialog
          isOpen={showDisbandConfirm}
          onClose={() => setShowDisbandConfirm(false)}
          title="Disband Group"
          message={`Are you sure you want to disband '${group.name}'? All member bookings and payments will remain completely intact on the departure.`}
          confirmLabel="Disband Group"
          variant="danger"
          onConfirm={handleDisbandGroup}
          loading={actionLoading}
        />
      )}

      {/* Group Payment Summary Print / Download Modal (Output 1) */}
      {showPaymentSummaryModal && group && (
        <PaymentSummaryModal
          isOpen={showPaymentSummaryModal}
          onClose={() => setShowPaymentSummaryModal(false)}
          group={group}
          memberBookings={members}
          groupPayments={payments}
          payments={data?.memberPayments || []}
          user={user}
        />
      )}
    </>
  )
}
