import { useState } from "react"
import { X, AlertTriangle, IndianRupee, ShieldAlert } from "lucide-react"

export default function CancelBookingModal({ booking, onClose, onConfirm }) {
  const totalPaid = Math.round((booking?.advanceReceived || 0) * 100) / 100
  const [cancellationCharge, setCancellationCharge] = useState("0")
  const [refundPaymentMode, setRefundPaymentMode] = useState("Cash")
  const [reason, setReason] = useState("Customer requested cancellation")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!booking) return null

  const fee = Math.max(0, Number(cancellationCharge) || 0)
  const refundAmount = Math.max(0, Math.round((totalPaid - fee) * 100) / 100)
  const isFeeTooHigh = fee > totalPaid

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isFeeTooHigh) return
    setIsSubmitting(true)
    try {
      await onConfirm({
        bookingId: booking._id || booking.id,
        cancellationCharge: fee,
        refundPaymentMode,
        reason,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-red-500 p-6 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <ShieldAlert size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-xl">Cancel Booking</h3>
              <p className="text-xs text-red-100 font-bold">
                Invoice #{booking.invoiceNo} • {booking.contactName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Booking Summary Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Tour & Date</p>
              <p className="font-bold text-slate-800">{booking.tourName}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total Collected</p>
              <p className="font-black text-emerald-600 text-sm">₹{totalPaid.toLocaleString()}</p>
            </div>
          </div>

          {/* Cancellation Charge */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Cancellation Fee Retained (₹)
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCancellationCharge("0")}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  ₹0 (Full Refund)
                </button>
                <button
                  type="button"
                  onClick={() => setCancellationCharge(totalPaid.toString())}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  Retain All
                </button>
              </div>
            </div>
            <div className="relative">
              <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="number"
                min="0"
                max={totalPaid}
                value={cancellationCharge}
                onChange={(e) => setCancellationCharge(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm font-bold outline-none transition-all ${
                  isFeeTooHigh
                    ? "border-red-500 focus:ring-2 focus:ring-red-200"
                    : "border-slate-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                }`}
                placeholder="0"
              />
            </div>
            {isFeeTooHigh && (
              <p className="text-xs font-bold text-red-600">
                Fee cannot exceed collected amount of ₹{totalPaid.toLocaleString()}
              </p>
            )}
          </div>

          {/* Refund Calculation Box */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                Refund Due to Traveler
              </p>
              <p className="text-2xl font-black text-amber-900">
                ₹{refundAmount.toLocaleString()}
              </p>
            </div>
            {refundAmount > 0 && (
              <div className="w-40 space-y-1">
                <label className="text-[10px] font-black uppercase text-amber-800">
                  Refund Mode
                </label>
                <select
                  value={refundPaymentMode}
                  onChange={(e) => setRefundPaymentMode(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Net Banking">Net Banking</option>
                </select>
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">
              Reason for Cancellation
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Passenger family emergency"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none"
            />
          </div>

          {/* Seat Release Notice */}
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold">
            <AlertTriangle size={16} className="shrink-0 text-red-600" />
            <span>
              Reserved seats (
              {booking.passengers
                .map((p) => p.seatId)
                .filter(Boolean)
                .join(", ") || "None"}
              ) will be immediately freed for other travelers.
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
            >
              Keep Reservation
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isFeeTooHigh}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-black text-sm shadow-lg shadow-red-200 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? "Processing..." : "Confirm Cancellation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
