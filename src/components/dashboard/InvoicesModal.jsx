import { useState, useMemo } from "react"
import { FileText, Filter, X, Eye, Edit3, Trash2, Ban, CheckCircle2, Search, Clock, Check } from "lucide-react"

export default function InvoicesModal({
  isOpen,
  onClose,
  filteredInvoices = [],
  invoiceTourFilter,
  setInvoiceTourFilter,
  uniqueTours = [],
  setSelectedBooking,
  setEditingBooking,
  setActiveTab,
  handleDeleteBooking,
  handleCancelBooking,
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // all | paid | pending | cancelled

  const displayedInvoices = useMemo(() => {
    return filteredInvoices.filter((b) => {
      const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
      const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
      const isPaid = !isCancelled && (b.isPaid || balance === 0)
      const isPending = !isCancelled && !isPaid

      if (statusFilter === "paid" && !isPaid) return false
      if (statusFilter === "pending" && !isPending) return false
      if (statusFilter === "cancelled" && !isCancelled) return false

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchesInvoice = b.invoiceNo?.toLowerCase().includes(q)
        const matchesName = b.contactName?.toLowerCase().includes(q)
        const matchesPhone = b.contactPhone?.toLowerCase().includes(q)
        const matchesTour = b.tourName?.toLowerCase().includes(q)
        const matchesPassenger = b.passengers?.some((p) => p.name?.toLowerCase().includes(q))
        if (!matchesInvoice && !matchesName && !matchesPhone && !matchesTour && !matchesPassenger) {
          return false
        }
      }
      return true
    })
  }, [filteredInvoices, statusFilter, searchTerm])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Sticky Header & Toolbar */}
        <div className="sticky top-0 bg-white z-20 border-b border-slate-100 shadow-xs">
          <div className="p-6 pb-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-100">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  All Booking Invoices
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Showing {displayedInvoices.length} of {filteredInvoices.length} Invoices
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:flex-none lg:min-w-56">
                <Filter
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <select
                  value={invoiceTourFilter}
                  onChange={(e) => setInvoiceTourFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="all">All Tours</option>
                  {uniqueTours.map((tour) => (
                    <option key={tour} value={tour}>
                      {tour}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  onClose()
                  setInvoiceTourFilter("all")
                  setSearchTerm("")
                  setStatusFilter("all")
                }}
                className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                aria-label="Close invoices modal"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Sticky Search & Filter Chips Bar */}
          <div className="px-6 pb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice #, name, phone, tour, passenger..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: "all", label: "All" },
                { id: "paid", label: "Paid" },
                { id: "pending", label: "Pending" },
                { id: "cancelled", label: "Cancelled" },
              ].map((chip) => {
                const isActive = statusFilter === chip.id
                return (
                  <button
                    key={chip.id}
                    onClick={() => setStatusFilter(chip.id)}
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
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200">
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Traveler</th>
                  <th className="px-6 py-4">Tour</th>
                  <th className="px-6 py-4">Journey Date</th>
                  <th className="px-6 py-4">Passengers</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedInvoices.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <span className="font-black text-slate-900">
                        #{b.invoiceNo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {b.status === "Cancelled" || b.status === "cancelled" ? (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-red-200">
                          <Ban size={10} /> Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                          <CheckCircle2 size={10} /> Confirmed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-600">
                        {new Date(b.date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-bold text-slate-700 block">
                          {b.contactName}
                        </span>
                        <span className="text-xs text-slate-400">
                          {b.contactPhone}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        {b.tourName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-600">
                        {new Date(b.journeyDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-indigo-600">
                        {b.passengers ? b.passengers.length : 0} PAX
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-slate-900">
                        ₹{(b.totalAmount || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedBooking(b)
                            onClose()
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          aria-label="View invoice"
                          title="View invoice"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingBooking(b)
                            setActiveTab("form")
                            onClose()
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          aria-label="Edit booking"
                          title="Edit booking"
                        >
                          <Edit3 size={16} />
                        </button>
                        {b.status !== "Cancelled" && b.status !== "cancelled" && (
                          <button
                            onClick={() => handleCancelBooking && handleCancelBooking(b.id)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            aria-label="Cancel booking"
                            title="Cancel booking"
                          >
                            <Ban size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            handleDeleteBooking(b.id)
                            if (filteredInvoices.length === 1) {
                              onClose()
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          aria-label="Delete booking"
                          title="Delete booking"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="bg-slate-100 p-4 rounded-2xl">
                          <FileText size={32} className="text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-bold">
                          No invoices found for this tour
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
