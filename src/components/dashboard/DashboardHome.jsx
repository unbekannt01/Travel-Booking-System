import { useState, useMemo } from "react"
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
  Search,
  AlertTriangle,
  AlertCircle,
  X,
  Clock,
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
  handleVoidPayment,
  user,
}) {
  const [recentSearch, setRecentSearch] = useState("")
  const [recentStatus, setRecentStatus] = useState("all") // all | paid | pending | cancelled

  const today = new Date()
  const todayStr = toDateInputValue(today)

  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const in7DaysStr = toDateInputValue(in7Days)

  // 1. Today's departures
  const todayActiveBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === "Cancelled" || b.status === "cancelled") return false
      return toDateInputValue(b.journeyDate) === todayStr
    })
  }, [bookings, todayStr])

  const todayDeparturesCount = todayActiveBookings.length
  const todayTours = [...new Set(todayActiveBookings.map((b) => b.tourName))].filter(Boolean)
  const todayPax = todayActiveBookings.reduce((sum, b) => sum + (b.passengers?.length || 0), 0)
  const todayCheckedIn = todayActiveBookings.reduce(
    (sum, b) => sum + (b.passengers?.filter((p) => p.checkedIn)?.length || 0),
    0,
  )
  const todayDue = todayActiveBookings.reduce(
    (sum, b) => sum + Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0)),
    0,
  )

  // 2. Next 7 Days departures
  const next7DaysDepartures = useMemo(() => {
    const list = bookings.filter((b) => {
      if (b.status === "Cancelled" || b.status === "cancelled") return false
      const d = toDateInputValue(b.journeyDate)
      return d >= todayStr && d <= in7DaysStr
    })
    // Group by tour + date
    const groups = new Map()
    list.forEach((b) => {
      const key = `${b.tourName}__${toDateInputValue(b.journeyDate)}`
      if (!groups.has(key)) {
        groups.set(key, { tourName: b.tourName, journeyDate: b.journeyDate, pax: 0, count: 0 })
      }
      const g = groups.get(key)
      g.pax += b.passengers?.length || 0
      g.count += 1
    })
    return Array.from(groups.values())
  }, [bookings, todayStr, in7DaysStr])

  // 3. Pending dues count & total amount across active bookings
  const { pendingDuesCount, pendingDuesAmount } = useMemo(() => {
    let count = 0
    let amount = 0
    bookings.forEach((b) => {
      if (b.status === "Cancelled" || b.status === "cancelled") return
      const due = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
      if (due > 0 && !b.isPaid) {
        count += 1
        amount += due
      }
    })
    return { pendingDuesCount: count, pendingDuesAmount: amount }
  }, [bookings])

  // 4. Bookings with unassigned seats
  const unassignedSeatBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === "Cancelled" || b.status === "cancelled") return false
      return (b.passengers || []).some((p) => !p.seatId)
    })
  }, [bookings])

  const unassignedPaxTotal = useMemo(() => {
    return unassignedSeatBookings.reduce(
      (sum, b) => sum + (b.passengers || []).filter((p) => !p.seatId).length,
      0,
    )
  }, [unassignedSeatBookings])

  const activeBookingsCount = bookings.filter(
    (b) => b.status !== "Cancelled" && b.status !== "cancelled",
  ).length

  // Filtered recent bookings
  const displayedRecentBookings = useMemo(() => {
    return bookings.filter((b) => {
      const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
      const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
      const isPaid = !isCancelled && (b.isPaid || balance === 0)
      const isPending = !isCancelled && !isPaid

      if (recentStatus === "paid" && !isPaid) return false
      if (recentStatus === "pending" && !isPending) return false
      if (recentStatus === "cancelled" && !isCancelled) return false

      if (recentSearch.trim()) {
        const q = recentSearch.toLowerCase().trim()
        const matchesInvoice = b.invoiceNo?.toLowerCase().includes(q)
        const matchesName = b.contactName?.toLowerCase().includes(q)
        const matchesPhone = b.contactPhone?.toLowerCase().includes(q)
        const matchesTour = b.tourName?.toLowerCase().includes(q)
        if (!matchesInvoice && !matchesName && !matchesPhone && !matchesTour) {
          return false
        }
      }
      return true
    })
  }, [bookings, recentStatus, recentSearch])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Today & Upcoming Operations Section ── */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-7 md:p-8 text-white shadow-xl relative overflow-hidden space-y-6">
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

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-0.5">Check-in Status</p>
              <p className="text-base md:text-lg font-black text-white">
                {todayPax > 0 ? `${todayCheckedIn} / ${todayPax} PAX` : "0 PAX"}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-0.5">Today's Due</p>
              <p className="text-base md:text-lg font-black text-amber-300">₹{todayDue.toLocaleString()}</p>
            </div>

            <button
              onClick={() => setActiveTab("journey")}
              className="flex items-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-900/40 cursor-pointer"
            >
              <Bus size={18} />
              Open Manifests
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* ── Secondary Operations Bar (Next 7 Days, Dues, Unassigned Seats) ── */}
        <div className="relative z-10 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Next 7 Days Departures */}
          <div className="bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-0.5 flex items-center gap-1.5">
                <Calendar size={13} />
                Next 7 Days Departures
              </p>
              <p className="text-xl font-black text-white">
                {next7DaysDepartures.length} <span className="text-xs font-normal text-slate-400">trips scheduled</span>
              </p>
            </div>
            <button
              onClick={() => setActiveTab("journey")}
              className="text-xs font-bold text-indigo-300 hover:text-white underline cursor-pointer"
            >
              View
            </button>
          </div>

          {/* Pending Dues Overview */}
          <div className="bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-300 mb-0.5 flex items-center gap-1.5">
                <Clock size={13} />
                Pending Balance Dues
              </p>
              <p className="text-xl font-black text-amber-300">
                ₹{pendingDuesAmount.toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-300">({pendingDuesCount} bookings)</span>
              </p>
            </div>
            <button
              onClick={() => {
                setRecentStatus("pending")
              }}
              className="text-xs font-bold text-amber-300 hover:text-white underline cursor-pointer"
            >
              Filter
            </button>
          </div>

          {/* Unassigned Seats Alert */}
          <div className={`p-4 rounded-2xl border transition-colors flex items-center justify-between ${
            unassignedSeatBookings.length > 0
              ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
              : "bg-white/5 border-white/5 text-slate-300"
          }`}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                {unassignedSeatBookings.length > 0 ? (
                  <AlertTriangle size={13} className="text-amber-400" />
                ) : (
                  <CheckCircle2 size={13} className="text-emerald-400" />
                )}
                Unassigned Seats
              </p>
              <p className="text-xl font-black text-white">
                {unassignedSeatBookings.length > 0 ? (
                  <span>{unassignedSeatBookings.length} <span className="text-xs font-normal text-amber-300">({unassignedPaxTotal} travelers unseated)</span></span>
                ) : (
                  <span className="text-emerald-400 text-sm">All travelers have seats</span>
                )}
              </p>
            </div>
            {unassignedSeatBookings.length > 0 && (
              <button
                onClick={() => {
                  setEditingBooking(unassignedSeatBookings[0])
                  setActiveTab("form")
                }}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Assign Seats
              </button>
            )}
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
        <div className="p-7 border-b border-slate-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Recent Booking Invoices
            </h2>
            <p className="text-xs text-slate-400 font-bold">
              Showing {displayedRecentBookings.slice(0, 10).length} of {bookings.length} reservations
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={recentSearch}
                onChange={(e) => setRecentSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
              />
              {recentSearch && (
                <button
                  onClick={() => setRecentSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "all", label: "All" },
                { id: "paid", label: "Paid" },
                { id: "pending", label: "Pending" },
                { id: "cancelled", label: "Cancelled" },
              ].map((chip) => {
                const isActive = recentStatus === chip.id
                return (
                  <button
                    key={chip.id}
                    onClick={() => setRecentStatus(chip.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                      isActive
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {chip.label}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setShowAllInvoices(true)}
              className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1.5 ml-auto cursor-pointer shrink-0"
            >
              <FileText size={15} /> View All
            </button>
          </div>
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
              {displayedRecentBookings.slice(0, 10).map((b) => {
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
        onVoidPayment={handleVoidPayment}
        user={user}
      />
    </div>
  )
}
