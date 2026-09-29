import { useState, useMemo } from "react"
import {
  MapPin,
  Check,
  Download,
  MessageCircle,
  Mail,
  Bus,
  Users,
  ArrowLeft,
  Clock,
  Printer,
  ChevronRight,
  CreditCard,
  CheckCheck,
  XCircle,
  ArrowLeftRight,
  Banknote,
  X,
  Ticket,
} from "lucide-react"
import { togglePassengerCheckin, batchCheckin, swapSeat } from "../data/bookings"
import { recordPayment } from "../data/payments"
import { useToast } from "./common/ToastContext"
import { toDateInputValue, formatDisplayDate } from "../utils/date"
import BoardingPassModal from "./common/BoardingPassModal"

// Generate all valid seat IDs for a given bus type
const generateAllSeats = (busType) => {
  const is2x2 = busType?.startsWith("2x2")
  const rowCount = is2x2 ? 5 : 6
  const decks = ["lower", "upper"]
  const seats = []
  for (const deck of decks) {
    for (let row = 1; row <= rowCount; row++) {
      seats.push(`${deck}-L${row}`)
      if (is2x2) {
        seats.push(`${deck}-L${row}-2`)
        seats.push(`${deck}-R${row}-1`)
        seats.push(`${deck}-R${row}-2`)
      } else {
        seats.push(`${deck}-R${row}-1`)
        seats.push(`${deck}-R${row}-2`)
      }
    }
  }
  return seats
}

