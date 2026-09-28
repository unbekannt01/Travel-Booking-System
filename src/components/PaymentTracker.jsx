import { useState } from "react"
import { AlertCircle, Clock, CheckCircle2, MessageCircle, X, History, Landmark, Receipt, Ban } from "lucide-react"
import { useToast } from "./common/ToastContext"
import { formatDisplayDate } from "../utils/date"
import { listPayments } from "../data/payments"

export default function PaymentTracker({ bookings, onMarkPaid, onVoidPayment }) {
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

  const closeLedgerModal = () => {
    setViewLedgerBooking(null)
    setLedgerPayments([])
    setVoidingPaymentId(null)
  }

  const handleOpenLedger = (booking) => {
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
      const balance = b.totalAmount - (b.advanceReceived || 0)
      return balance > 0
    })
    .map((b) => {
      const journeyDate = new Date(b.journeyDate)
      const today = new Date()
      const daysUntilJourney = Math.ceil((journeyDate - today) / (1000 * 60 * 60 * 24))

      let urgency = "green"
      if (daysUntilJourney < 3) urgency = "red"
      else if (daysUntilJourney < 10) urgency = "yellow"

      return {
        ...b,
        balance: b.totalAmount - (b.advanceReceived || 0),
        daysUntilJourney,
        urgency,
      }
    })
    .sort((a, b) => a.daysUntilJourney - b.daysUntilJourney)

  const totalDue = pendingPayments.reduce((sum, b) => sum + b.balance, 0)

  const getUrgencyColor = (urgency) => {
    if (urgency === "red") return "bg-red-50 border-red-200"
    if (urgency === "yellow") return "bg-yellow-50 border-yellow-200"
    return "bg-green-50 border-green-200"
  }

  const getUrgencyIcon = (urgency) => {
    if (urgency === "red") return <AlertCircle className="text-red-600" size={18} />
    if (urgency === "yellow") return <Clock className="text-yellow-600" size={18} />
    return <CheckCircle2 className="text-green-600" size={18} />
  }

  const getUrgencyText = (urgency) => {
    if (urgency === "red") return "URGENT"
    if (urgency === "yellow") return "FOLLOW-UP NEEDED"
    return "PAID / CONFIRMED"
  }

  const handleSendReminder = (booking) => {
    const message = `Hi ${booking.contactName}, this is a reminder that your balance of ₹${booking.totalAmount - (booking.advanceReceived || 0)} is due for ${booking.tourName} (Invoice: ${booking.invoiceNo}). Please make the payment at your earliest convenience. Thank you!`
    const phoneNumber = booking.contactPhone.replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleMarkPaid = (booking) => {
    setSelectedBooking(booking)
    setPaymentAmount((booking.totalAmount - (booking.advanceReceived || 0)).toString())
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
    try {
      const res = await onVoidPayment(paymentId, voidReason || "Voided by operator")
      setLedgerPayments((prev) =>
        prev.map((p) =>
          (p._id || p.id) === paymentId
            ? { ...p, isVoid: true, voidReason: voidReason || "Voided by operator" }
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Payment Tracking & Ledger</h2>
        <p className="text-slate-500 font-bold text-sm">Monitor pending customer payments and track receipts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Due</p>
          <h3 className="text-3xl font-black text-slate-900">₹{totalDue.toLocaleString()}</h3>
          <p className="text-xs text-slate-400 font-bold mt-2">{pendingPayments.length} pending payments</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-red-200 p-6">
          <p className="text-red-600 font-bold text-xs uppercase tracking-widest mb-2">Urgent (&lt; 3 days)</p>
          <h3 className="text-3xl font-black text-red-600">
            {pendingPayments.filter((b) => b.urgency === "red").length}
          </h3>
          <p className="text-xs text-red-500 font-bold mt-2">
            ₹
            {pendingPayments
              .filter((b) => b.urgency === "red")
              .reduce((sum, b) => sum + b.balance, 0)
              .toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-yellow-200 p-6">
          <p className="text-yellow-600 font-bold text-xs uppercase tracking-widest mb-2">Follow-up (3-10 days)</p>
          <h3 className="text-3xl font-black text-yellow-600">
            {pendingPayments.filter((b) => b.urgency === "yellow").length}
          </h3>
          <p className="text-xs text-yellow-600 font-bold mt-2">
            ₹
            {pendingPayments
              .filter((b) => b.urgency === "yellow")
              .reduce((sum, b) => sum + b.balance, 0)
              .toLocaleString()}
          </p>
        </div>
      </div>

      {pendingPayments.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center">
          <CheckCircle2 size={48} className="text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900 mb-2">All Payments Received!</h3>
          <p className="text-slate-500 font-bold">No pending balances at this moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPayments.map((booking) => (
            <div
              key={booking.id || booking._id}
              className={`rounded-3xl border p-6 transition-all ${getUrgencyColor(booking.urgency)}`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">{getUrgencyIcon(booking.urgency)}</div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-black text-slate-900">{booking.invoiceNo}</h4>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                            booking.urgency === "red"
                              ? "bg-red-600 text-white"
                              : booking.urgency === "yellow"
                                ? "bg-yellow-600 text-white"
                                : "bg-green-600 text-white"
                          }`}
                        >
                          {getUrgencyText(booking.urgency)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-600">{booking.contactName}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Phone: <span className="font-bold">+91 {booking.contactPhone}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-slate-900">₹{booking.balance.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 font-bold mt-1">Balance Due</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4 pb-4 border-b border-slate-200 border-opacity-50">
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Journey</p>
                      <p className="font-black text-slate-900">
                        {booking.daysUntilJourney > 0 ? `${booking.daysUntilJourney} days` : "Today"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tour</p>
                      <p className="font-bold text-slate-900">{booking.tourName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Advance</p>
                      <p className="font-bold text-slate-900">₹{(booking.advanceReceived || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total</p>
                      <p className="font-bold text-slate-900">₹{booking.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleSendReminder(booking)}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        booking.urgency === "red"
                          ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200"
                          : booking.urgency === "yellow"
                            ? "bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg shadow-yellow-200"
                            : "bg-slate-200 hover:bg-slate-300 text-slate-900"
                      }`}
                    >
                      <MessageCircle size={16} />
                      Send Reminder
                    </button>
                    <button
                      onClick={() => handleMarkPaid(booking)}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
                    >
                      <CheckCircle2 size={16} />
                      Record Payment
                    </button>
                    <button
                      onClick={() => handleOpenLedger(booking)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <History size={16} />
                      Payment History
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Payment Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900">Record Payment</h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Invoice</p>
                <p className="font-black text-slate-900">{selectedBooking.invoiceNo}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Customer</p>
                <p className="font-bold text-slate-900">{selectedBooking.contactName}</p>
                <p className="text-sm text-slate-500 mt-1">+91 {selectedBooking.contactPhone}</p>
              </div>

              <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
                <p className="text-xs text-red-600 font-bold uppercase tracking-wider mb-1">Balance Due</p>
                <p className="text-3xl font-black text-red-600">₹{selectedBooking.balance.toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-600 transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-600 transition-all outline-none cursor-pointer"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notes (Optional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g., UPI ref no, receipt voucher #, etc."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-600 transition-all outline-none resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedBooking(null)}
                className="py-3 rounded-2xl font-black text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                className="py-3 rounded-2xl font-black text-sm bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200 transition-all"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History / Ledger Modal */}
      {viewLedgerBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Receipt size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Payment Ledger</h3>
                  <p className="text-xs font-bold text-slate-400">
                    Invoice #{viewLedgerBooking.invoiceNo} — {viewLedgerBooking.contactName}
                  </p>
                </div>
              </div>
              <button
                onClick={closeLedgerModal}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Package</p>
                <p className="text-lg font-black text-slate-900">₹{viewLedgerBooking.totalAmount.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-black uppercase text-emerald-600 mb-1">Total Received</p>
                <p className="text-lg font-black text-emerald-700">₹{(viewLedgerBooking.advanceReceived || 0).toLocaleString()}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-black uppercase text-amber-600 mb-1">Balance Remaining</p>
                <p className="text-lg font-black text-amber-700">
                  ₹{Math.max(0, viewLedgerBooking.totalAmount - (viewLedgerBooking.advanceReceived || 0)).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Voiding Reason Prompt Sub-modal */}
            {voidingPaymentId && (
              <div className="mb-4 p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Ban size={15} className="text-amber-600" />
                  <span>Void Transaction — Reason for Audit Log:</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="e.g. Entered wrong payment amount"
                    className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleConfirmVoid(voidingPaymentId)}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all"
                  >
                    Confirm Void
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoidingPaymentId(null)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Ledger Table */}
            <div className="border border-slate-100 rounded-2xl overflow-hidden mb-6">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Official Receipts & Audit Ledger
                </p>
                {loadingLedger && <span className="text-[10px] font-bold text-indigo-600">Loading ledger...</span>}
              </div>
              {(ledgerPayments.length > 0 ? ledgerPayments : viewLedgerBooking.payments || []).length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                      <th className="px-6 py-3">Receipt #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Mode & Type</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(ledgerPayments.length > 0 ? ledgerPayments : viewLedgerBooking.payments || []).map((p, idx) => {
                      const isRefund = p.type === "refund" || Number(p.amount) < 0
                      const isVoid = Boolean(p.isVoid)
                      return (
                        <tr key={p._id || idx} className={`hover:bg-slate-50/50 ${isVoid ? "opacity-50 bg-slate-50/70" : ""}`}>
                          <td className="px-6 py-3.5 font-mono text-xs font-black text-slate-700">
                            {p.receiptNo || `#REC-${idx + 1}`}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-600 text-xs">
                            {formatDisplayDate(p.paymentDate || p.date)}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-indigo-600 text-xs uppercase">{p.paymentMode || p.mode || "Cash"}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                isRefund ? "bg-red-100 text-red-700" : "bg-indigo-50 text-indigo-700"
                              }`}>
                                {p.type || (isRefund ? "refund" : "payment")}
                              </span>
                            </div>
                          </td>
                          <td className={`px-4 py-3.5 text-right font-black ${
                            isVoid ? "line-through text-slate-400" : isRefund ? "text-red-600" : "text-emerald-600"
                          }`}>
                            {isRefund ? "-" : "+"}₹{Math.abs(Number(p.amount)).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-500 font-medium max-w-xs truncate">
                            {isVoid ? (
                              <span className="text-red-600 font-bold">[VOIDED: {p.voidReason || "Operator"}]</span>
                            ) : (
                              p.notes || "—"
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {!isVoid && onVoidPayment && p._id ? (
                              <button
                                type="button"
                                onClick={() => setVoidingPaymentId(p._id)}
                                className="px-2.5 py-1 text-[10px] font-black text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                Void
                              </button>
                            ) : isVoid ? (
                              <span className="text-[10px] font-black text-slate-400 uppercase">Voided</span>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-400 font-bold text-sm">
                  {(viewLedgerBooking.advanceReceived || 0) > 0 ? (
                    <div>
                      <p className="font-black text-slate-700">Initial Advance Recorded: ₹{(viewLedgerBooking.advanceReceived || 0).toLocaleString()}</p>
                      <p className="text-xs text-slate-400 mt-1">Payment mode: {viewLedgerBooking.paymentMode || "Cash"}</p>
                    </div>
                  ) : (
                    "No payment records found for this booking."
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeLedgerModal}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
