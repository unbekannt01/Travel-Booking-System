"use client"

import { useState } from "react"
import { AlertCircle, Clock, CheckCircle2, MessageCircle, X } from "lucide-react"

export default function PaymentTracker({ bookings, onMarkPaid }) {
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")

  const pendingPayments = bookings
    .filter((b) => {
      const balance = b.totalAmount - b.advanceReceived
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
        balance: b.totalAmount - b.advanceReceived,
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
    const message = `Hi ${booking.contactName}, this is a reminder that your balance of ₹${booking.totalAmount - booking.advanceReceived} is due for ${booking.tourName} (Invoice: ${booking.invoiceNo}). Please make the payment at your earliest convenience. Thank you!`
    const phoneNumber = booking.contactPhone.replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleMarkPaid = (booking) => {
    setSelectedBooking(booking)
    setPaymentAmount((booking.totalAmount - booking.advanceReceived).toString())
    setPaymentNotes("")
  }

  const submitPayment = () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      alert("Please enter a valid payment amount")
      return
    }

    onMarkPaid({
      bookingId: selectedBooking.id || selectedBooking._id,
      paymentAmount: Number(paymentAmount),
      paymentNotes,
    })

    setSelectedBooking(null)
    setPaymentAmount("")
    setPaymentNotes("")
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Payment Tracking</h2>
        <p className="text-slate-500 font-bold text-sm">Monitor and manage pending payments from customers</p>
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
          <p className="text-slate-500 font-bold">No pending payments at this moment.</p>
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

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4 pb-4 border-b border-slate-200 border-opacity-50">
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
                      <p className="font-bold text-slate-900">₹{booking.advanceReceived.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total</p>
                      <p className="font-bold text-slate-900">₹{booking.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleSendReminder(booking)}
                      className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
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
                      className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
                    >
                      <CheckCircle2 size={16} />
                      Mark Paid
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-900">Record Payment</h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 mb-8">
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
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notes (Optional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g., Partial payment, online transfer, etc."
                  rows={3}
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
    </div>
  )
}
