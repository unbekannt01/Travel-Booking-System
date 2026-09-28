import {
  LayoutDashboard,
  Users,
  MapPin,
  FileText,
  Eye,
  Edit3,
  Trash2,
  Calendar,
  Bus,
  CheckCircle2,
  Ban,
  ArrowRight,
} from "lucide-react"
import PaymentTracker from "../PaymentTracker"
import { toDateInputValue, formatDisplayDate } from "../../utils/date"

export default function DashboardHome({
  bookings = [],
  tours = [],
  filteredBookings = [],
  setShowAllInvoices,
  setSelectedBooking,
  setEditingBooking,
  setActiveTab,
  handleDeleteBooking,
  handleCancelBooking,
  handleMarkPaymentPaid,
}) {
  const todayStr = toDateInputValue(new Date())

  // Compute Today's Operations
  const todayActiveBookings = bookings.filter((b) => {
    if (b.status === "Cancelled" || b.status === "cancelled") return false
    return toDateInputValue(b.journeyDate) === todayStr
  })

  const todayDeparturesCount = todayActiveBookings.length
  const todayTours = [...new Set(todayActiveBookings.map((b) => b.tourName))].filter(Boolean)
  const todayPax = todayActiveBookings.reduce((sum, b) => sum + (b.passengers?.length || 0), 0)
  const todayCheckedIn = todayActiveBookings.reduce(
    (sum, b) => sum + (b.passengers?.filter((p) => p.checkedIn)?.length || 0),
    0,
  )
  const todayDue = todayActiveBookings.reduce(
    (sum, b) => sum + Math.max(0, b.totalAmount - (b.advanceReceived || 0)),
    0,
  )

  const activeBookingsCount = bookings.filter(
    (b) => b.status !== "Cancelled" && b.status !== "cancelled",
  ).length

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Today's Operations Quick Section ── */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-7 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                Today's Operations
              </span>
              <span className="text-xs font-bold text-slate-400">• {formatDisplayDate(new Date())}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              {todayDeparturesCount > 0
                ? `${todayDeparturesCount} Bus Group${todayDeparturesCount > 1 ? "s" : ""} Departing Today`
                : "No Bus Departures Today"}
            </h2>
            <p className="text-sm font-medium text-slate-300 max-w-xl">
              {todayDeparturesCount > 0
                ? `Tours: ${todayTours.join(", ")}`
                : "Plan new bookings or review upcoming scheduled tours in Journey Manager."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-0.5">Check-in Status</p>
              <p className="text-lg font-black text-white">
                {todayPax > 0 ? `${todayCheckedIn} / ${todayPax} PAX` : "0 PAX"}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-0.5">Today's Due</p>
              <p className="text-lg font-black text-amber-300">₹{todayDue.toLocaleString()}</p>
            </div>

            <button
              onClick={() => setActiveTab("journey")}
              className="flex items-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-900/40"
            >
              <Bus size={18} />
              Open Journey Manager
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
          <div className="relative z-10">
            <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <LayoutDashboard size={22} />
            </div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">
              Active Bookings
            </p>
            <h3 className="text-3xl font-black text-slate-900">
              {activeBookingsCount}
            </h3>
          </div>
        </div>
        <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
          <div className="relative z-10">
            <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <Users size={22} />
            </div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">
              Total Travelers
            </p>
            <h3 className="text-3xl font-black text-slate-900">
              {bookings.reduce((acc, b) => acc + (b.passengers ? b.passengers.length : 0), 0)}
            </h3>
          </div>
        </div>
        <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
          <div className="relative z-10">
            <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <MapPin size={22} />
            </div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">
              Destinations Covered
            </p>
            <h3 className="text-3xl font-black text-slate-900">
              {tours.length}
            </h3>
          </div>
        </div>
      </div>

      {/* ── Recent Booking Invoices ── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-7 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-lg font-black text-slate-900">
            Recent Booking Invoices
          </h2>
          <button
            onClick={() => setShowAllInvoices(true)}
            className="text-primary text-sm font-bold hover:underline flex items-center gap-2"
          >
            <FileText size={16} /> View All Invoices
          </button>
        </div>
        <div className="overflow-x-auto mx-0">
          <table className="w-full text-left min-w-175 lg:min-w-0">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <th className="px-8 py-4">Invoice #</th>
                <th className="px-8 py-4">Main Traveler</th>
                <th className="px-8 py-4">Tour Selection</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Amount</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBookings.slice(0, 5).map((b) => {
                const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
                return (
                  <tr
                    key={b._id || b.id}
                    className={`hover:bg-slate-50/50 transition-colors group ${
                      isCancelled ? "opacity-60 bg-slate-50/30" : ""
                    }`}
                  >
                    <td className="px-8 py-5">
                      <span className={`font-black ${isCancelled ? "line-through text-slate-400" : "text-slate-900"}`}>
                        #{b.invoiceNo}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                        {formatDisplayDate(b.date)}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="font-bold text-slate-700">
                        {b.contactName}
                      </span>
                      <span className="block text-xs text-slate-400 mt-0.5">
                        +91 {b.contactPhone}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                        {b.tourName}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-600">
                          ✕ Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-600">
                          <CheckCircle2 size={12} /> Confirmed
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5 font-black text-slate-900">
                      ₹{b.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View Invoice"
                          aria-label="View invoice"
                        >
                          <Eye size={18} />
                        </button>
                        {!isCancelled && (
                          <button
                            onClick={() => {
                              setEditingBooking(b)
                              setActiveTab("form")
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Edit Booking"
                            aria-label="Edit booking"
                          >
                            <Edit3 size={18} />
                          </button>
                        )}
                        {!isCancelled && handleCancelBooking && (
                          <button
                            onClick={() => handleCancelBooking(b._id || b.id)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Cancel Booking"
                            aria-label="Cancel booking"
                          >
                            <Ban size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteBooking(b._id || b.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Booking"
                          aria-label="Delete booking"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredBookings.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-8 py-12 text-center text-slate-400 font-medium"
                  >
                    No bookings found. Create your first booking to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentTracker
        bookings={bookings}
        onMarkPaid={handleMarkPaymentPaid}
      />
    </div>
  )
}
