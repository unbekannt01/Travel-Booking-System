import { useState } from "react"
import {
  AlertCircle,
  Clock,
  CalendarClock,
  CheckCircle2,
  MessageCircle,
  X,
  History,
  Receipt,
  Ban,
  Printer,
  IndianRupee,
  FileText,
} from "lucide-react"
import { useToast } from "./common/ToastContext"
import { formatDisplayDate } from "../utils/date"
import { formatINR } from "../utils/formatters"
import { cn } from "../utils/cn"
import { getPaymentUrgencyMeta } from "../utils/dashboardOverview"
import { listPayments } from "../data/payments"
import { calculateBookingFinancials } from "../../shared/profitLoss.js"
import ReceiptModal from "./common/ReceiptModal"
import PaymentSummaryModal from "./common/PaymentSummaryModal"
import {
  Card,
  Badge,
  Button,
  StatCard,
  EmptyState,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Field,
  Input,
  Select,
  FOCUS_RING_CLASS,
} from "./ui"

const URGENCY_ICONS = {
  AlertCircle,
  Clock,
  CalendarClock,
}

export default function PaymentTracker({ bookings, onMarkPaid, onVoidPayment, user }) {
  const { toast } = useToast()
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMode, setPaymentMode] = useState("Cash")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [viewLedgerBooking, setViewLedgerBooking] = useState(null)
  const [ledgerPayments, setLedgerPayments] = useState([])
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [voidingPaymentId, setVoidingPaymentId] = useState(null)
  const [voidReason, setVoidReason] = useState("")
  const [viewReceiptPayment, setViewReceiptPayment] = useState(null)
  const [showPaymentSummaryModal, setShowPaymentSummaryModal] = useState(false)

  const closeLedgerModal = () => {
    setViewReceiptPayment(null)
    setViewLedgerBooking(null)
    setLedgerPayments([])
    setVoidingPaymentId(null)
    setShowPaymentSummaryModal(false)
  }

  const handleOpenLedger = (booking) => {
    setViewReceiptPayment(null)
    setViewLedgerBooking(booking)
    setLoadingLedger(true)
    const bId = booking._id || booking.id
    listPayments(bId)
      .then((data) => {
        setLedgerPayments(data || [])
      })
      .catch(() => {
        setLedgerPayments(booking.payments || [])
      })
      .finally(() => {
        setLoadingLedger(false)
      })
  }

  const pendingPayments = bookings
    .filter((b) => {
      if (b.status === "Cancelled" || b.status === "cancelled") return false
      const fin = calculateBookingFinancials(b)
      return fin.outstanding > 0
    })
    .map((b) => {
      const fin = calculateBookingFinancials(b)
      const journeyDate = new Date(b.journeyDate)
      const today = new Date()
      const daysUntilJourney = Math.ceil((journeyDate - today) / (1000 * 60 * 60 * 24))
      const urgencyMeta = getPaymentUrgencyMeta(daysUntilJourney)

      return {
        ...b,
        paid: fin.collected,
        balance: fin.outstanding,
        daysUntilJourney,
        urgency: urgencyMeta.bucket,
        urgencyMeta,
      }
    })
    .sort((a, b) => a.daysUntilJourney - b.daysUntilJourney)

  const totalDue = pendingPayments.reduce((sum, b) => sum + b.balance, 0)
  const urgentPayments = pendingPayments.filter((b) => b.urgency === "red")
  const urgentAmount = urgentPayments.reduce((sum, b) => sum + b.balance, 0)
  const followupPayments = pendingPayments.filter((b) => b.urgency === "yellow")
  const followupAmount = followupPayments.reduce((sum, b) => sum + b.balance, 0)

  const getUrgencyCardAccent = (bucket) => {
    if (bucket === "red") return "border-l-4 border-l-danger bg-surface"
    if (bucket === "yellow") return "border-l-4 border-l-warning bg-surface"
    return "border-l-4 border-l-info bg-surface"
  }

  const handleSendReminder = (booking) => {
    const fin = calculateBookingFinancials(booking)
    const message = `Hi ${booking.contactName}, this is a reminder that your balance of ₹${fin.outstanding} is due for ${booking.tourName} (Invoice: ${booking.invoiceNo}). Please make the payment at your earliest convenience. Thank you!`
    const phoneNumber = booking.contactPhone.replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleMarkPaid = (booking) => {
    const fin = calculateBookingFinancials(booking)
    setSelectedBooking(booking)
    setPaymentAmount(fin.outstanding.toString())
    setPaymentMode(booking.paymentMode || "Cash")
    setPaymentNotes("")
  }

  const submitPayment = () => {
    const num = Number(paymentAmount)
    if (!paymentAmount || isNaN(num) || num <= 0) {
      toast.error("Please enter a valid payment amount greater than zero")
      return
    }

    if (selectedBooking && num > selectedBooking.balance) {
      toast.error(`Payment cannot exceed remaining balance of ₹${selectedBooking.balance.toLocaleString()}`)
      return
    }

    onMarkPaid({
      bookingId: selectedBooking.id || selectedBooking._id,
      paymentAmount: num,
      paymentMode,
      paymentNotes,
    })

    setSelectedBooking(null)
    setPaymentAmount("")
    setPaymentMode("Cash")
    setPaymentNotes("")
  }

  const handleConfirmVoid = async (paymentId) => {
    if (!onVoidPayment) return
    const reason = voidReason.trim()
    if (!reason) return
    try {
      const res = await onVoidPayment(paymentId, reason)
      setLedgerPayments((prev) =>
        prev.map((p) =>
          (p._id || p.id) === paymentId
            ? { ...p, isVoid: true, voidReason: reason }
            : p
        )
      )
      setVoidingPaymentId(null)
      setVoidReason("")
      if (res?.booking) {
        setViewLedgerBooking(res.booking)
      }
    } catch {
      // Toast already shown
    }
  }

  const ledgerFin = viewLedgerBooking
    ? calculateBookingFinancials({
        ...viewLedgerBooking,
        payments: ledgerPayments.length > 0 ? ledgerPayments : viewLedgerBooking.payments,
      })
    : null

  return (
    <section aria-labelledby="payment-tracker-heading" className="space-y-4">
      <div>
        <h2 id="payment-tracker-heading" className="text-base sm:text-lg font-semibold text-ink">
          Payment Tracking &amp; Ledger
        </h2>
        <p className="text-xs sm:text-sm text-ink-muted">
          Monitor pending customer balances, send WhatsApp reminders, and inspect receipts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Due"
          value={formatINR(totalDue, 0)}
          hint={`${pendingPayments.length} pending ${pendingPayments.length === 1 ? "payment" : "payments"}`}
          icon={<IndianRupee size={20} />}
          tone="brand"
        />
        <StatCard
          label="Urgent (< 3 days)"
          value={urgentPayments.length}
          hint={formatINR(urgentAmount, 0)}
          icon={<AlertCircle size={20} />}
          tone="danger"
        />
        <StatCard
          label="Follow-up (3–10 days)"
          value={followupPayments.length}
          hint={formatINR(followupAmount, 0)}
          icon={<Clock size={20} />}
          tone="warning"
        />
      </div>

      {pendingPayments.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={24} />}
          title="All payments received"
          description="No pending balances at this moment."
        />
      ) : (
        <div className="space-y-3">
          {pendingPayments.map((booking) => {
            const meta = booking.urgencyMeta
            const UrgencyIcon = URGENCY_ICONS[meta.iconName] || AlertCircle

            return (
              <Card
                key={booking.id || booking._id}
                elevation="sm"
                padding="md"
                className={cn("transition-colors", getUrgencyCardAccent(booking.urgency))}
              >
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-semibold text-ink tabular-nums">
                          #{booking.invoiceNo}
                        </h3>
                        <Badge
                          variant={meta.variant}
                          size="sm"
                          icon={<UrgencyIcon size={12} strokeWidth={2.25} />}
                        >
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-ink truncate">
                        {booking.contactName}
                      </p>
                      <p className="text-xs text-ink-muted tabular-nums">
                        Phone: <span className="font-medium text-ink-secondary">+91 {booking.contactPhone}</span>
                      </p>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <p className="text-xl font-bold text-ink tabular-nums">
                        {formatINR(booking.balance, 0)}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5">Balance due</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-border-subtle text-xs sm:text-sm">
                    <div>
                      <p className="text-xs text-ink-muted">Journey</p>
                      <p className="font-semibold text-ink mt-0.5">{meta.countdownLabel}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-ink-muted">Tour</p>
                      <p className="font-semibold text-ink truncate mt-0.5">{booking.tourName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">Advance</p>
                      <p className="font-semibold text-success-text tabular-nums mt-0.5">
                        {formatINR(booking.paid !== undefined ? booking.paid : (booking.advanceReceived || 0), 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">Total</p>
                      <p className="font-semibold text-ink tabular-nums mt-0.5">
                        {formatINR(booking.totalAmount, 0)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      variant={booking.urgency === "red" ? "danger" : booking.urgency === "yellow" ? "accent" : "secondary"}
                      size="sm"
                      leftIcon={<MessageCircle size={15} />}
                      onClick={() => handleSendReminder(booking)}
                    >
                      Send Reminder
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      leftIcon={<CheckCircle2 size={15} />}
                      onClick={() => handleMarkPaid(booking)}
                    >
                      Record Payment
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<History size={15} />}
                      onClick={() => handleOpenLedger(booking)}
                    >
                      Payment History
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={Boolean(selectedBooking)}
        onClose={() => setSelectedBooking(null)}
        size="md"
        title="Record Payment"
        description={
          selectedBooking ? (
            <span>
              Invoice #{selectedBooking.invoiceNo} • {selectedBooking.contactName}
            </span>
          ) : null
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedBooking(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={submitPayment}
            >
              Confirm Payment
            </Button>
          </div>
        }
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-[var(--yh-radius-md)] bg-surface-muted/60 border border-border-subtle text-xs">
              <div>
                <span className="text-ink-muted block font-medium">Customer</span>
                <span className="font-semibold text-ink block truncate">{selectedBooking.contactName}</span>
                <span className="text-ink-muted text-[11px]">+91 {selectedBooking.contactPhone}</span>
              </div>
              <div>
                <span className="text-ink-muted block font-medium">Balance Due</span>
                <span className="font-bold text-danger-text text-base tabular-nums">
                  {formatINR(selectedBooking.balance, 0)}
                </span>
              </div>
            </div>

            <Field id="record-payment-amount" label="Payment Amount (₹)">
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min="1"
                  tabular
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              )}
            </Field>

            <Field id="record-payment-mode" label="Payment Mode">
              {({ id }) => (
                <Select
                  id={id}
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Card">Card</option>
                </Select>
              )}
            </Field>

            <Field id="record-payment-notes" label="Notes (Optional)">
              {({ id }) => (
                <Input
                  id={id}
                  type="text"
                  placeholder="e.g. UPI ref no, receipt voucher #, etc."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              )}
            </Field>
          </div>
        )}
      </Modal>

      {/* Payment History / Ledger Modal */}
      <Modal
        isOpen={Boolean(viewLedgerBooking)}
        onClose={closeLedgerModal}
        closeOnEscape={!viewReceiptPayment}
        closeOnBackdrop={!viewReceiptPayment}
        size="xl"
        className="max-w-3xl max-h-[90vh]"
        title={
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[var(--yh-radius-md)] bg-brand-soft text-brand shrink-0">
              <Receipt size={20} />
            </div>
            <div>
              <span className="text-base sm:text-lg font-bold text-ink">Payment Ledger</span>
              {viewLedgerBooking ? (
                <p className="text-xs text-ink-muted font-normal mt-0.5">
                  Invoice #{viewLedgerBooking.invoiceNo} — {viewLedgerBooking.contactName}
                </p>
              ) : null}
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end w-full">
            <Button type="button" variant="ghost" size="sm" onClick={closeLedgerModal}>
              Close
            </Button>
          </div>
        }
      >
        {viewLedgerBooking && (
          <div className="space-y-5">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-surface-muted/60 rounded-[var(--yh-radius-md)] border border-border-subtle">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-0.5">Total Package</p>
                <p className="text-base font-bold text-ink tabular-nums">{formatINR(viewLedgerBooking.totalAmount, 0)}</p>
              </div>
              <div className="p-3 bg-success-soft rounded-[var(--yh-radius-md)] text-success-text">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mb-0.5">Total Received</p>
                <p className="text-base font-bold tabular-nums">{formatINR(ledgerFin?.collected || 0, 0)}</p>
              </div>
              <div className="p-3 bg-warning-soft rounded-[var(--yh-radius-md)] text-warning-text">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mb-0.5">Balance Remaining</p>
                <p className="text-base font-bold tabular-nums">
                  {formatINR(ledgerFin?.outstanding || 0, 0)}
                </p>
              </div>
            </div>

            {/* Voiding Reason Prompt Sub-modal */}
            {voidingPaymentId && (
              <div role="alert" className="p-3.5 bg-warning-soft border border-border-subtle rounded-[var(--yh-radius-md)] space-y-2.5">
                <div className="flex items-center gap-2 text-warning-text font-semibold text-xs">
                  <Ban size={15} />
                  <span>Void Transaction — Reason for Audit Log:</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    aria-label="Reason for voiding payment"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="e.g. Entered wrong payment amount"
                    className={cn(
                      "flex-1 px-3 py-1.5 bg-surface border border-border-strong rounded-[var(--yh-radius-sm)] text-xs text-ink outline-none",
                      FOCUS_RING_CLASS,
                    )}
                  />
                  <div className="flex gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={!voidReason.trim()}
                      onClick={() => handleConfirmVoid(voidingPaymentId)}
                    >
                      Confirm Void
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVoidingPaymentId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Ledger Table */}
            <div className="border border-border-subtle rounded-[var(--yh-radius-md)] overflow-hidden">
              <div className="bg-surface-muted/60 px-4 py-2.5 border-b border-border-subtle flex justify-between items-center text-xs">
                <span className="font-semibold text-ink-muted uppercase tracking-wider text-[11px]">
                  Official Receipts &amp; Audit Ledger
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPaymentSummaryModal(true)}
                    className="text-xs h-7 px-2.5"
                    icon={<FileText size={12} />}
                  >
                    Payment Summary
                  </Button>
                  {loadingLedger && <span className="font-semibold text-brand text-[11px]">Loading ledger...</span>}
                </div>
              </div>
              {(ledgerPayments.length > 0 ? ledgerPayments : viewLedgerBooking.payments || []).length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Mode & Type</TableHead>
                        <TableHead align="right">Amount</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead align="center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ledgerPayments.length > 0 ? ledgerPayments : viewLedgerBooking.payments || []).map((p, idx) => {
                        const isRefund = p.type === "refund" || Number(p.amount) < 0
                        const isVoid = Boolean(p.isVoid)
                        return (
                          <TableRow key={p._id || idx} className={isVoid ? "opacity-50 line-through bg-surface-muted/40" : undefined}>
                            <TableCell className="font-mono text-xs font-semibold text-ink">
                              {p.receiptNo || `#REC-${idx + 1}`}
                            </TableCell>
                            <TableCell className="text-xs text-ink-secondary">
                              {formatDisplayDate(p.paymentDate || p.date)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-ink">{p.paymentMode || p.mode || "Cash"}</span>
                                <Badge variant={isRefund ? "danger" : "brand"} size="sm">
                                  {p.type || (isRefund ? "refund" : "payment")}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell align="right" tabular className={cn(
                              "font-bold text-xs",
                              isVoid ? "text-ink-muted line-through" : isRefund ? "text-danger-text" : "text-success-text",
                            )}>
                              {isRefund ? "-" : "+"}{formatINR(Math.abs(Number(p.amount)), 0)}
                            </TableCell>
                            <TableCell className="text-xs text-ink-muted max-w-xs truncate">
                              {isVoid ? (
                                <span className="text-danger-text font-semibold">[VOIDED: {p.voidReason || "Operator"}]</span>
                              ) : (
                                p.notes || "—"
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewReceiptPayment(p)}
                                  title="View & Print Official Receipt"
                                  className="text-xs h-7 px-2"
                                >
                                  <Printer size={11} className="mr-1" />
                                  <span>Receipt</span>
                                </Button>
                                {!isVoid && onVoidPayment && p._id ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setVoidingPaymentId(p._id)}
                                    className="text-xs h-7 px-2 text-danger-text hover:bg-danger-soft"
                                  >
                                    Void
                                  </Button>
                                ) : isVoid ? (
                                  <span className="text-[10px] font-semibold text-ink-muted uppercase">Voided</span>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-6 text-center text-ink-muted text-xs">
                  {(ledgerFin?.collected || 0) > 0 ? (
                    <div>
                      <p className="font-semibold text-ink">
                        Initial Advance Recorded: {formatINR(ledgerFin.collected, 0)}
                      </p>
                      <p className="text-xs text-ink-muted mt-1">Payment mode: {viewLedgerBooking.paymentMode || "Cash"}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setViewReceiptPayment({
                            receiptNo: `#${user?.receiptPrefix || "REC"}-001`,
                            amount: ledgerFin.collected,
                            paymentDate: viewLedgerBooking.date,
                            paymentMode: viewLedgerBooking.paymentMode || "Cash",
                            notes: "Initial advance received upon booking",
                          })
                        }
                        className="mt-3"
                      >
                        <Printer size={13} className="mr-1.5" />
                        <span>Print Advance Receipt</span>
                      </Button>
                    </div>
                  ) : (
                    "No payment records found for this booking."
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Official Payment Receipt Modal */}
      {viewReceiptPayment && viewLedgerBooking && (
        <ReceiptModal
          booking={viewLedgerBooking}
          payment={viewReceiptPayment}
          user={user}
          onClose={() => setViewReceiptPayment(null)}
        />
      )}

      {/* Passenger Payment Summary Modal (Output 1) */}
      {showPaymentSummaryModal && viewLedgerBooking && (
        <PaymentSummaryModal
          isOpen={showPaymentSummaryModal}
          onClose={() => setShowPaymentSummaryModal(false)}
          booking={viewLedgerBooking}
          payments={ledgerPayments.length > 0 ? ledgerPayments : viewLedgerBooking.payments || []}
          user={user}
        />
      )}
    </section>
  )
}
