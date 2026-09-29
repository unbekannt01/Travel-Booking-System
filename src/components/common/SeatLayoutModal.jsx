import { useState, useMemo } from "react"
import {
  X,
  Printer,
  Download,
  Bus,
  Layers,
  CheckCircle2,
  Calendar,
  Building,
  Phone,
} from "lucide-react"
import {
  mapCoachSeatManifest,
  buildSeatLayoutPrintHTML,
} from "../../utils/seatLayout"
import { downloadCsv } from "../../utils/csv"
import { formatDisplayDate } from "../../utils/date"

export default function SeatLayoutModal({
  departure,
  bookings = [],
  user,
  onClose,
}) {
  const [deckFilter, setDeckFilter] = useState("both") // 'both' | 'lower' | 'upper'

  const accentColor = user?.invoiceColor || "#4f46e5"
  const companyName = user?.companyName || "Yatra Tours"
  const companyPhone = user?.companyPhone || ""
  const companyHQ = user?.companyHeadquarters || ""

  const tourName = departure?.tourName || "All Tours"
  const journeyDateFormatted = formatDisplayDate(departure?.journeyDate)
  const busNumber = departure?.busNumber || "AC Sleeper Coach"
  const busType = departure?.busType || "2x1 Luxury Sleeper"

  // Compute manifest mapping for the coach
  const manifestData = useMemo(() => {
    return mapCoachSeatManifest({
      departure,
      bookings,
      layoutType: busType.startsWith("2x2") ? "2x2" : "2x1",
    })
  }, [departure, bookings, busType])

  const handlePrint = (filter = deckFilter) => {
    const html = buildSeatLayoutPrintHTML({
      manifestData,
      departure,
      user,
      deckFilter: filter,
    })
    const win = window.open("", "_blank", "width=1000,height=800")
    if (!win) {
      alert("Please allow popups to print the passenger seat layout.")
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
    }, 400)
  }

  const handleExportCsv = () => {
    const header = [
      "Deck",
      "Seat Number",
      "Status",
      "Passenger Name",
      "Age",
      "Gender",
      "Contact Phone",
      "City / Boarding",
      "Invoice No",
      "Payment Status",
      "Balance Due (Rs)",
      "Boarded Check",
    ]

    const allSeats = [
      ...manifestData.lowerDeck.seats.map((s) => ({ ...s, deckName: "Lower Deck" })),
      ...manifestData.upperDeck.seats.map((s) => ({ ...s, deckName: "Upper Deck" })),
    ]

    const rows = allSeats.map((seat) => {
      const isBooked = seat.status === "booked"
      const p = seat.passenger
      return [
        seat.deckName,
        seat.label,
        isBooked ? "BOOKED" : "AVAILABLE",
        isBooked ? p.name : "Available",
        isBooked && p.age ? p.age : "",
        isBooked && p.gender ? p.gender : "",
        isBooked ? p.contactPhone || p.contact || "" : "",
        isBooked ? p.city || "" : "",
        isBooked ? p.invoiceNo : "",
        isBooked ? (p.isPaid ? "PAID" : "DUE") : "",
        isBooked ? p.balanceDue : 0,
        isBooked && p.checkedIn ? "YES" : "NO",
      ]
    })

    const titleRow = [
      `TOUR: ${tourName} | DATE: ${journeyDateFormatted} | BUS: ${busNumber} | OPERATOR: ${companyName}`,
    ]
    const filename = `Seat-Layout-${tourName.replace(/\s+/g, "_")}-${departure?.journeyDate || "trip"}.csv`

    downloadCsv(filename, [titleRow, [], header, ...rows])
  }

  // Render a visual deck preview card
  const renderDeckPreview = (deckObj) => {
    const isLower = deckObj.deck === "lower"
    const rows = {}
    deckObj.seats.forEach((s) => {
      if (!rows[s.row]) rows[s.row] = { left: [], right: [] }
      if (s.side === "left") rows[s.row].left.push(s)
      else rows[s.row].right.push(s)
    })

    const rowNumbers = Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b)

    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        {/* Deck Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                isLower ? "bg-emerald-400" : "bg-indigo-400"
              }`}
            />
            <h4 className="text-sm font-black tracking-wide uppercase">
              {isLower ? "Lower Deck" : "Upper Deck"}
            </h4>
            <span className="text-[10px] font-bold text-slate-400">
              ({deckObj.bookedCount}/{deckObj.capacity} Booked)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrint(isLower ? "lower" : "upper")}
              className="text-[11px] font-bold bg-white/10 hover:bg-white/20 px-3 py-1 rounded-xl text-white flex items-center gap-1 transition-colors"
              title="Print just this deck"
            >
              <Printer size={12} />
              <span>Print Deck</span>
            </button>
          </div>
        </div>

        {/* Coach Diagram Body */}
        <div className="p-4 sm:p-5 flex-1 bg-slate-50/50">
          <div className="max-w-md mx-auto bg-white rounded-2xl border-2 border-slate-200 p-3 shadow-xs">
            {/* Driver cabin indicator */}
            <div className="bg-slate-100 rounded-xl py-1.5 px-3 mb-3 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span>☸ Driver Cabin (Front)</span>
              <span className="bg-slate-200 px-2 py-0.5 rounded text-[8px]">
                Entry
              </span>
            </div>

            {/* Grid */}
            <div className="space-y-2">
              {rowNumbers.map((rowNum) => {
                const rowData = rows[rowNum]
                return (
                  <div
                    key={rowNum}
                    className="grid grid-cols-12 gap-1.5 items-center"
                  >
                    {/* Left seats */}
                    <div className="col-span-5 flex gap-1.5">
                      {rowData.left.map((seat) => {
                        const isBooked = seat.status === "booked"
                        const p = seat.passenger
                        return (
                          <div
                            key={seat.id}
                            className={`flex-1 min-h-13 rounded-xl p-1.5 border flex flex-col justify-between transition-all ${
                              isBooked
                                ? "bg-blue-50/80 border-blue-200 text-blue-950"
                                : "bg-white border-dashed border-slate-200 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-800">
                                {seat.label}
                              </span>
                              {isBooked ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              ) : (
                                <span className="text-[8px] font-bold text-slate-300">
                                  Free
                                </span>
                              )}
                            </div>
                            {isBooked ? (
                              <div>
                                <div className="text-[10px] font-black truncate leading-tight">
                                  {p.name}
                                </div>
                                <div className="text-[8px] font-bold text-blue-700 truncate">
                                  #{p.invoiceNo}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[9px] font-bold text-slate-400 text-center py-1">
                                Available
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Central Aisle */}
                    <div className="col-span-2 text-center text-[8px] font-black text-slate-400 uppercase tracking-wider py-1 border-x border-dashed border-slate-200">
                      R{rowNum}
                    </div>

                    {/* Right seats */}
                    <div className="col-span-5 flex gap-1.5">
                      {rowData.right.map((seat) => {
                        const isBooked = seat.status === "booked"
                        const p = seat.passenger
                        return (
                          <div
                            key={seat.id}
                            className={`flex-1 min-h-13 rounded-xl p-1.5 border flex flex-col justify-between transition-all ${
                              isBooked
                                ? "bg-blue-50/80 border-blue-200 text-blue-950"
                                : "bg-white border-dashed border-slate-200 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-800">
                                {seat.label}
                              </span>
                              {isBooked ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              ) : (
                                <span className="text-[8px] font-bold text-slate-300">
                                  Free
                                </span>
                              )}
                            </div>
                            {isBooked ? (
                              <div>
                                <div className="text-[10px] font-black truncate leading-tight">
                                  {p.name}
                                </div>
                                <div className="text-[8px] font-bold text-blue-700 truncate">
                                  #{p.invoiceNo}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[9px] font-bold text-slate-400 text-center py-1">
                                Available
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Rear */}
            <div className="bg-slate-100 rounded-xl py-1 mt-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">
              Rear of Bus / Emergency Exit
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-2xl text-white shadow-md shadow-indigo-100"
              style={{ backgroundColor: accentColor }}
            >
              <Bus size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900 leading-tight">
                  Passenger Seat Layout & Boarding Chart
                </h3>
                <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {manifestData.layoutType} Sleeper
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                {tourName} • 📅 {journeyDateFormatted} • 🚌 {busNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrint(deckFilter)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-100 flex items-center gap-1.5 transition-all"
            >
              <Printer size={14} />
              <span>Print / Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Controls & Metrics Strip */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          {/* Deck Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setDeckFilter("both")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                deckFilter === "both"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers size={13} />
              Both Decks
            </button>
            <button
              type="button"
              onClick={() => setDeckFilter("lower")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                deckFilter === "lower"
                  ? "bg-white text-emerald-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Lower Deck ({manifestData.lowerDeck.bookedCount}/{manifestData.lowerDeck.capacity})
            </button>
            <button
              type="button"
              onClick={() => setDeckFilter("upper")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                deckFilter === "upper"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Upper Deck ({manifestData.upperDeck.bookedCount}/{manifestData.upperDeck.capacity})
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span className="font-bold text-slate-500">Booked:</span>
              <span className="font-black text-slate-900">
                {manifestData.totalBooked} Berths
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="font-bold text-slate-500">Available:</span>
              <span className="font-black text-slate-900">
                {manifestData.totalAvailable} Berths
              </span>
            </div>
            <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl font-black">
              {manifestData.occupancyPercentage}% Occupancy
            </div>
          </div>
        </div>

        {/* Content Body: Decks Layout */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(deckFilter === "both" || deckFilter === "lower") &&
              renderDeckPreview(manifestData.lowerDeck)}
            {(deckFilter === "both" || deckFilter === "upper") &&
              renderDeckPreview(manifestData.upperDeck)}
          </div>

          {/* Info note */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <div>
              <strong>Conductor Instructions:</strong> The downloaded/printed PDF generates separate dedicated pages for Upper and Lower decks with conductor checklist checkboxes for fast passenger boarding.
            </div>
            <div className="text-[11px] font-bold text-slate-400">
              {companyName} {companyHQ ? `• ${companyHQ}` : ""} {companyPhone ? `• ${companyPhone}` : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
