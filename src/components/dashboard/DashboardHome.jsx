import {
  LayoutDashboard,
  Users,
  MapPin,
  FileText,
  Eye,
  Edit3,
  Trash2,
} from "lucide-react"
import PaymentTracker from "../PaymentTracker"

export default function DashboardHome({
  bookings = [],
  tours = [],
  filteredBookings = [],
  setShowAllInvoices,
  setSelectedBooking,
  setEditingBooking,
  setActiveTab,
  handleDeleteBooking,
  handleMarkPaymentPaid,
}) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
              {bookings.length}
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
              Destinations Cover
            </p>
            <h3 className="text-3xl font-black text-slate-900">
              {tours.length}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-7 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-lg font-black text-slate-900">
            Recent Booking Invoices
          </h2>
          <button
            onClick={() => setShowAllInvoices(true)}
            className="text-primary/60 text-sm font-bold hover:underline flex items-center gap-2"
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
                <th className="px-8 py-4">Amount</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBookings.slice(0, 5).map((b) => (
                <tr
                  key={b.id}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-8 py-5">
                    <span className="font-black text-slate-900 group-hover:text-primary/60 transition-colors">
                      #{b.invoiceNo}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                      {new Date(b.date).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="font-bold text-slate-700">
                      {b.contactName}
                    </span>
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {b.contactPhone}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                      {b.tourName}
                    </span>
                  </td>
                  <td className="px-8 py-5 font-black text-slate-900">
                    ₹{b.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedBooking(b)}
                        className="p-2 text-slate-400 hover:text-primary/60 hover:bg-primary/10 rounded-lg transition-all"
                        aria-label="View invoice"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingBooking(b)
                          setActiveTab("form")
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        aria-label="Edit booking"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteBooking(b.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        aria-label="Delete booking"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
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
