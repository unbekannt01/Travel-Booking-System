import { FileText, Filter, X, Eye, Edit3, Trash2 } from "lucide-react"

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
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                All Booking Invoices
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {filteredInvoices.length} Total Invoices
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none lg:min-w-60">
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
              }}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              aria-label="Close invoices modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200">
                  <th className="px-6 py-4">Invoice #</th>
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
                {filteredInvoices.map((b) => (
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
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteBooking(b.id)
                            if (filteredInvoices.length === 1) {
                              onClose()
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          aria-label="Delete booking"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
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