export default function JourneyManager({ bookings, onUpdateBooking, user }) {
  const { toast } = useToast()
  const [boardingPassTarget, setBoardingPassTarget] = useState(null)
  const todayStr = useMemo(() => toDateInputValue(new Date()), [])
  const tomorrowStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return toDateInputValue(d)
  }, [])
  const in7DaysStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return toDateInputValue(d)
  }, [])

  const [viewMode, setViewMode] = useState("departures") // "departures" | "manifest"
  const [selectedDepartureKey, setSelectedDepartureKey] = useState(null)

  const [dateFilterMode, setDateFilterMode] = useState("all") // "all" | "today" | "tomorrow" | "next7days" | "upcoming" | "past" | "custom"
  const [customDate, setCustomDate] = useState(todayStr)
  const [selectedTour, setSelectedTour] = useState("all")
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [includeAadhar, setIncludeAadhar] = useState(true)

  // Phase 3: Seat swap state
  const [swappingSeat, setSwappingSeat] = useState(null) // { bookingId, passengerId, passengerName, currentSeatId }
  const [swapLoading, setSwapLoading] = useState(false)

  // Phase 3: Quick payment state
  const [quickPayBooking, setQuickPayBooking] = useState(null)
  const [quickPayAmount, setQuickPayAmount] = useState("")
  const [quickPayMode, setQuickPayMode] = useState("Cash")
  const [quickPayLoading, setQuickPayLoading] = useState(false)

  // Phase 3: Batch check-in loading
  const [batchLoading, setBatchLoading] = useState(null) // bookingId currently batch-processing

  const uniqueTours = useMemo(() => [...new Set(bookings.map((b) => b.tourName))].filter(Boolean), [bookings])

  // Group bookings into coach Departures
  const departures = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "Cancelled" && b.status !== "cancelled")
    const map = new Map()

    for (const b of active) {
      const dateKey = toDateInputValue(b.journeyDate)
      const bus = b.busType || "2x1 Sleeper Luxury"
      const key = `${b.tourName}___${dateKey}___${bus}`

      if (!map.has(key)) {
        const capacity = bus.startsWith("2x2") ? 40 : 30
        map.set(key, {
          key,
          tourName: b.tourName,
          journeyDate: b.journeyDate,
          dateStr: dateKey,
          busType: bus,
          capacity,
          bookings: [],
          bookedSeats: new Set(),
          totalPax: 0,
          checkedInPax: 0,
          totalAmount: 0,
          advanceReceived: 0,
        })
      }

      const dep = map.get(key)
      dep.bookings.push(b)
      dep.totalAmount += b.totalAmount || 0
      dep.advanceReceived += b.advanceReceived || 0

      for (const p of b.passengers || []) {
        dep.totalPax += 1
        if (p.checkedIn) dep.checkedInPax += 1
        if (p.seatId) dep.bookedSeats.add(p.seatId)
      }
    }

    return Array.from(map.values())
      .map((dep) => {
        const bookedCount = dep.bookedSeats.size || dep.totalPax
        const occupancyPct = Math.min(100, Math.round((bookedCount / dep.capacity) * 100))
        const balanceDue = Math.max(0, dep.totalAmount - dep.advanceReceived)

        let statusTag = "Upcoming"
        let statusStyle = "bg-indigo-100 text-indigo-700"
        if (dep.dateStr === todayStr) {
          statusTag = "TODAY"
          statusStyle = "bg-emerald-500 text-white animate-pulse"
        } else if (dep.dateStr === tomorrowStr) {
          statusTag = "TOMORROW"
          statusStyle = "bg-amber-500 text-white"
        } else if (dep.dateStr < todayStr) {
          statusTag = "PAST"
          statusStyle = "bg-slate-200 text-slate-600"
        }

        return {
          ...dep,
          bookedCount,
          occupancyPct,
          balanceDue,
          statusTag,
          statusStyle,
        }
      })
      .sort((a, b) => new Date(a.journeyDate) - new Date(b.journeyDate))
  }, [bookings, todayStr, tomorrowStr])

  // Filter departures according to current filters
  const filteredDepartures = useMemo(() => {
    return departures.filter((dep) => {
      if (selectedTour !== "all" && dep.tourName !== selectedTour) return false

      if (dateFilterMode === "today") return dep.dateStr === todayStr
      if (dateFilterMode === "tomorrow") return dep.dateStr === tomorrowStr
      if (dateFilterMode === "next7days") return dep.dateStr >= todayStr && dep.dateStr <= in7DaysStr
      if (dateFilterMode === "upcoming") return dep.dateStr >= todayStr
      if (dateFilterMode === "past") return dep.dateStr < todayStr
      if (dateFilterMode === "custom") return dep.dateStr === customDate
      return true
    })
  }, [departures, selectedTour, dateFilterMode, todayStr, tomorrowStr, in7DaysStr, customDate])

  // Bookings to display in Manifest view
  const journeyBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        if (b.status === "Cancelled" || b.status === "cancelled") return false

        if (selectedDepartureKey) {
          const dateKey = toDateInputValue(b.journeyDate)
          const bus = b.busType || "2x1 Sleeper Luxury"
          return `${b.tourName}___${dateKey}___${bus}` === selectedDepartureKey
        }

        const bookingDate = toDateInputValue(b.journeyDate)
        let dateMatch = true
        if (dateFilterMode === "today") dateMatch = bookingDate === todayStr
        else if (dateFilterMode === "tomorrow") dateMatch = bookingDate === tomorrowStr
        else if (dateFilterMode === "next7days") dateMatch = bookingDate >= todayStr && bookingDate <= in7DaysStr
        else if (dateFilterMode === "upcoming") dateMatch = bookingDate >= todayStr
        else if (dateFilterMode === "past") dateMatch = bookingDate < todayStr
        else if (dateFilterMode === "custom") dateMatch = bookingDate === customDate

        const tourMatch = selectedTour === "all" || b.tourName === selectedTour
        return dateMatch && tourMatch
      })
      .sort((a, b) => new Date(a.journeyDate) - new Date(b.journeyDate))
  }, [
    bookings,
    selectedDepartureKey,
    dateFilterMode,
    selectedTour,
    todayStr,
    tomorrowStr,
    in7DaysStr,
    customDate,
  ])

  const totalPassengers = journeyBookings.reduce((sum, b) => sum + (b.passengers?.length || 0), 0)
  const totalCheckedIn = journeyBookings.reduce(
    (sum, b) => sum + (b.passengers?.filter((p) => p.checkedIn)?.length || 0),
    0
  )

  const activeDepartureObj = useMemo(() => {
    if (!selectedDepartureKey) return null
    return departures.find((d) => d.key === selectedDepartureKey)
  }, [selectedDepartureKey, departures])

  const handleToggleCheckIn = async (booking, passenger, passengerIndex) => {
    const bookingId = booking._id || booking.id
    const passengerIdentifier = passenger._id || passengerIndex
    try {
      const updatedBooking = await togglePassengerCheckin(bookingId, passengerIdentifier)
      if (onUpdateBooking) {
        onUpdateBooking(updatedBooking)
      }
      toast.success(
        `${passenger.name} marked as ${!passenger.checkedIn ? "Checked In" : "Pending"}`
      )
    } catch (err) {
      toast.error(err.message || "Failed to update check-in status")
    }
  }

  // Phase 3: Batch check-in / unboard all
  const handleBatchCheckin = async (booking, checkedIn) => {
    const bookingId = booking._id || booking.id
    setBatchLoading(bookingId)
    try {
      const updatedBooking = await batchCheckin(bookingId, checkedIn)
      if (onUpdateBooking) onUpdateBooking(updatedBooking)
      toast.success(
        checkedIn
          ? `All ${booking.passengers.length} passengers boarded`
          : `All passengers unboarded for ${booking.invoiceNo}`
      )
    } catch (err) {
      toast.error(err.message || "Failed to batch update check-in")
    } finally {
      setBatchLoading(null)
    }
  }

  // Phase 3: Seat swap handler
  const handleSeatSwap = async (newSeatId) => {
    if (!swappingSeat) return
    setSwapLoading(true)
    try {
      const updatedBooking = await swapSeat(
        swappingSeat.bookingId,
        swappingSeat.passengerId,
        newSeatId
      )
      if (onUpdateBooking) onUpdateBooking(updatedBooking)
      toast.success(`${swappingSeat.passengerName} moved to seat ${newSeatId}`)
      setSwappingSeat(null)
    } catch (err) {
      toast.error(err.message || "Failed to reassign seat")
    } finally {
      setSwapLoading(false)
    }
  }

  // Phase 3: Available seats for swap (all seats minus occupied ones on this departure)
  const availableSeatsForSwap = useMemo(() => {
    if (!swappingSeat || !activeDepartureObj) return []
    const busType = activeDepartureObj.busType || "2x1 Sleeper Luxury"
    const allSeats = generateAllSeats(busType)
    const occupied = new Set()
    for (const b of activeDepartureObj.bookings) {
      for (const p of b.passengers || []) {
        if (p.seatId) occupied.add(p.seatId)
      }
    }
    // Remove the current seat from "occupied" (the passenger's own seat is available to stay)
    if (swappingSeat.currentSeatId) occupied.delete(swappingSeat.currentSeatId)
    return allSeats.filter((s) => !occupied.has(s))
  }, [swappingSeat, activeDepartureObj])

  // Phase 3: Quick payment handler
  const handleQuickPay = async () => {
    if (!quickPayBooking) return
    const num = Number(quickPayAmount)
    if (!quickPayAmount || isNaN(num) || num <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    setQuickPayLoading(true)
    try {
      const updated = await recordPayment({
        bookingId: quickPayBooking._id || quickPayBooking.id,
        paymentAmount: num,
        paymentMode: quickPayMode,
        paymentNotes: "Collected at boarding",
      })
      if (onUpdateBooking) onUpdateBooking(updated)
      toast.success(`₹${num.toLocaleString()} collected from ${quickPayBooking.contactName}`)
      setQuickPayBooking(null)
      setQuickPayAmount("")
      setQuickPayMode("Cash")
    } catch (err) {
      toast.error(err.message || "Failed to record payment")
    } finally {
      setQuickPayLoading(false)
    }
  }

  const handleSendWhatsApp = (booking) => {
    const passengers = booking.passengers.map((p) => `${p.name} (${p.city})`).join(", ")
    const message = `Hi ${booking.contactName},\n\nYour journey details:\nInvoice: ${booking.invoiceNo}\nTour: ${booking.tourName}\nDate: ${formatDisplayDate(booking.journeyDate)}\nPassengers: ${passengers}\nTotal: ${booking.passengers.length}\n\nPlease confirm receipt. Thank you!`
    const phoneNumber = booking.contactPhone.replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleSendEmail = (booking) => {
    const passengers = booking.passengers.map((p) => `${p.name} (${p.city})`).join(", ")
    const subject = `Journey Details - ${booking.invoiceNo}`
    const body = `Hi ${booking.contactName},\n\nYour journey details:\n\nInvoice: ${booking.invoiceNo}\nTour: ${booking.tourName}\nDate: ${formatDisplayDate(booking.journeyDate)}\nPassengers: ${passengers}\nTotal: ${booking.passengers.length}\n\nPlease confirm receipt.\n\nThank you!`
    const mailUrl = `mailto:${booking.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailUrl
  }

  const handlePrintSeatLayout = (withAadhar) => {
    setIncludeAadhar(withAadhar)
    setShowExportOptions(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print())
    })
  }

  const getSortedSeatRows = (passengers) => {
    const sorted = [...passengers].sort((a, b) =>
      (a.seatId || "").localeCompare(b.seatId || "", undefined, { numeric: true })
    )

    const rows = []
    sorted.forEach((passenger) => {
      if (rows.length === 0 || rows[rows.length - 1].length === 4) {
        rows.push([])
      }
      rows[rows.length - 1].push(passenger)
    })

    return rows
  }

  return (
    <div className="space-y-8">
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Departures & Journey Coordination</h2>
          <p className="text-slate-500 font-bold text-sm">
            Organize trips by coach departures, monitor bus occupancy, and manage boarding manifests.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 no-print">
          <button
            type="button"
            onClick={() => {
              setViewMode("departures")
              setSelectedDepartureKey(null)
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${
              viewMode === "departures"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Bus size={15} />
            Coaches & Departures ({departures.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("manifest")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${
              viewMode === "manifest"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users size={15} />
            Boarding Manifest
          </button>
        </div>
      </div>

      {/* Filter Bar (Visible in Departures and Unscoped Manifest) */}
      <div className="space-y-4 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 mr-1">Time Horizon:</span>
          {[
            { id: "all", label: "All Departures" },
            { id: "today", label: "Today" },
            { id: "tomorrow", label: "Tomorrow" },
            { id: "next7days", label: "Next 7 Days" },
            { id: "upcoming", label: "All Upcoming" },
            { id: "past", label: "Past" },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                setDateFilterMode(mode.id)
                setSelectedDepartureKey(null)
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                dateFilterMode === mode.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Filter Tour</label>
            <select
              value={selectedTour}
              onChange={(e) => setSelectedTour(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">All Tours</option>
              {uniqueTours.map((tour) => (
                <option key={tour} value={tour}>
                  {tour}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Or Specific Date</label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value)
                setDateFilterMode("custom")
                setSelectedDepartureKey(null)
              }}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Print / Export</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <Printer size={14} /> Print Coach Manifest
              </button>
              {showExportOptions && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-20">
                  <button
                    type="button"
                    onClick={() => handlePrintSeatLayout(true)}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 font-bold text-xs text-slate-700"
                  >
                    Print Manifest (With Aadhaar)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintSeatLayout(false)}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 font-bold text-xs text-slate-700"
                  >
                    Print Manifest (Without Aadhaar)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODE 1: DEPARTURES GROUPED CARD LANDING VIEW             */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewMode === "departures" && (
        <div className="space-y-6">
          {filteredDepartures.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-xs">
              <Bus size={48} className="text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-black text-slate-800 mb-1">No Departures Found</h3>
              <p className="text-slate-400 font-bold text-xs">
                No active bus departures match the selected filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDepartures.map((dep) => {
                const occupancyColor =
                  dep.occupancyPct >= 80
                    ? "bg-emerald-500"
                    : dep.occupancyPct >= 50
                      ? "bg-amber-500"
                      : "bg-indigo-500"

                return (
                  <div
                    key={dep.key}
                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top status & date */}
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${dep.statusStyle}`}>
                          {dep.statusTag}
                        </span>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-800 flex items-center gap-1 justify-end">
                            <Clock size={12} className="text-slate-400" />
                            {formatDisplayDate(dep.journeyDate)}
                          </span>
                        </div>
                      </div>

                      {/* Tour title & Coach badge */}
                      <h3 className="text-xl font-black text-slate-900 leading-tight mb-2">
                        {dep.tourName}
                      </h3>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 mb-5">
                        <Bus size={13} className="text-indigo-600" />
                        <span>{dep.busType} ({dep.capacity} Berths)</span>
                      </div>

                      {/* Coach Occupancy Meter */}
                      <div className="space-y-1.5 mb-4 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <div className="flex justify-between text-xs font-black">
                          <span className="text-slate-500 uppercase tracking-wider text-[10px]">Bus Capacity</span>
                          <span className="text-slate-900">
                            {dep.bookedCount} / {dep.capacity} Seats ({dep.occupancyPct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${occupancyColor} transition-all duration-300`}
                            style={{ width: `${dep.occupancyPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Boarding Progress & Financials */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-5">
                        <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Boarded Pax</p>
                          <p className="text-sm font-black text-emerald-900 mt-0.5">
                            {dep.checkedInPax} / {dep.totalPax}
                          </p>
                        </div>
                        <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-100">
                          <p className="text-[9px] font-black uppercase tracking-wider text-amber-700">Pending Due</p>
                          <p className="text-sm font-black text-amber-900 mt-0.5">
                            ₹{dep.balanceDue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-4 border-t border-slate-100 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDepartureKey(dep.key)
                          setViewMode("manifest")
                        }}
                        className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 transition-all"
                      >
                        <span>Open Boarding</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODE 2: PASSENGER BOARDING MANIFEST                      */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewMode === "manifest" && (
        <div className="space-y-6">
          {/* Active Departure Banner (if scoped) */}
          {activeDepartureObj && (
            <div className="bg-linear-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedDepartureKey(null)}
                  className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-indigo-300 hover:text-white mb-2 transition-colors"
                >
                  <ArrowLeft size={14} /> Back to All Departures
                </button>
                <h3 className="text-2xl font-black">{activeDepartureObj.tourName}</h3>
                <p className="text-xs text-indigo-200 font-bold mt-1">
                  📅 {formatDisplayDate(activeDepartureObj.journeyDate)} • 🚌 {activeDepartureObj.busType}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="bg-white/10 px-4 py-2.5 rounded-2xl text-center">
                  <p className="text-[10px] font-black uppercase text-indigo-200">Boarded</p>
                  <p className="text-xl font-black">{activeDepartureObj.checkedInPax} / {activeDepartureObj.totalPax}</p>
                </div>
                <div className="bg-white/10 px-4 py-2.5 rounded-2xl text-center">
                  <p className="text-[10px] font-black uppercase text-indigo-200">Occupancy</p>
                  <p className="text-xl font-black">{activeDepartureObj.occupancyPct}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Manifest Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-6">
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Bookings Count</p>
              <h3 className="text-3xl font-black text-slate-900">{journeyBookings.length}</h3>
            </div>
            <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-6">
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Total Passengers</p>
              <h3 className="text-3xl font-black text-slate-900">{totalPassengers}</h3>
            </div>
            <div className="bg-green-50 rounded-2xl shadow-xs border border-green-200 p-6">
              <p className="text-green-600 font-bold text-xs uppercase tracking-widest mb-2">Checked In / Boarded</p>
              <h3 className="text-3xl font-black text-green-600">
                {totalCheckedIn}/{totalPassengers}
              </h3>
              <p className="text-xs text-green-500 font-bold mt-2">
                {totalPassengers > 0 ? Math.round((totalCheckedIn / totalPassengers) * 100) : 0}% Complete
              </p>
            </div>
          </div>

          {/* Bookings & Passenger List */}
          {journeyBookings.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-12 text-center">
              <MapPin size={48} className="text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-black text-slate-900 mb-2">No Passengers Found</h3>
              <p className="text-slate-500 font-bold">
                No active bookings match this departure selection.
              </p>
            </div>
          ) : (
            journeyBookings.map((booking) => {
              const checkedInCount = booking.passengers.filter((p) => p.checkedIn).length

              return (
                <div
                  key={booking.id || booking._id}
                  className="bg-white rounded-3xl shadow-xs border border-slate-100 overflow-hidden"
                >
                  <div className="bg-linear-to-r from-indigo-50 to-blue-50 p-6 border-b border-slate-100">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 mb-1">{booking.tourName}</h3>
                        <p className="text-sm text-slate-500 font-bold">Invoice: #{booking.invoiceNo}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                          Check-in Progress
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-600 transition-all"
                              style={{
                                width: `${booking.passengers.length > 0 ? (checkedInCount / booking.passengers.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-black text-slate-900">
                            {checkedInCount}/{booking.passengers.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Date</p>
                        <p className="font-black text-slate-900">{formatDisplayDate(booking.journeyDate)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Customer</p>
                        <p className="font-black text-slate-900">{booking.contactName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Passengers</p>
                        <p className="font-black text-slate-900">{booking.passengers.length} PAX</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Payment</p>
                        <p
                          className={`font-black ${booking.advanceReceived >= booking.totalAmount ? "text-green-600" : "text-amber-600"}`}
                        >
                          {booking.advanceReceived >= booking.totalAmount
                            ? "Paid"
                            : `Due ₹${(booking.totalAmount - (booking.advanceReceived || 0)).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Phase 3: Batch Actions + Quick Balance Bar */}
                  <div className="px-6 py-3 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center gap-3 no-print">
                    {/* Batch check-in buttons */}
                    {(() => {
                      const allCheckedIn = booking.passengers.every((p) => p.checkedIn)
                      const noneCheckedIn = booking.passengers.every((p) => !p.checkedIn)
                      const isBatchProcessing = batchLoading === (booking._id || booking.id)
                      return (
                        <>
                          {!allCheckedIn && (
                            <button
                              type="button"
                              disabled={isBatchProcessing}
                              onClick={() => handleBatchCheckin(booking, true)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-sm disabled:opacity-50"
                            >
                              <CheckCheck size={14} />
                              {isBatchProcessing ? "Boarding..." : `Board All (${booking.passengers.length})`}
                            </button>
                          )}
                          {!noneCheckedIn && (
                            <button
                              type="button"
                              disabled={isBatchProcessing}
                              onClick={() => handleBatchCheckin(booking, false)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black transition-all disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              Unboard All
                            </button>
                          )}
                        </>
                      )
                    })()}

                    {/* Boarding Passes */}
                    <button
                      type="button"
                      onClick={() => setBoardingPassTarget({ booking, paxIndex: "all" })}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black transition-all border border-indigo-100 shadow-xs"
                      title="View & Print Boarding Passes with QR"
                    >
                      <Ticket size={14} />
                      <span>Boarding Passes ({booking.passengers.length})</span>
                    </button>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Quick Balance Collection */}
                    {booking.advanceReceived < booking.totalAmount && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickPayBooking(booking)
                          setQuickPayAmount(
                            Math.max(0, booking.totalAmount - (booking.advanceReceived || 0)).toString()
                          )
                          setQuickPayMode(booking.paymentMode || "Cash")
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-sm"
                      >
                        <Banknote size={14} />
                        Collect ₹{Math.max(0, booking.totalAmount - (booking.advanceReceived || 0)).toLocaleString()}
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-full">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200">
                          <th className="px-6 py-4">No.</th>
                          <th className="px-6 py-4">Name</th>
                          <th className="px-6 py-4">Age / Gender</th>
                          <th className="px-6 py-4">City</th>
                          <th className="px-6 py-4">Seat</th>
                          <th className="px-6 py-4">Payment</th>
                          <th className="px-6 py-4">Check-in</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {booking.passengers.map((passenger, idx) => {
                          const isCheckedIn = passenger.checkedIn
                          const pId = passenger._id || idx
                          const isSwapping =
                            swappingSeat &&
                            swappingSeat.bookingId === (booking._id || booking.id) &&
                            swappingSeat.passengerId === pId
                          return (
                            <tr
                              key={pId}
                              className={`transition-colors ${isCheckedIn ? "bg-green-50" : "hover:bg-slate-50"}`}
                            >
                              <td className="px-6 py-4">
                                <span className="font-black text-slate-900">{idx + 1}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-black text-slate-900">{passenger.name}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-bold text-slate-600 text-xs">
                                  {passenger.age} / {passenger.gender}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-bold text-slate-600 text-xs">{passenger.city}</span>
                              </td>
                              <td className="px-6 py-4">
                                {isSwapping ? (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      autoFocus
                                      disabled={swapLoading}
                                      onChange={(e) => {
                                        if (e.target.value) handleSeatSwap(e.target.value)
                                      }}
                                      className="px-2 py-1 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200 max-w-[140px]"
                                      defaultValue=""
                                    >
                                      <option value="" disabled>
                                        {swapLoading ? "Moving..." : "Pick seat"}
                                      </option>
                                      {availableSeatsForSwap.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => setSwappingSeat(null)}
                                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      activeDepartureObj &&
                                      setSwappingSeat({
                                        bookingId: booking._id || booking.id,
                                        passengerId: pId,
                                        passengerName: passenger.name,
                                        currentSeatId: passenger.seatId,
                                      })
                                    }
                                    className="group flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black hover:bg-indigo-100 transition-colors"
                                    title="Click to reassign seat"
                                  >
                                    {passenger.seatId || "—"}
                                    <ArrowLeftRight
                                      size={11}
                                      className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    />
                                  </button>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`text-xs font-black ${booking.advanceReceived >= booking.totalAmount ? "text-green-600" : "text-amber-600"}`}
                                >
                                  {booking.advanceReceived >= booking.totalAmount ? "Paid" : "Pending"}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCheckIn(booking, passenger, idx)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                                      isCheckedIn
                                        ? "bg-green-600 text-white shadow-md shadow-green-100"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    <Check size={14} />
                                    {isCheckedIn ? "Boarded" : "Check In"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBoardingPassTarget({ booking, paxIndex: idx })}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                    title="View & Print Passenger Boarding Pass with QR"
                                  >
                                    <Ticket size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3 justify-end no-print">
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(booking)}
                      className="flex items-center justify-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-green-100"
                    >
                      <MessageCircle size={15} />
                      WhatsApp Trip Info
                    </button>
                    {booking.contactEmail && (
                      <button
                        type="button"
                        onClick={() => handleSendEmail(booking)}
                        className="flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-100"
                      >
                        <Mail size={15} />
                        Email Info
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Printable Manifest */}
          <div className="print-only hidden">
            {journeyBookings.map((booking) => {
              const seatRows = getSortedSeatRows(booking.passengers)
              return (
                <div key={booking.id || booking._id} className="page-break-after py-10">
                  <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl">
                    <div className="bg-indigo-600 text-white px-8 py-8">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                          <div className="text-xs uppercase tracking-[0.3em] opacity-80">YatraHub Bus Seat Manifest</div>
                          <h1 className="mt-4 text-4xl font-black leading-tight">{booking.tourName}</h1>
                        </div>
                        <div className="text-right">
                          <div className="text-xs uppercase tracking-[0.25em] opacity-80">Invoice</div>
                          <div className="mt-2 text-3xl font-black">#{booking.invoiceNo}</div>
                        </div>
                      </div>
                      <div className="mt-8 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-3xl bg-white/10 p-4">
                          <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">Journey Date</div>
                          <div className="mt-2 text-lg font-black">{formatDisplayDate(booking.journeyDate)}</div>
                        </div>
                        <div className="rounded-3xl bg-white/10 p-4">
                          <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">Passengers</div>
                          <div className="mt-2 text-lg font-black">{booking.passengers.length} PAX</div>
                        </div>
                        <div className="rounded-3xl bg-white/10 p-4">
                          <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">Coach Config</div>
                          <div className="mt-2 text-lg font-black">{booking.busType || "2x1 Sleeper"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="px-8 py-10">
                      <div className="mb-8">
                        <h2 className="text-2xl font-black text-slate-900 mb-4">Seat Allocation Map</h2>
                        <div className="grid gap-4">
                          {seatRows.map((row, rowIdx) => (
                            <div key={`row-${rowIdx}`} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                              {row.map((passenger) => (
                                <div key={passenger.seatId || passenger.name} className="border border-slate-200 rounded-3xl p-4 bg-slate-50">
                                  <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-2">Seat {passenger.seatId || "—"}</div>
                                  <div className="text-lg font-black text-slate-900">{passenger.name}</div>
                                  <div className="mt-3 text-sm text-slate-600">{passenger.city}</div>
                                  <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">{passenger.age} years • {passenger.gender}</div>
                                  {includeAadhar && (
                                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700">
                                      Aadhaar: {passenger.aadhar || "N/A"}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {Array.from({ length: 4 - row.length }).map((_, emptyIdx) => (
                                <div key={`empty-${emptyIdx}`} className="border border-dashed border-slate-200 rounded-3xl p-4 bg-white/60" />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[2rem] border border-slate-200 overflow-hidden">
                        <div className="bg-slate-100 px-6 py-4 uppercase tracking-[0.25em] text-slate-500 text-xs font-black">Passenger Manifest</div>
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">#</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Name</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Seat</th>
                              {includeAadhar && <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Aadhaar</th>}
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">City</th>
                              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Age/Gender</th>
                            </tr>
                          </thead>
                          <tbody>
                            {booking.passengers.map((p, idx) => (
                              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                <td className="px-4 py-3 text-sm font-bold text-slate-500">{idx + 1}</td>
                                <td className="px-4 py-3 text-sm font-black text-slate-900">{p.name}</td>
                                <td className="px-4 py-3 text-sm font-bold text-indigo-700">{p.seatId || "—"}</td>
                                {includeAadhar && <td className="px-4 py-3 text-sm text-slate-600">{p.aadhar || "N/A"}</td>}
                                <td className="px-4 py-3 text-sm text-slate-600">{p.city}</td>
                                <td className="px-4 py-3 text-sm font-bold text-slate-700">{p.age} / {p.gender}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-8 text-center text-xs uppercase tracking-[0.2em] text-slate-400">
                        Generated by YatraHub — tour operator seat manifest
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Phase 3: Quick Payment Modal */}
      {quickPayBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in no-print">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Banknote size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Quick Collection</h3>
                  <p className="text-xs font-bold text-slate-400">
                    {quickPayBooking.invoiceNo} — {quickPayBooking.contactName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickPayBooking(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 mb-6 border border-amber-100">
              <div className="flex justify-between text-xs font-black">
                <span className="text-amber-700">Balance Due</span>
                <span className="text-amber-900">
                  ₹{Math.max(0, quickPayBooking.totalAmount - (quickPayBooking.advanceReceived || 0)).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Amount (₹)</label>
                <input
                  type="number"
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(e.target.value)}
                  min="1"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Mode</label>
                <select
                  value={quickPayMode}
                  onChange={(e) => setQuickPayMode(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none"
                >
                  {["Cash", "UPI", "NEFT/RTGS", "Cheque", "Card"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setQuickPayBooking(null)}
                className="py-3 rounded-2xl font-black text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickPay}
                disabled={quickPayLoading}
                className="py-3 rounded-2xl font-black text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200 transition-all disabled:opacity-50"
              >
                {quickPayLoading ? "Recording..." : "Collect Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Boarding Passes Modal */}
      {boardingPassTarget && (
        <BoardingPassModal
          booking={boardingPassTarget.booking}
          user={user}
          initialPassengerIndex={boardingPassTarget.paxIndex}
          onClose={() => setBoardingPassTarget(null)}
        />
      )}
    </div>
  )
}
