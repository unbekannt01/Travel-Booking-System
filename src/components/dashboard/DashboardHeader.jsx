import { Search, Plus } from "lucide-react"

export default function DashboardHeader({
  searchTerm,
  setSearchTerm,
  onNewReservation,
}) {
  return (
    <>
      <header className="h-20 bg-white border-b border-slate-200 hidden lg:flex items-center justify-between px-10 sticky top-0 z-30 shrink-0">
        <div className="flex-1 max-w-xl relative group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary/60 transition-colors"
            size={18}
          />
          <input
            type="text"
            placeholder="Search invoices, tours, or traveler names..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-transparent rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 ml-8">
          <button
            onClick={onNewReservation}
            className="bg-primary hover:bg-primary/80 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
          >
            <Plus size={18} strokeWidth={3} /> New Reservation
          </button>
        </div>
      </header>

      <div className="lg:hidden px-6 pt-6 pb-2">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search bookings..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/60 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
    </>
  )
}
