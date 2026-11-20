import { useState, useMemo } from "react"
import {
  MapPin,
  Check,
  MessageCircle,
  Mail,
  Bus,
  Users,
  ArrowLeft,
  Clock,
  Printer,
  ChevronRight,
  CheckCheck,
  XCircle,
  ArrowLeftRight,
  Banknote,
  Ticket,
  Layers,
  ChevronDown,
} from "lucide-react"
import { togglePassengerCheckin, batchCheckin, swapSeat } from "../data/bookings"
import { recordPayment } from "../data/payments"
import { useToast } from "./common/ToastContext"
import { PanelErrorBoundary } from "./common/PanelErrorBoundary"
import { toDateInputValue, formatDisplayDate } from "../utils/date"
import { formatINR, formatSeatLabel } from "../utils/formatters"
import BoardingPassModal from "./common/BoardingPassModal"
import SeatLayoutModal from "./common/SeatLayoutModal"
import {
  Card,
  Button,
  Modal,
  Badge,
  StatusPill,
  StatCard,
  Field,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  FOCUS_RING_CLASS,
} from "./ui"
import { cn } from "../utils/cn"

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

export default function JourneyManager({ bookings = [], onUpdateBooking, user }) {
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

  // Seat swap modal state
  const [swappingSeat, setSwappingSeat] = useState(null) // { bookingId, passengerId, passengerName, currentSeatId }
  const [selectedNewSeat, setSelectedNewSeat] = useState("")
  const [swapLoading, setSwapLoading] = useState(false)

  // Quick payment state
  const [quickPayBooking, setQuickPayBooking] = useState(null)
  const [quickPayAmount, setQuickPayAmount] = useState("")
  const [quickPayMode, setQuickPayMode] = useState("Cash")
  const [quickPayLoading, setQuickPayLoading] = useState(false)

  // Batch check-in loading
  const [batchLoading, setBatchLoading] = useState(null) // bookingId currently batch-processing

  // Passenger Seat Layout modal state
  const [showSeatLayoutModal, setShowSeatLayoutModal] = useState(false)
  const [activeLayoutDeparture, setActiveLayoutDeparture] = useState(null)

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
        let statusBadgeVariant = "brand"
        if (dep.dateStr === todayStr) {
          statusTag = "TODAY"
          statusBadgeVariant = "success"
        } else if (dep.dateStr === tomorrowStr) {
          statusTag = "TOMORROW"
          statusBadgeVariant = "warning"
        } else if (dep.dateStr < todayStr) {
          statusTag = "PAST"
          statusBadgeVariant = "neutral"
        }

        return {
          ...dep,
          bookedCount,
          occupancyPct,
          balanceDue,
          statusTag,
          statusBadgeVariant,
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
    0,
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
        `${passenger.name} marked as ${!passenger.checkedIn ? "Checked In" : "Pending"}`,
      )
    } catch (err) {
      toast.error(err.message || "Failed to update check-in status")
    }
  }

  // Batch check-in / unboard all
  const handleBatchCheckin = async (booking, checkedIn) => {
    const bookingId = booking._id || booking.id
    setBatchLoading(bookingId)
    try {
      const updatedBooking = await batchCheckin(bookingId, checkedIn)
      if (onUpdateBooking) onUpdateBooking(updatedBooking)
      toast.success(
        checkedIn
          ? `All ${booking.passengers.length} passengers boarded`
          : `All passengers unboarded for ${booking.invoiceNo}`,
      )
    } catch (err) {
      toast.error(err.message || "Failed to batch update check-in")
    } finally {
      setBatchLoading(null)
    }
  }

  // Seat swap handler
  const handleSeatSwap = async (newSeatId) => {
    if (!swappingSeat || !newSeatId) return
    setSwapLoading(true)
    try {
      const updatedBooking = await swapSeat(
        swappingSeat.bookingId,
        swappingSeat.passengerId,
        newSeatId,
      )
      if (onUpdateBooking) onUpdateBooking(updatedBooking)
      toast.success(`${swappingSeat.passengerName} moved to seat ${formatSeatLabel(newSeatId)}`)
      setSwappingSeat(null)
      setSelectedNewSeat("")
    } catch (err) {
      toast.error(err.message || "Failed to reassign seat")
    } finally {
      setSwapLoading(false)
    }
  }

  // Available seats for swap (all seats minus occupied ones on this departure)
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
    // Remove the current seat from occupied so current seat can be re-selected
    if (swappingSeat.currentSeatId) occupied.delete(swappingSeat.currentSeatId)
    return allSeats.filter((s) => !occupied.has(s))
  }, [swappingSeat, activeDepartureObj])

  // Quick payment handler
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
      toast.success(`${formatINR(num, 0)} collected from ${quickPayBooking.contactName}`)
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
    const paxList = Array.isArray(booking.passengers) ? booking.passengers : []
    const passengers = paxList.map((p) => `${p.name} (${p.city || ""})`).join(", ")
    const message = `Hi ${booking.contactName || ""},\n\nYour journey details:\nInvoice: ${booking.invoiceNo || ""}\nTour: ${booking.tourName || ""}\nDate: ${formatDisplayDate(booking.journeyDate)}\nPassengers: ${passengers}\nTotal: ${paxList.length}\n\nPlease confirm receipt. Thank you!`
    const phoneNumber = (booking.contactPhone || "").replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleSendEmail = (booking) => {
    const paxList = Array.isArray(booking.passengers) ? booking.passengers : []
    const passengers = paxList.map((p) => `${p.name} (${p.city || ""})`).join(", ")
    const subject = `Journey Details - ${booking.invoiceNo || ""}`
    const body = `Hi ${booking.contactName || ""},\n\nYour journey details:\n\nInvoice: ${booking.invoiceNo || ""}\nTour: ${booking.tourName || ""}\nDate: ${formatDisplayDate(booking.journeyDate)}\nPassengers: ${passengers}\nTotal: ${paxList.length}\n\nPlease confirm receipt.\n\nThank you!`
    const mailUrl = `mailto:${booking.contactEmail || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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
    const list = Array.isArray(passengers) ? passengers : []
    const sorted = [...list].sort((a, b) =>
      (a?.seatId || "").localeCompare(b?.seatId || "", undefined, { numeric: true }),
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
    <div className="space-y-6">
      {/* View Switcher Tabs & Print Header (no-print) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
        <div role="tablist" aria-label="Journey view mode" className="flex bg-surface-muted p-1 rounded-[var(--yh-radius-lg)] border border-border-subtle">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "departures"}
            onClick={() => {
              setViewMode("departures")
              setSelectedDepartureKey(null)
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-[var(--yh-radius-md)] text-xs font-semibold transition-colors cursor-pointer min-h-10",
              viewMode === "departures"
                ? "bg-surface text-brand font-bold shadow-xs"
                : "text-ink-secondary hover:text-ink hover:bg-surface-hover",
              FOCUS_RING_CLASS,
            )}
          >
            <Bus size={15} />
            Coaches & Departures ({departures.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "manifest"}
            onClick={() => setViewMode("manifest")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-[var(--yh-radius-md)] text-xs font-semibold transition-colors cursor-pointer min-h-10",
              viewMode === "manifest"
                ? "bg-surface text-brand font-bold shadow-xs"
                : "text-ink-secondary hover:text-ink hover:bg-surface-hover",
              FOCUS_RING_CLASS,
            )}
          >
            <Users size={15} />
            Boarding Manifest
          </button>
        </div>

        {/* Print / Export Action Menu */}
        <div className="relative self-end sm:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowExportOptions(!showExportOptions)}
            aria-expanded={showExportOptions}
            aria-haspopup="true"
            aria-label="Print Manifest"
            leftIcon={<Printer size={14} />}
            rightIcon={<ChevronDown size={14} className="opacity-70" />}
            className="whitespace-nowrap shrink-0 inline-flex items-center"
          >
            <span>Print Manifest</span>
          </Button>
          {showExportOptions && (
            <div className="absolute right-0 top-full mt-1.5 w-60 rounded-[var(--yh-radius-lg)] bg-surface-elevated border border-border-subtle shadow-[var(--yh-shadow-overlay)] z-[var(--yh-z-dropdown)] overflow-hidden py-1">
              <button
                type="button"
                onClick={() => {
                  setShowExportOptions(false)
                  setActiveLayoutDeparture(activeDepartureObj || (departures.length > 0 ? departures[0] : null))
                  setShowSeatLayoutModal(true)
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-semibold text-brand hover:bg-brand-soft/50 flex items-center gap-2 border-b border-border-subtle transition-colors cursor-pointer"
              >
                <Layers size={14} />
                <span>Seat Layout Chart (PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrintSeatLayout(true)}
                className="w-full px-4 py-2 text-left text-xs font-medium text-ink hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Print Manifest (With Aadhaar)
              </button>
              <button
                type="button"
                onClick={() => handlePrintSeatLayout(false)}
                className="w-full px-4 py-2 text-left text-xs font-medium text-ink hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Print Manifest (Without Aadhaar)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar (no-print) */}
      <Card elevation="sm" padding="md" className="space-y-4 no-print">
        {/* Time Horizon Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted mr-1">Time Horizon:</span>
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
              aria-pressed={dateFilterMode === mode.id}
              onClick={() => {
                setDateFilterMode(mode.id)
                setSelectedDepartureKey(null)
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-[var(--yh-radius-md)] text-xs font-semibold border transition-colors cursor-pointer min-h-9",
                dateFilterMode === mode.id
                  ? "bg-brand text-brand-fg border-brand"
                  : "bg-surface text-ink-secondary border-border-subtle hover:bg-surface-hover hover:text-ink",
                FOCUS_RING_CLASS,
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Sub-Filters: Tour & Specific Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-border-subtle">
          <Field id="journey-tour-filter" label="Filter Tour">
            {({ id }) => (
              <Select
                id={id}
                value={selectedTour}
                onChange={(e) => setSelectedTour(e.target.value)}
              >
                <option value="all">All Tours</option>
                {uniqueTours.map((tour) => (
                  <option key={tour} value={tour}>
                    {tour}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field id="journey-date-filter" label="Or Specific Date">
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value)
                  setDateFilterMode("custom")
                  setSelectedDepartureKey(null)
                }}
              />
            )}
          </Field>
        </div>
      </Card>

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODE 1: DEPARTURES GROUPED CARD VIEW                       */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewMode === "departures" && (
        <PanelErrorBoundary resetKey={viewMode} title="Coaches & Departures Error">
          <div className="space-y-6">
          {filteredDepartures.length === 0 ? (
            <Card elevation="sm" padding="lg" className="text-center py-12">
              <Bus size={40} className="text-ink-muted mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-ink mb-1">No Departures Found</h3>
              <p className="text-xs text-ink-muted">
                No active bus departures match the selected filters.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDepartures.map((dep) => (
                <Card
                  key={dep.key}
                  elevation="sm"
                  padding="md"
                  className="flex flex-col justify-between hover:border-border-strong transition-colors"
                >
                  <div className="space-y-4">
                    {/* Top status & date */}
                    <div className="flex justify-between items-start gap-2">
                      <Badge variant={dep.statusBadgeVariant} size="sm">
                        {dep.statusTag}
                      </Badge>
                      <span className="text-xs font-semibold text-ink-muted flex items-center gap-1 shrink-0">
                        <Clock size={12} className="opacity-70" />
                        {formatDisplayDate(dep.journeyDate)}
                      </span>
                    </div>

                    {/* Tour title & Coach badge */}
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-ink leading-snug">
                        {dep.tourName}
                      </h3>
                      <div className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-ink-secondary">
                        <Bus size={13} className="text-brand shrink-0" />
                        <span>{dep.busType} ({dep.capacity} Berths)</span>
                      </div>
                    </div>

                    {/* Coach Capacity Meter with role="progressbar" */}
                    <div className="p-3 bg-surface-muted/60 rounded-[var(--yh-radius-md)] border border-border-subtle space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-ink-muted">Bus Capacity</span>
                        <span className="text-ink tabular-nums">
                          {dep.bookedCount} / {dep.capacity} Seats ({dep.occupancyPct}%)
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={dep.bookedCount}
                        aria-valuemin={0}
                        aria-valuemax={dep.capacity}
                        aria-label={`Coach capacity: ${dep.bookedCount} of ${dep.capacity} berths booked, ${dep.occupancyPct}%`}
                        className="w-full h-2.5 bg-surface-muted rounded-full overflow-hidden border border-border-subtle"
                      >
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            dep.occupancyPct >= 80
                              ? "bg-success"
                              : dep.occupancyPct >= 50
                                ? "bg-accent-warm"
                                : "bg-brand",
                          )}
                          style={{ width: `${dep.occupancyPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Boarding Progress & Financials */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-[var(--yh-radius-md)] bg-success-soft text-success-text">
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Boarded Pax</p>
                        <p className="text-sm font-bold tabular-nums mt-0.5">
                          {dep.checkedInPax} / {dep.totalPax}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-[var(--yh-radius-md)] bg-warning-soft text-warning-text">
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Pending Due</p>
                        <p className="text-sm font-bold tabular-nums mt-0.5">
                          {formatINR(dep.balanceDue, 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-4 mt-4 border-t border-border-subtle flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveLayoutDeparture(dep)
                        setShowSeatLayoutModal(true)
                      }}
                      title="Download / Print Passenger Seat Layout"
                    >
                      <Layers size={13} className="mr-1 text-brand" />
                      <span>Layout</span>
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedDepartureKey(dep.key)
                        setViewMode("manifest")
                      }}
                    >
                      <span>Open Boarding</span>
                      <ChevronRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        </PanelErrorBoundary>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODE 2: PASSENGER BOARDING MANIFEST                        */}
      {/* ────────────────────────────────────────────────────────── */}
      {viewMode === "manifest" && (
        <PanelErrorBoundary resetKey={viewMode} title="Boarding Manifest Error">
          <div className="space-y-6">
          {/* Active Departure Banner (if scoped) */}
          {activeDepartureObj && (
            <Card elevation="sm" padding="md" className="bg-brand-soft/50 border border-brand/20">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDepartureKey(null)}
                    className="mb-2 -ml-2 text-brand hover:text-brand-hover"
                  >
                    <ArrowLeft size={14} className="mr-1" /> Back to All Departures
                  </Button>
                  <h3 className="text-xl sm:text-2xl font-bold text-ink">{activeDepartureObj.tourName}</h3>
                  <p className="text-xs text-ink-muted mt-1">
                    📅 {formatDisplayDate(activeDepartureObj.journeyDate)} • 🚌 {activeDepartureObj.busType}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="bg-surface px-3 py-2 rounded-[var(--yh-radius-md)] border border-border-subtle text-center">
                    <p className="text-[10px] font-semibold text-ink-muted uppercase">Boarded</p>
                    <p className="text-base font-bold text-ink tabular-nums">{activeDepartureObj.checkedInPax} / {activeDepartureObj.totalPax}</p>
                  </div>
                  <div className="bg-surface px-3 py-2 rounded-[var(--yh-radius-md)] border border-border-subtle text-center">
                    <p className="text-[10px] font-semibold text-ink-muted uppercase">Occupancy</p>
                    <p className="text-base font-bold text-ink tabular-nums">{activeDepartureObj.occupancyPct}%</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveLayoutDeparture(activeDepartureObj)
                      setShowSeatLayoutModal(true)
                    }}
                  >
                    <Layers size={14} className="mr-1.5 text-brand" />
                    <span>Seat Layout PDF</span>
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Manifest Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Bookings Count"
              value={journeyBookings.length}
              icon={<Bus size={18} />}
              tone="brand"
            />
            <StatCard
              label="Total Passengers"
              value={totalPassengers}
              icon={<Users size={18} />}
              tone="accent"
            />
            <StatCard
              label="Checked In / Boarded"
              value={`${totalCheckedIn}/${totalPassengers}`}
              hint={`${totalPassengers > 0 ? Math.round((totalCheckedIn / totalPassengers) * 100) : 0}% Complete`}
              icon={<Check size={18} />}
              tone="success"
            />
          </div>

          {/* Bookings & Passenger List */}
          {journeyBookings.length === 0 ? (
            <Card elevation="sm" padding="lg" className="text-center py-12">
              <MapPin size={40} className="text-ink-muted mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-ink mb-1">No Passengers Found</h3>
              <p className="text-xs text-ink-muted">
                No active bookings match this departure selection.
              </p>
            </Card>
          ) : (
            journeyBookings.map((booking) => {
              const paxList = Array.isArray(booking.passengers) ? booking.passengers : []
              const checkedInCount = paxList.filter((p) => p.checkedIn).length
              const allCheckedIn = paxList.length > 0 && paxList.every((p) => p.checkedIn)
              const noneCheckedIn = paxList.every((p) => !p.checkedIn)
              const isBatchProcessing = batchLoading === (booking._id || booking.id)
              const balanceDue = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0))
              const isFullyPaid = balanceDue === 0

              return (
                <Card
                  key={booking.id || booking._id}
                  elevation="sm"
                  padding="none"
                  className="overflow-hidden"
                >
                  {/* Booking Header Banner */}
                  <div className="bg-surface-muted/60 p-4 sm:p-5 border-b border-border-subtle">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                      <div>
                        <h4 className="text-base font-bold text-ink">{booking.tourName}</h4>
                        <p className="text-xs text-ink-muted font-medium">Invoice #{booking.invoiceNo}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink-muted">Check-in:</span>
                        <div
                          role="progressbar"
                          aria-valuenow={checkedInCount}
                          aria-valuemin={0}
                          aria-valuemax={paxList.length}
                          aria-label={`Boarding progress: ${checkedInCount} of ${paxList.length} passengers boarded`}
                          className="w-20 sm:w-24 h-2 bg-border-subtle rounded-full overflow-hidden"
                        >
                          <div
                            className="h-full bg-success transition-all"
                            style={{
                              width: `${paxList.length > 0 ? (checkedInCount / paxList.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-ink tabular-nums">
                          {checkedInCount}/{paxList.length}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-ink-muted block">Date</span>
                        <span className="font-semibold text-ink">{formatDisplayDate(booking.journeyDate)}</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">Primary Customer</span>
                        <span className="font-semibold text-ink">{booking.contactName}</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">Passengers</span>
                        <span className="font-semibold text-ink tabular-nums">{paxList.length} PAX</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">Payment</span>
                        <StatusPill status={isFullyPaid ? "Paid" : "Pending"} size="sm" />
                      </div>
                    </div>
                  </div>

                  {/* Batch Actions & Quick Balance Bar (no-print) */}
                  <div className="px-4 sm:px-5 py-2.5 bg-surface border-b border-border-subtle flex flex-wrap items-center gap-2 no-print">
                    {!allCheckedIn && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={isBatchProcessing}
                        onClick={() => handleBatchCheckin(booking, true)}
                        className="min-h-11 sm:min-h-9"
                      >
                        <CheckCheck size={14} className="mr-1.5" />
                        {isBatchProcessing ? "Boarding..." : `Board All (${paxList.length})`}
                      </Button>
                    )}
                    {!noneCheckedIn && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBatchProcessing}
                        onClick={() => handleBatchCheckin(booking, false)}
                        className="min-h-11 sm:min-h-9"
                      >
                        <XCircle size={14} className="mr-1.5" />
                        Unboard All
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setBoardingPassTarget({ booking, paxIndex: "all" })}
                      title="View & Print Boarding Passes with QR"
                      className="min-h-11 sm:min-h-9"
                    >
                      <Ticket size={14} className="mr-1.5 text-brand" />
                      <span>Boarding Passes ({paxList.length})</span>
                    </Button>

                    <div className="flex-1" />

                    {balanceDue > 0 && (
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        onClick={() => {
                          setQuickPayBooking(booking)
                          setQuickPayAmount(balanceDue.toString())
                          setQuickPayMode(booking.paymentMode || "Cash")
                        }}
                        className="min-h-11 sm:min-h-9"
                      >
                        <Banknote size={14} className="mr-1.5" />
                        Collect {formatINR(balanceDue, 0)}
                      </Button>
                    )}
                  </div>

                  {/* Passenger Roster: Desktop Table (hidden on mobile) */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Passenger Name</TableHead>
                          <TableHead>Age / Gender</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Seat</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead align="right">Boarding Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paxList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-6 text-xs text-ink-muted">
                              No passenger details recorded for this booking.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paxList.map((passenger, idx) => {
                          const isCheckedIn = Boolean(passenger.checkedIn)
                          const pId = passenger._id || idx
                          return (
                            <TableRow key={pId} className={isCheckedIn ? "bg-success-soft/20" : undefined}>
                              <TableCell tabular className="font-semibold text-ink-muted">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="font-semibold text-ink">
                                {passenger.name}
                              </TableCell>
                              <TableCell className="text-xs text-ink-secondary">
                                {passenger.age} / {passenger.gender}
                              </TableCell>
                              <TableCell className="text-xs text-ink-secondary">
                                {passenger.city}
                              </TableCell>
                              <TableCell>
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
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold border transition-colors cursor-pointer",
                                    passenger.seatId
                                      ? "bg-brand-soft text-brand border-brand/20 hover:border-brand/50"
                                      : "bg-surface-muted text-ink-muted border-border-subtle hover:bg-surface-hover",
                                    FOCUS_RING_CLASS,
                                  )}
                                  title="Click to reassign seat"
                                >
                                  <span>{formatSeatLabel(passenger.seatId)}</span>
                                  <ArrowLeftRight size={11} className="opacity-70" />
                                </button>
                              </TableCell>
                              <TableCell>
                                <StatusPill status={isFullyPaid ? "Paid" : "Pending"} size="sm" />
                              </TableCell>
                              <TableCell align="right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCheckIn(booking, passenger, idx)}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--yh-radius-md)] text-xs font-semibold transition-colors cursor-pointer min-h-9",
                                      isCheckedIn
                                        ? "bg-success text-success-fg shadow-xs"
                                        : "bg-surface-muted text-ink-secondary border border-border-strong hover:bg-surface-hover",
                                      FOCUS_RING_CLASS,
                                    )}
                                  >
                                    <Check size={13} />
                                    {isCheckedIn ? "Boarded" : "Check In"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBoardingPassTarget({ booking, paxIndex: idx })}
                                    className={cn(
                                      "p-2 rounded-[var(--yh-radius-md)] text-ink-muted hover:text-brand hover:bg-brand-soft/60 transition-colors",
                                      FOCUS_RING_CLASS,
                                    )}
                                    title="View & Print Passenger Boarding Pass"
                                    aria-label={`Print Boarding Pass for ${passenger.name}`}
                                  >
                                    <Ticket size={16} />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                    </Table>
                  </div>

                  {/* Passenger Roster: Mobile-first Stacked Checklist (<md) */}
                  <div className="md:hidden divide-y divide-border-subtle">
                    {paxList.length === 0 ? (
                      <div className="p-4 text-center text-xs text-ink-muted">
                        No passenger details recorded for this booking.
                      </div>
                    ) : (
                      paxList.map((passenger, idx) => {
                      const isCheckedIn = Boolean(passenger.checkedIn)
                      const pId = passenger._id || idx
                      return (
                        <div
                          key={pId}
                          className={cn(
                            "p-4 space-y-3",
                            isCheckedIn ? "bg-success-soft/20" : "bg-surface",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-ink-muted tabular-nums mr-1.5">
                                #{idx + 1}
                              </span>
                              <span className="font-semibold text-ink text-sm">
                                {passenger.name}
                              </span>
                              <p className="text-xs text-ink-muted mt-0.5">
                                {passenger.gender} • {passenger.age} yrs • {passenger.city}
                              </p>
                            </div>
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
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold border transition-colors shrink-0",
                                passenger.seatId
                                  ? "bg-brand-soft text-brand border-brand/20"
                                  : "bg-surface-muted text-ink-muted border-border-subtle",
                              )}
                            >
                              <span>{formatSeatLabel(passenger.seatId)}</span>
                              <ArrowLeftRight size={10} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setBoardingPassTarget({ booking, paxIndex: idx })}
                              className="text-xs font-medium text-brand flex items-center gap-1 py-1"
                            >
                              <Ticket size={13} />
                              Boarding Pass
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCheckIn(booking, passenger, idx)}
                              className={cn(
                                "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[var(--yh-radius-md)] text-xs font-semibold min-h-11 transition-colors cursor-pointer",
                                isCheckedIn
                                  ? "bg-success text-success-fg shadow-xs"
                                  : "bg-surface-muted text-ink-secondary border border-border-strong hover:bg-surface-hover",
                                FOCUS_RING_CLASS,
                              )}
                            >
                              <Check size={14} />
                              {isCheckedIn ? "Boarded" : "Check In"}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                  {/* Customer Communication Footer (no-print) */}
                  <div className="p-3 sm:px-5 bg-surface-muted/40 border-t border-border-subtle flex flex-wrap items-center justify-end gap-2 no-print">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendWhatsApp(booking)}
                    >
                      <MessageCircle size={14} className="mr-1.5 text-emerald-600" />
                      WhatsApp Trip Info
                    </Button>
                    {booking.contactEmail && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendEmail(booking)}
                      >
                        <Mail size={14} className="mr-1.5 text-blue-600" />
                        Email Info
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })
          )}

          {/* Printable Manifest (Untouched layout for physical printing) */}
          <div className="print-only hidden">
            {journeyBookings.map((booking) => {
              const printPax = Array.isArray(booking.passengers) ? booking.passengers : []
              const seatRows = getSortedSeatRows(printPax)
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
                          <div className="mt-2 text-lg font-black">{printPax.length} PAX</div>
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
                            {printPax.map((p, idx) => (
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
        </PanelErrorBoundary>
      )}

      {/* Accessible Seat Swap Modal */}
      <Modal
        isOpen={Boolean(swappingSeat)}
        onClose={() => {
          setSwappingSeat(null)
          setSelectedNewSeat("")
        }}
        size="sm"
        title="Reassign Passenger Seat"
        description={
          swappingSeat ? (
            <span>
              Moving <strong className="text-ink">{swappingSeat.passengerName}</strong> from{" "}
              <strong className="text-brand">{formatSeatLabel(swappingSeat.currentSeatId)}</strong>
            </span>
          ) : null
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSwappingSeat(null)
                setSelectedNewSeat("")
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={swapLoading || !selectedNewSeat}
              onClick={() => handleSeatSwap(selectedNewSeat)}
            >
              {swapLoading ? "Reassigning..." : "Confirm Reassignment"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field id="swap-new-seat" label="Select New Available Seat">
            {({ id }) => (
              <Select
                id={id}
                value={selectedNewSeat}
                onChange={(e) => setSelectedNewSeat(e.target.value)}
                disabled={swapLoading}
              >
                <option value="" disabled>
                  -- Choose an available seat --
                </option>
                {availableSeatsForSwap.map((s) => (
                  <option key={s} value={s}>
                    {formatSeatLabel(s)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {availableSeatsForSwap.length === 0 && (
            <p className="text-xs text-warning-text font-medium">
              No alternate berths are currently available on this departure coach.
            </p>
          )}
        </div>
      </Modal>

      {/* Accessible Quick Collection Modal */}
      <Modal
        isOpen={Boolean(quickPayBooking)}
        onClose={() => setQuickPayBooking(null)}
        size="sm"
        title={
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[var(--yh-radius-md)] bg-accent-warm-soft text-accent-warm-text shrink-0">
              <Banknote size={18} />
            </div>
            <div>
              <span className="text-base font-bold text-ink">Collect Payment at Boarding</span>
              <p className="text-xs text-ink-muted font-normal mt-0.5">
                {quickPayBooking?.invoiceNo} — {quickPayBooking?.contactName}
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setQuickPayBooking(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={quickPayLoading}
              onClick={handleQuickPay}
            >
              {quickPayLoading ? "Recording..." : "Confirm Collection"}
            </Button>
          </div>
        }
      >
        {quickPayBooking && (
          <div className="space-y-4">
            <div className="p-3 rounded-[var(--yh-radius-md)] bg-accent-warm-soft text-accent-warm-text flex items-center justify-between text-xs">
              <span className="font-medium">Balance Remaining Due:</span>
              <span className="font-bold text-sm tabular-nums">
                {formatINR(
                  Math.max(0, quickPayBooking.totalAmount - (quickPayBooking.advanceReceived || 0)),
                  0,
                )}
              </span>
            </div>

            <Field id="quick-pay-amount" label="Amount Collected (₹)">
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min="1"
                  tabular
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(e.target.value)}
                />
              )}
            </Field>

            <Field id="quick-pay-mode" label="Payment Mode">
              {({ id }) => (
                <Select
                  id={id}
                  value={quickPayMode}
                  onChange={(e) => setQuickPayMode(e.target.value)}
                >
                  {["Cash", "UPI", "NEFT/RTGS", "Cheque", "Card"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}
      </Modal>

      {/* Boarding Passes Modal */}
      {boardingPassTarget && (
        <BoardingPassModal
          booking={boardingPassTarget.booking}
          user={user}
          initialPassengerIndex={boardingPassTarget.paxIndex}
          onClose={() => setBoardingPassTarget(null)}
        />
      )}

      {/* Passenger Seat Layout Modal */}
      {showSeatLayoutModal && (
        <SeatLayoutModal
          departure={activeLayoutDeparture}
          bookings={bookings}
          user={user}
          onClose={() => {
            setShowSeatLayoutModal(false)
            setActiveLayoutDeparture(null)
          }}
        />
      )}
    </div>
  )
}
