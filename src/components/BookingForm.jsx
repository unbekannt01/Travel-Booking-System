import { useState, useMemo, useRef, useEffect } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Save,
  UserPlus,
  Trash2,
  Bus,
  CreditCard,
  Calendar,
  Building,
  ChevronDown,
  ChevronUp,
  Check,
  Layout,
  X,
  LockKeyhole,
  Wand2,
  ShieldAlert,
  AlertCircle,
  Edit3,
  Users,
  Receipt,
} from "lucide-react"
import { useToast } from "./common/ToastContext"
import { toDateInputValue, formatDisplayDate } from "../utils/date"
import { calculatePricing } from "../utils/pricing"
import { autoAssignSeats } from "../utils/seatAssignment"
import { formatINR, maskAadhaar } from "../utils/formatters"
import { isMaskedAadhaar } from "../utils/validators"
import { lookupCustomerByPhone } from "../data/customers"
import { cn } from "../utils/cn"
import {
  BOOKING_STEPS,
  validateBookingStep,
  validateAllBookingSteps,
  canNavigateToStep,
  buildBookingSummary,
  formatServerBookingError,
} from "../utils/bookingFormHelpers"
import {
  Card,
  Modal,
  Button,
  IconButton,
  Input,
  Select,
  Checkbox,
  Field,
  Badge,
  FOCUS_RING_CLASS,
} from "./ui"

/* ── Existing Coach Seat Layout Modal Components (restyled in Part 3.4) ── */
const rows = [1, 2, 3, 4, 5, 6]
const rows2x2 = [1, 2, 3, 4, 5] // 2x2 has 5 rows (10 seats per deck)

const Seat = ({ id, label, passengers, onSeatSelect, bookedSeats }) => {
  const getSeatInfo = (seatId) => passengers.find((p) => p.seatId === seatId)
  const occupant = getSeatInfo(id)
  const isSelectedInCurrentBooking = !!occupant

  const bookedBy = bookedSeats.find((bs) => bs.seatId === id)
  const isBookedByOther = !!bookedBy

  return (
    <button
      type="button"
      onClick={() => !isBookedByOther && onSeatSelect(id)}
      disabled={isBookedByOther}
      className={`relative h-14 md:h-16 rounded-lg border-2 transition-all flex flex-col items-center justify-center p-1 group ${
        isBookedByOther
          ? "border-[var(--yh-danger)]/40 bg-[var(--yh-danger-subtle)] cursor-not-allowed opacity-75"
          : isSelectedInCurrentBooking
            ? "border-[var(--yh-brand)] bg-[var(--yh-brand-subtle)] cursor-pointer"
            : "border-[var(--yh-border-default)] bg-[var(--yh-bg-surface)] hover:border-[var(--yh-brand)] cursor-pointer"
      }`}
    >
      <span
        className={`text-[8px] md:text-[9px] font-black mb-0.5 ${
          isBookedByOther
            ? "text-[var(--yh-danger)]"
            : isSelectedInCurrentBooking
              ? "text-[var(--yh-brand)]"
              : "text-[var(--yh-text-muted)]"
        }`}
      >
        {label}
      </span>
      {isBookedByOther ? (
        <div className="flex flex-col items-center">
          <LockKeyhole size={10} className="text-[var(--yh-danger)] mb-0.5" />
          <div className="text-[7px] font-bold text-[var(--yh-danger)] leading-tight text-center truncate w-full px-1">
            {bookedBy.passengerName?.split(" ")[0] || "Booked"}
          </div>
        </div>
      ) : isSelectedInCurrentBooking ? (
        <div className="text-[8px] font-bold text-[var(--yh-brand)] leading-tight text-center truncate w-full px-1">
          {occupant.name?.split(" ")[0] || "USER"}
        </div>
      ) : (
        <div className="w-1 h-1 rounded-full bg-[var(--yh-border-default)] group-hover:bg-[var(--yh-brand)]" />
      )}
    </button>
  )
}

const DeckGrid = ({ deck, passengers, onSeatSelect, bookedSeats }) => (
  <div className="flex flex-col items-center space-y-4">
    <div className="px-4 py-1.5 bg-[var(--yh-brand)] text-[var(--yh-brand-fg)] rounded-full text-[10px] font-black uppercase tracking-widest shadow-xs mb-2">
      {deck} DECK
    </div>
    <div className="relative bg-[var(--yh-bg-surface-muted)] p-4 rounded-2xl border-2 border-[var(--yh-border-default)] shadow-xs">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--yh-bg-surface)] px-3 py-1 rounded-full text-[8px] font-black text-[var(--yh-text-secondary)] uppercase tracking-widest z-10 border border-[var(--yh-border-default)]">
        FRONT
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <Seat
              key={`${deck}-L${row}`}
              id={`${deck}-L${row}`}
              label={`${deck[0].toUpperCase()}${row}-L`}
              passengers={passengers}
              onSeatSelect={onSeatSelect}
              bookedSeats={bookedSeats}
            />
          ))}
        </div>

        <div className="w-8 md:w-10 bg-[var(--yh-bg-surface)] border border-[var(--yh-border-subtle)] rounded-lg flex items-center justify-center relative overflow-hidden">
          <div className="rotate-90 whitespace-nowrap text-[10px] md:text-xs font-black text-[var(--yh-text-muted)] uppercase tracking-[0.5em] flex items-center gap-2">
            <span className="opacity-20">----------</span>
            GALLARY
            <span className="opacity-20">----------</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {rows.map((row) => (
            <div key={`${deck}-R${row}-group`} className="contents">
              <Seat
                id={`${deck}-R${row}-1`}
                label={`${deck[0].toUpperCase()}${row}-R1`}
                passengers={passengers}
                onSeatSelect={onSeatSelect}
                bookedSeats={bookedSeats}
              />
              <Seat
                id={`${deck}-R${row}-2`}
                label={`${deck[0].toUpperCase()}${row}-R2`}
                passengers={passengers}
                onSeatSelect={onSeatSelect}
                bookedSeats={bookedSeats}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

const DeckGrid2x2 = ({ deck, passengers, onSeatSelect, bookedSeats }) => (
  <div className="flex flex-col items-center space-y-4">
    <div className="px-4 py-1.5 bg-[var(--yh-brand)] text-[var(--yh-brand-fg)] rounded-full text-[10px] font-black uppercase tracking-widest shadow-xs mb-2">
      {deck} DECK
    </div>
    <div className="relative bg-[var(--yh-bg-surface-muted)] p-4 rounded-2xl border-2 border-[var(--yh-border-default)] shadow-xs">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--yh-bg-surface)] px-3 py-1 rounded-full text-[8px] font-black text-[var(--yh-text-secondary)] uppercase tracking-widest z-10 border border-[var(--yh-border-default)]">
        FRONT
      </div>

      <div className="flex gap-4">
        <div className="grid grid-cols-2 gap-3">
          {rows2x2.map((row) => (
            <div key={`${deck}-L${row}-group`} className="contents">
              <Seat
                id={`${deck}-L${row}-1`}
                label={`${deck[0].toUpperCase()}${row}-L1`}
                passengers={passengers}
                onSeatSelect={onSeatSelect}
                bookedSeats={bookedSeats}
              />
              <Seat
                id={`${deck}-L${row}-2`}
                label={`${deck[0].toUpperCase()}${row}-L2`}
                passengers={passengers}
                onSeatSelect={onSeatSelect}
                bookedSeats={bookedSeats}
              />
            </div>
          ))}
        </div>

        <div className="w-8 md:w-10 bg-[var(--yh-bg-surface)] border border-[var(--yh-border-subtle)] rounded-lg flex items-center justify-center relative overflow-hidden">
          <div className="rotate-90 whitespace-nowrap text-[10px] md:text-xs font-black text-[var(--yh-text-muted)] uppercase tracking-[0.5em] flex items-center gap-2">
            <span className="opacity-20">----------</span>
            GALLARY
            <span className="opacity-20">----------</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {rows2x2.map((row) => (
            <div key={`${deck}-R${row}-group`} className="contents">
              <Seat
                id={`${deck}-R${row}-1`}
                label={`${deck[0].toUpperCase()}${row}-R1`}
                passengers={passengers}
                onSeatSelect={onSeatSelect}
                bookedSeats={bookedSeats}
              />
              <Seat
                id={`${deck}-R${row}-2`}
                label={`${deck[0].toUpperCase()}${row}-R2`}
                passengers={passengers}
                onSeatSelect={onSeatSelect}
                bookedSeats={bookedSeats}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

const SeatLegend = () => (
  <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-2 px-5 bg-[var(--yh-bg-surface-muted)] border border-[var(--yh-border-default)] rounded-2xl w-full max-w-2xl mx-auto mb-4">
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-md border-2 border-[var(--yh-border-default)] bg-[var(--yh-bg-surface)]" />
      <span className="text-[11px] font-black uppercase tracking-wider text-[var(--yh-text-secondary)]">Available</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-md border-2 border-[var(--yh-brand)] bg-[var(--yh-brand-subtle)] flex items-center justify-center text-[9px] font-black text-[var(--yh-brand)]">✓</div>
      <span className="text-[11px] font-black uppercase tracking-wider text-[var(--yh-brand)]">Selected</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-md border-2 border-[var(--yh-danger)]/40 bg-[var(--yh-danger-subtle)] flex items-center justify-center">
        <LockKeyhole size={10} className="text-[var(--yh-danger)]" />
      </div>
      <span className="text-[11px] font-black uppercase tracking-wider text-[var(--yh-danger)]">Booked</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-md border-2 border-[var(--yh-warning)]/40 bg-[var(--yh-warning-subtle)] flex items-center justify-center">
        <ShieldAlert size={10} className="text-[var(--yh-warning)]" />
      </div>
      <span className="text-[11px] font-black uppercase tracking-wider text-[var(--yh-warning)]">Blocked</span>
    </div>
  </div>
)

const SeatLayout = ({ passengers, bookedSeats, onSeatSelect, seatLayout = "2x1" }) => {
  const layoutType = seatLayout.startsWith("2x2") ? "2x2" : "2x1"
  const is2x2 = layoutType === "2x2"
  const DeckComponent = is2x2 ? DeckGrid2x2 : DeckGrid

  return (
    <div className="flex flex-col items-center w-full">
      <SeatLegend />
      <div className="flex flex-col md:flex-row items-start justify-center gap-8 md:gap-16 p-4 overflow-x-auto custom-scrollbar min-h-150 w-full">
        <DeckComponent deck="lower" passengers={passengers} onSeatSelect={onSeatSelect} bookedSeats={bookedSeats} />
        <DeckComponent deck="upper" passengers={passengers} onSeatSelect={onSeatSelect} bookedSeats={bookedSeats} />
      </div>
    </div>
  )
}

/* ── Accessible Token-Based Gender Selector ── */
function GenderSelector({ value, onChange, ariaLabel }) {
  const options = ["Male", "Female"]
  return (
    <div role="group" aria-label={ariaLabel || "Gender"} className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={cn(
              "min-h-11 sm:min-h-10 px-3 rounded-[var(--yh-radius-md)] text-sm font-semibold border transition-colors cursor-pointer",
              active
                ? "bg-brand text-brand-fg border-brand"
                : "bg-surface text-ink-secondary border-border-subtle hover:bg-surface-hover hover:text-ink",
              FOCUS_RING_CLASS,
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

/* ── Shared Summary Breakdown Rows (Desktop Sticky Rail + Mobile Drawer) ── */
function PricingSummaryRows({ summary }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1.5 pb-3 border-b border-border-subtle">
        <div className="flex items-start justify-between gap-2">
          <span className="text-ink-muted">Tour</span>
          <span className="font-semibold text-ink text-right truncate max-w-[180px]">
            {summary.tourName || "Not selected"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-muted">Journey date</span>
          <span className="font-medium text-ink tabular-nums">
            {summary.journeyDate ? formatDisplayDate(summary.journeyDate) : "Not set"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-muted">Travelers &amp; seats</span>
          <span className="font-medium text-ink tabular-nums">
            {summary.passengerCount} PAX · {summary.assignedSeats.length} seated
          </span>
        </div>
        {summary.assignedSeats.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {summary.assignedSeats.map((seat) => (
              <Badge key={seat} variant="primary" size="sm">
                {seat}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5 text-xs sm:text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary">Base amount</span>
          <span className="font-semibold text-ink tabular-nums">
            {formatINR(summary.baseAmount)}
          </span>
        </div>

        {summary.discountAmount > 0 ? (
          <div className="flex items-center justify-between text-success-text">
            <span>
              Discount ({summary.discountType === "percentage" ? `${summary.discountValue}%` : "Flat"})
            </span>
            <span className="font-semibold tabular-nums">
              -{formatINR(summary.discountAmount)}
            </span>
          </div>
        ) : null}

        {summary.gstRate > 0 ? (
          <>
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>Taxable value</span>
              <span className="tabular-nums">{formatINR(summary.netBeforeTax)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-brand">
              <span>CGST ({summary.gstRate / 2}%)</span>
              <span className="tabular-nums">+{formatINR(summary.cgstAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-brand">
              <span>SGST ({summary.gstRate / 2}%)</span>
              <span className="tabular-nums">+{formatINR(summary.sgstAmount)}</span>
            </div>
          </>
        ) : null}

        <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-sm sm:text-base font-bold text-ink">
          <span>Final total</span>
          <span className="tabular-nums">{formatINR(summary.finalTotal)}</span>
        </div>

        <div className="flex items-center justify-between text-success-text">
          <span>Advance received</span>
          <span className="font-semibold tabular-nums">{formatINR(summary.advanceReceived)}</span>
        </div>
      </div>

      <div className="rounded-[var(--yh-radius-md)] bg-brand-soft border border-brand/20 px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-brand">Balance due</span>
        <span className="text-lg font-bold text-brand tabular-nums">
          {formatINR(summary.balanceDue)}
        </span>
      </div>
    </div>
  )
}

export default function BookingForm({ onSave, tours = [], editData, onCancel, bookings = [] }) {
  const { toast } = useToast()
  const isEditMode = Boolean(editData)

  const [formData, setFormData] = useState(() => ({
    id: editData?.id || editData?._id || Date.now().toString(),
    _id: editData?._id || editData?.id,
    invoiceNo: editData?.invoiceNo || "",
    date: toDateInputValue(editData?.date || new Date()),
    contactName: editData?.contactName || "",
    contactPhone: editData?.contactPhone || "",
    contactEmail: editData?.contactEmail || "",
    tourName: editData?.tourName || "",
    journeyDate: toDateInputValue(editData?.journeyDate),
    duration: editData?.duration || "",
    busType: editData?.busType || "",
    paymentMode: editData?.paymentMode || "Cash",
    totalAmount: editData?.totalAmount || 0,
    baseAmount: editData?.baseAmount || editData?.totalAmount || 0,
    advanceReceived: editData?.advanceReceived || 0,
    discount: editData?.discount || 0,
    discountType: editData?.discountType || "fixed",
    gstRate: editData?.gstRate !== undefined ? editData.gstRate : 0,
    isTaxInclusive: Boolean(editData?.isTaxInclusive),
    passengers: editData?.passengers?.length
      ? editData.passengers.map((p) => ({
          name: p.name || "",
          city: p.city || "",
          age: p.age ?? "",
          gender: p.gender || "Male",
          contact: p.contact || "",
          aadhar: p.aadhar || "",
          seatId: p.seatId || "",
          checkedIn: p.checkedIn,
        }))
      : [
          {
            name: "",
            city: "",
            age: "",
            gender: "Male",
            contact: "",
            aadhar: "",
            seatId: "",
          },
        ],
    isFixedPrice: false,
    seatLayout: editData?.busType?.startsWith("2x2") ? "2x2" : "2x1",
  }))

  const [currentStep, setCurrentStep] = useState(0)
  const [maxVisitedStep, setMaxVisitedStep] = useState(isEditMode ? BOOKING_STEPS.length - 1 : 0)
  const [stepAnnouncement, setStepAnnouncement] = useState("")
  const [stepErrors, setStepErrors] = useState({})
  const [stepErrorSummary, setStepErrorSummary] = useState([])
  const [serverError, setServerError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)

  const [showSeatMap, setShowSeatMap] = useState(false)
  const [activePassengerIndex, setActivePassengerIndex] = useState(0)
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false)
  const [deckPreference, setDeckPreference] = useState("any")
  const [tempAssignments, setTempAssignments] = useState([])
  const [customerLookupResult, setCustomerLookupResult] = useState(null)

  useEffect(() => {
    const raw = formData.contactPhone
    if (!raw || raw.length !== 10 || !/^[6-9]/.test(raw)) {
      setCustomerLookupResult(null)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await lookupCustomerByPhone(raw)
        if (res?.found && res?.customer) {
          setCustomerLookupResult(res.customer)
        } else {
          setCustomerLookupResult(null)
        }
      } catch {
        setCustomerLookupResult(null)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [formData.contactPhone])

  const formTopRef = useRef(null)
  const serverErrorRef = useRef(null)

  const pricingBreakdown = useMemo(() => {
    return calculatePricing({
      baseAmount: formData.baseAmount || formData.totalAmount || 0,
      discountType: formData.discountType || "fixed",
      discountValue: formData.discount || 0,
      gstRate: formData.gstRate || 0,
      isTaxInclusive: formData.isTaxInclusive || false,
    })
  }, [
    formData.baseAmount,
    formData.totalAmount,
    formData.discountType,
    formData.discount,
    formData.gstRate,
    formData.isTaxInclusive,
  ])

  const summary = useMemo(
    () => buildBookingSummary(formData, pricingBreakdown),
    [formData, pricingBreakdown],
  )

  const bookedSeats = useMemo(() => {
    if (!formData.tourName || !formData.journeyDate) return []

    const targetDate = toDateInputValue(formData.journeyDate)

    const relevantBookings = bookings.filter((b) => {
      const isSameTour = b.tourName === formData.tourName
      const bookingDate = toDateInputValue(b.journeyDate || b.date)
      const isSameDate = bookingDate === targetDate
      const isNotCurrentBooking =
        b.id !== formData.id &&
        b._id !== formData.id &&
        b.id !== formData._id &&
        b._id !== formData._id
      const isNotCancelled = b.status !== "Cancelled" && b.status !== "cancelled"
      return isSameTour && isSameDate && isNotCurrentBooking && isNotCancelled
    })

    const seats = []
    relevantBookings.forEach((booking) => {
      ;(booking.passengers || []).forEach((passenger) => {
        if (passenger.seatId) {
          seats.push({
            seatId: passenger.seatId,
            passengerName: passenger.name,
            bookingId: booking._id || booking.id,
            invoiceNo: booking.invoiceNo,
          })
        }
      })
    })

    return seats
  }, [formData.tourName, formData.journeyDate, bookings, formData.id, formData._id])

  const clearFieldError = (fieldId) => {
    if (!stepErrors[fieldId]) return
    setStepErrors((prev) => {
      const next = { ...prev }
      delete next[fieldId]
      return next
    })
    setStepErrorSummary((prev) => prev.filter((item) => item.fieldId !== fieldId))
  }

  const focusField = (fieldId) => {
    if (!fieldId) return
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId)
      if (el && typeof el.focus === "function") {
        el.focus()
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    })
  }

  const goToStep = (nextStep) => {
    setCurrentStep(nextStep)
    setMaxVisitedStep((prev) => Math.max(prev, nextStep))
    setStepErrors({})
    setStepErrorSummary([])
    const meta = BOOKING_STEPS[nextStep]
    if (meta) {
      setStepAnnouncement(`Step ${nextStep + 1} of ${BOOKING_STEPS.length}: ${meta.label}`)
    }
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const calculateTotal = (passengers, tourName) => {
    const tour = tours.find((t) => t.name === tourName)
    if (!tour) return 0

    return passengers.reduce((sum, p) => {
      if (tour.pricingType === "fixed" || (tour.fixedPrice && !tour.pricingType)) {
        return sum + (Number(tour.fixedPrice) || 0)
      }
      const isUpper = p.seatId?.startsWith("upper")
      const price = isUpper ? Number(tour.upperPrice) || 0 : Number(tour.lowerPrice) || 0
      return sum + price
    }, 0)
  }

  const handleTourSelect = (tourName) => {
    clearFieldError("tourName")
    if (tourName === "custom") {
      setFormData((prev) => ({ ...prev, tourName: "" }))
      return
    }
    const tour = tours.find((t) => t.name === tourName)
    if (tour) {
      const newTotal = calculateTotal(formData.passengers, tour.name)
      const seatLayoutType = tour.busType?.startsWith("2x2") ? "2x2" : "2x1"
      clearFieldError("busType")
      if (tour.journeyDate) clearFieldError("journeyDate")

      setFormData((prev) => ({
        ...prev,
        tourName: tour.name,
        duration: tour.duration || prev.duration,
        busType: tour.busType || prev.busType,
        journeyDate: tour.journeyDate ? toDateInputValue(tour.journeyDate) : prev.journeyDate,
        totalAmount: newTotal,
        baseAmount: newTotal,
        invoiceNo: editData?.invoiceNo || "",
        isFixedPrice: tour.isFixedPrice,
        seatLayout: seatLayoutType,
      }))
    } else {
      setFormData((prev) => ({ ...prev, tourName }))
    }
  }

  const handleSeatSelection = (seatId) => {
    const updated = formData.passengers.map((p) => ({ ...p }))
    const occupantIdx = updated.findIndex((p) => p.seatId === seatId)
    if (occupantIdx !== -1 && occupantIdx !== activePassengerIndex) return

    updated[activePassengerIndex].seatId =
      updated[activePassengerIndex].seatId === seatId ? "" : seatId

    const newTotal = calculateTotal(updated, formData.tourName)
    clearFieldError(`passenger-${activePassengerIndex}-seat`)
    setFormData((prev) => ({
      ...prev,
      passengers: updated,
      totalAmount: newTotal || prev.totalAmount,
      baseAmount: newTotal || prev.baseAmount,
    }))
  }

  const handleOpenAutoAssign = () => {
    if (!formData.tourName || !formData.journeyDate) {
      toast.error("Please select a tour and journey date first to check seat availability.")
      return
    }

    const { assignments } = autoAssignSeats({
      passengers: formData.passengers,
      bookedSeats,
      deckPreference,
      layout: formData.seatLayout || "2x1",
    })

    if (assignments.length === 0) {
      const allSeated = formData.passengers.every((p) => p.seatId)
      if (allSeated) {
        toast.info("All travelers already have seats assigned!")
      } else {
        toast.error("No free seats found on this coach layout.")
      }
      return
    }

    setTempAssignments(assignments)
    setShowAutoAssignModal(true)
  }

  const handleDeckPreferenceChange = (newPref) => {
    setDeckPreference(newPref)
    const { assignments } = autoAssignSeats({
      passengers: formData.passengers,
      bookedSeats,
      deckPreference: newPref,
      layout: formData.seatLayout || "2x1",
    })
    setTempAssignments(assignments)
  }

  const handleApplyAutoAssign = () => {
    const updated = formData.passengers.map((p) => ({ ...p }))
    tempAssignments.forEach(({ passengerIndex, proposedSeatId }) => {
      if (updated[passengerIndex]) {
        updated[passengerIndex] = {
          ...updated[passengerIndex],
          seatId: proposedSeatId,
        }
        clearFieldError(`passenger-${passengerIndex}-seat`)
      }
    })

    const newTotal = calculateTotal(updated, formData.tourName)
    setFormData((prev) => ({
      ...prev,
      passengers: updated,
      totalAmount: newTotal || prev.totalAmount,
      baseAmount: newTotal || prev.baseAmount,
    }))

    setShowAutoAssignModal(false)
    toast.success(`Assigned ${tempAssignments.length} seats successfully!`)
  }

  const addPassenger = () => {
    setFormData((prev) => ({
      ...prev,
      passengers: [
        ...prev.passengers,
        {
          name: "",
          city: "",
          age: "",
          gender: "Male",
          contact: "",
          aadhar: "",
          seatId: "",
        },
      ],
    }))
  }

  const removePassenger = (index) => {
    if (formData.passengers.length > 1) {
      const updated = formData.passengers.filter((_, i) => i !== index)
      setActivePassengerIndex((prev) => Math.min(prev, updated.length - 1))
      setFormData((prev) => ({ ...prev, passengers: updated }))
      setStepErrors({})
      setStepErrorSummary([])
    }
  }

  const updatePassenger = (index, field, value) => {
    const updated = formData.passengers.map((p, idx) =>
      idx === index ? { ...p, [field]: value } : p,
    )
    clearFieldError(`passenger-${index}-${field}`)
    setFormData((prev) => ({ ...prev, passengers: updated }))
  }

  const handleNextStep = () => {
    const validation = validateBookingStep(currentStep, formData, {
      pricingBreakdown,
      bookedSeats,
    })

    if (!validation.valid) {
      setStepErrors(validation.errors)
      setStepErrorSummary(validation.summary)
      if (validation.summary[0]?.fieldId) {
        focusField(validation.summary[0].fieldId)
      }
      return
    }

    setServerError("")
    goToStep(Math.min(BOOKING_STEPS.length - 1, currentStep + 1))
  }

  const handleBackStep = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1)
    } else if (onCancel) {
      onCancel()
    }
  }

  const handleStepSelect = (targetStep) => {
    if (!canNavigateToStep(targetStep, { currentStep, maxVisitedStep, isEditMode })) {
      return
    }
    if (targetStep > currentStep) {
      const validation = validateBookingStep(currentStep, formData, {
        pricingBreakdown,
        bookedSeats,
      })
      if (!validation.valid) {
        setStepErrors(validation.errors)
        setStepErrorSummary(validation.summary)
        if (validation.summary[0]?.fieldId) {
          focusField(validation.summary[0].fieldId)
        }
        return
      }
    }
    goToStep(targetStep)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // On steps 0–2, submitting (e.g. pressing Enter) advances through step validation cleanly
    if (currentStep < BOOKING_STEPS.length - 1) {
      handleNextStep()
      return
    }

    // Full validation across all steps before saving (no validation rule weakened)
    const fullCheck = validateAllBookingSteps(formData, {
      pricingBreakdown,
      bookedSeats,
    })

    if (!fullCheck.valid) {
      const targetStep = fullCheck.firstInvalidStep >= 0 ? fullCheck.firstInvalidStep : 0
      const stepRes = validateBookingStep(targetStep, formData, {
        pricingBreakdown,
        bookedSeats,
      })
      setCurrentStep(targetStep)
      setStepErrors(stepRes.errors)
      setStepErrorSummary(stepRes.summary)
      toast.error(stepRes.summary[0]?.message || "Please fix the highlighted fields before saving")
      if (stepRes.summary[0]?.fieldId) {
        focusField(stepRes.summary[0].fieldId)
      }
      return
    }

    const finalData = {
      ...formData,
      totalAmount: pricingBreakdown.finalTotal,
      baseAmount: pricingBreakdown.baseAmount,
      discount: pricingBreakdown.discountAmount,
      discountType: formData.discountType,
      gstRate: pricingBreakdown.gstRate,
      taxAmount: pricingBreakdown.taxAmount,
      isTaxInclusive: pricingBreakdown.isTaxInclusive,
      passengers: (formData.passengers || []).map((p) => {
        if (isMaskedAadhaar(p.aadhar)) {
          return { ...p, aadhar: "[UNCHANGED]" }
        }
        return p
      }),
    }

    setServerError("")
    setIsSubmitting(true)
    try {
      const result = await onSave(finalData)
      if (result && result.ok === false) {
        setServerError(formatServerBookingError(result))
        requestAnimationFrame(() => {
          serverErrorRef.current?.focus()
          serverErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
        })
      }
    } catch (err) {
      setServerError(formatServerBookingError(err))
      requestAnimationFrame(() => {
        serverErrorRef.current?.focus()
        serverErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedTourOptionValue = tours.some((t) => t.name === formData.tourName)
    ? formData.tourName
    : formData.tourName
      ? "custom"
      : ""

  return (
    <form
      ref={formTopRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6 pb-28 lg:pb-8"
    >
      {/* Screen reader announcement for step changes */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {stepAnnouncement}
      </div>

      {/* Top Navigation & Edit Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={onCancel}
        >
          Back to Overview
        </Button>

        {isEditMode && formData.invoiceNo ? (
          <Badge variant="primary" size="md">
            Editing Invoice #{formData.invoiceNo}
          </Badge>
        ) : null}
      </div>

      {/* Accessible Numbered Step Indicator */}
      <nav aria-label="Booking progress">
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {BOOKING_STEPS.map((step) => {
            const isActive = currentStep === step.id
            const isCompleted = step.id < currentStep || (isEditMode && step.id !== currentStep)
            const clickable = canNavigateToStep(step.id, {
              currentStep,
              maxVisitedStep,
              isEditMode,
            })

            return (
              <li key={step.key}>
                <button
                  type="button"
                  disabled={!clickable && !isActive}
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => clickable && handleStepSelect(step.id)}
                  className={cn(
                    "w-full min-h-11 px-3 py-2.5 rounded-[var(--yh-radius-md)] border text-left flex items-center gap-2.5 transition-colors",
                    isActive
                      ? "bg-brand-soft border-brand text-brand font-semibold"
                      : isCompleted
                        ? "bg-surface border-border-subtle text-ink hover:bg-surface-hover cursor-pointer"
                        : "bg-surface-muted/60 border-border-subtle text-ink-muted cursor-not-allowed",
                    FOCUS_RING_CLASS,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                      isActive
                        ? "bg-brand text-brand-fg"
                        : isCompleted
                          ? "bg-success-soft text-success-text"
                          : "bg-surface-muted text-ink-muted border border-border-subtle",
                    )}
                  >
                    {isCompleted && !isActive ? <Check size={13} strokeWidth={2.75} /> : step.id + 1}
                  </span>
                  <span className="text-xs sm:text-sm font-medium truncate" title={step.label}>
                    <span className="inline lg:hidden">{step.shortLabel}</span>
                    <span className="hidden lg:inline">{step.label}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Server Validation Error Banner (HTTP 400 / 409) */}
      {serverError ? (
        <div
          ref={serverErrorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[var(--yh-radius-lg)] bg-danger-soft border border-danger/30 px-4 py-3.5 text-danger-text flex items-start justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-focus-ring"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm space-y-0.5">
              <p className="font-semibold">Booking could not be saved</p>
              <p className="text-xs sm:text-sm">{serverError}</p>
            </div>
          </div>
          <IconButton
            aria-label="Dismiss error message"
            variant="ghost"
            size="sm"
            onClick={() => setServerError("")}
            className="text-danger-text hover:bg-danger/10 shrink-0"
          >
            <X size={16} />
          </IconButton>
        </div>
      ) : null}

      {/* Per-Step Validation Error Summary */}
      {stepErrorSummary.length > 0 ? (
        <div
          role="alert"
          className="rounded-[var(--yh-radius-lg)] bg-danger-soft border border-danger/30 px-4 py-3.5 text-danger-text space-y-1.5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle size={16} aria-hidden="true" />
            <span>
              Please fix {stepErrorSummary.length}{" "}
              {stepErrorSummary.length === 1 ? "issue" : "issues"} before continuing:
            </span>
          </div>
          <ul className="list-disc pl-6 text-xs sm:text-sm space-y-1">
            {stepErrorSummary.map((item) => (
              <li key={item.fieldId}>
                <button
                  type="button"
                  onClick={() => focusField(item.fieldId)}
                  className="underline text-left hover:opacity-80 cursor-pointer"
                >
                  {item.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Main Grid: Active Step Content + Sticky Desktop Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {/* ── STEP 1: Tour, Date & Primary Contact ── */}
          {currentStep === 0 ? (
            <>
              <Card elevation="sm" padding="lg" className="space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--yh-radius-md)] bg-accent-warm-soft text-accent-warm-text"
                  >
                    <Bus size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-ink">Tour &amp; Departure</h2>
                    <p className="text-xs text-ink-muted">
                      Choose a saved destination package or enter custom tour details
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    id="tourSelect"
                    label="Quick tour selection"
                    hint="Pre-fills bus layout, date, and berth pricing"
                    className="sm:col-span-2"
                  >
                    {({ id, describedBy }) => (
                      <Select
                        id={id}
                        aria-describedby={describedBy}
                        value={selectedTourOptionValue}
                        onChange={(e) => handleTourSelect(e.target.value)}
                      >
                        <option value="">Select a pre-defined tour...</option>
                        {tours.map((t) => (
                          <option key={t._id || t.id || t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                        <option value="custom">+ Manual Entry</option>
                      </Select>
                    )}
                  </Field>

                  <Field
                    id="tourName"
                    label="Tour destination name"
                    required
                    error={stepErrors.tourName}
                    className="sm:col-span-2"
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        type="text"
                        placeholder="e.g. Char Dham Yatra Special"
                        value={formData.tourName}
                        invalid={invalid}
                        aria-describedby={describedBy}
                        onChange={(e) => {
                          clearFieldError("tourName")
                          setFormData((prev) => ({ ...prev, tourName: e.target.value }))
                        }}
                      />
                    )}
                  </Field>

                  <Field
                    id="journeyDate"
                    label="Journey date"
                    required
                    error={stepErrors.journeyDate}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        type="date"
                        leading={<Calendar size={16} />}
                        value={formData.journeyDate}
                        invalid={invalid}
                        aria-describedby={describedBy}
                        onChange={(e) => {
                          clearFieldError("journeyDate")
                          setFormData((prev) => ({ ...prev, journeyDate: e.target.value }))
                        }}
                      />
                    )}
                  </Field>

                  <Field
                    id="busType"
                    label="Bus arrangement"
                    required
                    error={stepErrors.busType}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Select
                        id={id}
                        value={formData.busType}
                        invalid={invalid}
                        aria-describedby={describedBy}
                        onChange={(e) => {
                          const busType = e.target.value
                          const layoutType = busType.startsWith("2x2") ? "2x2" : "2x1"
                          clearFieldError("busType")
                          setFormData((prev) => ({ ...prev, busType, seatLayout: layoutType }))
                        }}
                      >
                        <option value="">Select bus type...</option>
                        <option value="2x1 Sleeper Luxury">2x1 Sleeper Luxury (36 berths)</option>
                        <option value="2x2 Sleeper Luxury">2x2 Sleeper Luxury (40 berths)</option>
                      </Select>
                    )}
                  </Field>
                </div>
              </Card>

              <Card elevation="sm" padding="lg" className="space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--yh-radius-md)] bg-brand-soft text-brand"
                  >
                    <Building size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-ink">Primary Contact</h2>
                    <p className="text-xs text-ink-muted">
                      Used on the invoice, boarding passes, and WhatsApp payment reminders
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    id="contactName"
                    label="Primary traveler name"
                    required
                    error={stepErrors.contactName}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        type="text"
                        placeholder="Full name as per ID"
                        value={formData.contactName}
                        invalid={invalid}
                        aria-describedby={describedBy}
                        onChange={(e) => {
                          clearFieldError("contactName")
                          setFormData((prev) => ({ ...prev, contactName: e.target.value }))
                        }}
                      />
                    )}
                  </Field>

                  <Field
                    id="contactPhone"
                    label="Mobile number"
                    required
                    error={stepErrors.contactPhone}
                    hint="10-digit Indian mobile number"
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        type="tel"
                        inputMode="numeric"
                        tabular
                        placeholder="+91 98765 43210"
                        value={formData.contactPhone ? `+91 ${formData.contactPhone}` : ""}
                        invalid={invalid}
                        aria-describedby={describedBy}
                        onChange={(e) => {
                          const value = e.target.value
                            .replace(/^\+91\s*/, "")
                            .replace(/\D/g, "")
                            .slice(0, 10)
                          clearFieldError("contactPhone")
                          setFormData((prev) => ({ ...prev, contactPhone: value }))
                        }}
                      />
                    )}
                  </Field>

                  {customerLookupResult && (
                    <div
                      role="status"
                      className="sm:col-span-2 p-3 rounded-[var(--yh-radius-md)] bg-brand-soft border border-brand/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 text-ink">
                        <Users className="w-4 h-4 text-brand shrink-0" />
                        <span>
                          Existing customer found: <strong className="font-bold">{customerLookupResult.name}</strong>
                          {customerLookupResult.city ? ` (${customerLookupResult.city})` : ""}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setFormData((prev) => {
                            const next = {
                              ...prev,
                              contactName: customerLookupResult.name,
                              contactEmail: customerLookupResult.email || prev.contactEmail,
                            }
                            if (customerLookupResult.city && prev.passengers?.length > 0 && !prev.passengers[0].city) {
                              const updatedPax = [...prev.passengers]
                              updatedPax[0] = { ...updatedPax[0], city: customerLookupResult.city }
                              next.passengers = updatedPax
                            }
                            return next
                          })
                          clearFieldError("contactName")
                          setCustomerLookupResult(null)
                        }}
                      >
                        Use customer details
                      </Button>
                    </div>
                  )}

                  <Field
                    id="contactEmail"
                    label="Email address (optional)"
                    className="sm:col-span-2"
                  >
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        type="email"
                        placeholder="traveler@example.com"
                        value={formData.contactEmail}
                        aria-describedby={describedBy}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))
                        }
                      />
                    )}
                  </Field>
                </div>
              </Card>
            </>
          ) : null}

          {/* ── STEP 2: Passengers & Seats ── */}
          {currentStep === 1 ? (
            <Card elevation="sm" padding="lg" className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--yh-radius-md)] bg-brand-soft text-brand"
                  >
                    <Users size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-ink">
                      Passengers &amp; Coach Seats ({formData.passengers.length})
                    </h2>
                    <p className="text-xs text-ink-muted">
                      Add traveler details and assign sleeper berths from the coach map
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Wand2 size={15} />}
                    onClick={handleOpenAutoAssign}
                  >
                    Auto-assign Seats
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    leftIcon={<UserPlus size={15} />}
                    onClick={addPassenger}
                  >
                    Add Passenger
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {formData.passengers.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-[var(--yh-radius-lg)] bg-surface-muted/50 border border-border-subtle p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="primary" size="md">
                          Passenger #{i + 1}
                        </Badge>
                        {p.seatId ? (
                          <Badge variant="success" size="md">
                            Seat {p.seatId}
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            No seat assigned
                          </Badge>
                        )}
                      </div>

                      {formData.passengers.length > 1 ? (
                        <IconButton
                          aria-label={`Remove passenger ${i + 1}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => removePassenger(i)}
                          className="text-danger-text hover:bg-danger-soft"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field
                        id={`passenger-${i}-name`}
                        label="Full name"
                        required
                        error={stepErrors[`passenger-${i}-name`]}
                      >
                        {({ id, describedBy, invalid }) => (
                          <Input
                            id={id}
                            type="text"
                            placeholder="Passenger name"
                            value={p.name}
                            invalid={invalid}
                            aria-describedby={describedBy}
                            onChange={(e) => updatePassenger(i, "name", e.target.value)}
                          />
                        )}
                      </Field>

                      <Field
                        id={`passenger-${i}-city`}
                        label="City / Boarding point"
                        required
                        error={stepErrors[`passenger-${i}-city`]}
                      >
                        {({ id, describedBy, invalid }) => (
                          <Input
                            id={id}
                            type="text"
                            placeholder="e.g. Surat, Ahmedabad"
                            value={p.city}
                            invalid={invalid}
                            aria-describedby={describedBy}
                            onChange={(e) => updatePassenger(i, "city", e.target.value)}
                          />
                        )}
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                      <Field
                        id={`passenger-${i}-age`}
                        label="Age"
                        required
                        error={stepErrors[`passenger-${i}-age`]}
                      >
                        {({ id, describedBy, invalid }) => (
                          <Input
                            id={id}
                            type="number"
                            inputMode="numeric"
                            tabular
                            min={1}
                            max={120}
                            placeholder="e.g. 42"
                            value={p.age}
                            invalid={invalid}
                            aria-describedby={describedBy}
                            onChange={(e) => updatePassenger(i, "age", e.target.value)}
                          />
                        )}
                      </Field>

                      <Field label="Gender">
                        <GenderSelector
                          value={p.gender}
                          ariaLabel={`Passenger ${i + 1} gender`}
                          onChange={(val) => updatePassenger(i, "gender", val)}
                        />
                      </Field>

                      <Field
                        id={`passenger-${i}-seat`}
                        label="Coach berth"
                        error={stepErrors[`passenger-${i}-seat`]}
                      >
                        <Button
                          id={`passenger-${i}-seat`}
                          type="button"
                          variant={p.seatId ? "secondary" : "outline"}
                          size="md"
                          fullWidth
                          leftIcon={<Layout size={15} />}
                          onClick={() => {
                            setActivePassengerIndex(i)
                            setShowSeatMap(true)
                          }}
                        >
                          {p.seatId ? `Seat ${p.seatId}` : "Select seat from coach layout"}
                        </Button>
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border-subtle">
                      <Field
                        id={`passenger-${i}-contact`}
                        label="Internal contact (admin only)"
                      >
                        {({ id }) => (
                          <Input
                            id={id}
                            type="tel"
                            inputMode="numeric"
                            tabular
                            placeholder="+91 98765 43210"
                            value={p.contact ? `+91 ${p.contact}` : ""}
                            onChange={(e) => {
                              const value = e.target.value
                                .replace(/^\+91\s*/, "")
                                .replace(/\D/g, "")
                                .slice(0, 10)
                              updatePassenger(i, "contact", value)
                            }}
                          />
                        )}
                      </Field>

                      <Field
                        id={`passenger-${i}-aadhar`}
                        label="Aadhaar number (optional, encrypted at rest)"
                        error={stepErrors[`passenger-${i}-aadhar`]}
                        hint={
                          isMaskedAadhaar(p.aadhar)
                            ? "Aadhaar encrypted on file. Click 'Change' to enter a new 12-digit number."
                            : "12-digit number; displayed masked after saving"
                        }
                      >
                        {({ id, describedBy, invalid }) =>
                          isMaskedAadhaar(p.aadhar) ? (
                            <div className="flex items-center gap-2">
                              <div
                                id={id}
                                aria-describedby={describedBy}
                                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[var(--yh-radius-md)] border border-border-subtle bg-surface-muted text-ink font-mono text-sm select-none"
                              >
                                <LockKeyhole size={14} className="text-ink-muted shrink-0" aria-hidden="true" />
                                <span>{p.aadhar}</span>
                                <Badge variant="neutral" size="sm" className="ml-auto">
                                  Saved
                                </Badge>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => updatePassenger(i, "aadhar", "")}
                                aria-label={`Change Aadhaar for passenger ${i + 1}`}
                              >
                                Change
                              </Button>
                            </div>
                          ) : (
                            <Input
                              id={id}
                              type="text"
                              inputMode="numeric"
                              tabular
                              placeholder="XXXX XXXX XXXX"
                              maxLength={14}
                              invalid={invalid}
                              aria-describedby={describedBy}
                              value={p.aadhar ? p.aadhar.replace(/(\d{4})(?=\d)/g, "$1 ") : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, "").slice(0, 12)
                                updatePassenger(i, "aadhar", raw)
                              }}
                            />
                          )
                        }
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {/* ── STEP 3: Pricing & Payment ── */}
          {currentStep === 2 ? (
            <Card elevation="sm" padding="lg" className="space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
                <span
                  aria-hidden="true"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--yh-radius-md)] bg-success-soft text-success-text"
                >
                  <CreditCard size={18} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-ink">Pricing &amp; Advance Payment</h2>
                  <p className="text-xs text-ink-muted">
                    Review fare, apply discounts or GST, and record initial payment
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  id="baseAmount"
                  label="Base package cost (₹)"
                  required
                  error={stepErrors.baseAmount}
                >
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      tabular
                      min={0}
                      placeholder="0"
                      value={formData.baseAmount || ""}
                      invalid={invalid}
                      aria-describedby={describedBy}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0
                        clearFieldError("baseAmount")
                        clearFieldError("advanceReceived")
                        setFormData((prev) => ({
                          ...prev,
                          baseAmount: val,
                          totalAmount: val,
                        }))
                      }}
                    />
                  )}
                </Field>

                <Field id="paymentMode" label="Payment mode">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={formData.paymentMode}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, paymentMode: e.target.value }))
                      }
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Card">Card</option>
                    </Select>
                  )}
                </Field>
              </div>

              {/* Discount Card */}
              <div className="rounded-[var(--yh-radius-md)] bg-surface-muted/60 border border-border-subtle p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-secondary">Discount</span>
                  <div
                    role="group"
                    aria-label="Discount type"
                    className="inline-flex rounded-[var(--yh-radius-sm)] bg-surface p-0.5 border border-border-subtle"
                  >
                    <button
                      type="button"
                      aria-pressed={formData.discountType === "fixed"}
                      onClick={() => {
                        clearFieldError("discount")
                        setFormData((prev) => ({ ...prev, discountType: "fixed" }))
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-[var(--yh-radius-xs)] transition-colors cursor-pointer",
                        formData.discountType === "fixed"
                          ? "bg-brand text-brand-fg"
                          : "text-ink-secondary hover:text-ink",
                        FOCUS_RING_CLASS,
                      )}
                    >
                      ₹ Flat
                    </button>
                    <button
                      type="button"
                      aria-pressed={formData.discountType === "percentage"}
                      onClick={() => {
                        clearFieldError("discount")
                        setFormData((prev) => ({ ...prev, discountType: "percentage" }))
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-[var(--yh-radius-xs)] transition-colors cursor-pointer",
                        formData.discountType === "percentage"
                          ? "bg-brand text-brand-fg"
                          : "text-ink-secondary hover:text-ink",
                        FOCUS_RING_CLASS,
                      )}
                    >
                      % Percent
                    </button>
                  </div>
                </div>

                <Field id="discount" error={stepErrors.discount}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      tabular
                      min={0}
                      max={formData.discountType === "percentage" ? 100 : undefined}
                      placeholder={
                        formData.discountType === "percentage" ? "e.g. 10" : "e.g. 500"
                      }
                      value={formData.discount || ""}
                      invalid={invalid}
                      aria-describedby={describedBy}
                      onChange={(e) => {
                        clearFieldError("discount")
                        clearFieldError("advanceReceived")
                        setFormData((prev) => ({
                          ...prev,
                          discount: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }}
                    />
                  )}
                </Field>
              </div>

              {/* GST Configuration */}
              <div className="rounded-[var(--yh-radius-md)] bg-surface-muted/60 border border-border-subtle p-4 space-y-3">
                <Field id="gstRate" label="GST / Tax rate">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={formData.gstRate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          gstRate: Number(e.target.value) || 0,
                        }))
                      }
                    >
                      <option value={0}>0% (Tax Exempt)</option>
                      <option value={5}>5% (Bus Tour Standard)</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                    </Select>
                  )}
                </Field>

                {formData.gstRate > 0 ? (
                  <Checkbox
                    id="isTaxInclusive"
                    checked={formData.isTaxInclusive}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, isTaxInclusive: e.target.checked }))
                    }
                    label="Price already includes GST (tax-inclusive)"
                    description="CGST and SGST will be back-calculated from the agreed package total"
                  />
                ) : null}
              </div>

              {/* Advance Received */}
              <Field
                id="advanceReceived"
                label="Advance received (₹)"
                error={stepErrors.advanceReceived}
                hint={`Maximum allowed: ${formatINR(pricingBreakdown.finalTotal)}`}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    tabular
                    min={0}
                    placeholder="0"
                    value={formData.advanceReceived || ""}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    onChange={(e) => {
                      clearFieldError("advanceReceived")
                      setFormData((prev) => ({
                        ...prev,
                        advanceReceived: Number(e.target.value) || 0,
                      }))
                    }}
                  />
                )}
              </Field>
            </Card>
          ) : null}

          {/* ── STEP 4: Read-Only Review Before Saving ── */}
          {currentStep === 3 ? (
            <div className="space-y-4">
              {/* Review Section 1: Tour & Contact */}
              <Card elevation="sm" padding="md" className="space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <Bus size={16} className="text-brand" aria-hidden="true" />
                    <h2 className="text-sm sm:text-base font-semibold text-ink">
                      Tour &amp; Primary Contact
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leftIcon={<Edit3 size={14} />}
                    onClick={() => goToStep(0)}
                  >
                    Edit
                  </Button>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-muted">Tour destination</dt>
                    <dd className="font-semibold text-ink mt-0.5">{formData.tourName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Journey date</dt>
                    <dd className="font-semibold text-ink tabular-nums mt-0.5">
                      {formData.journeyDate ? formatDisplayDate(formData.journeyDate) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Bus arrangement</dt>
                    <dd className="font-medium text-ink mt-0.5">{formData.busType || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Primary contact</dt>
                    <dd className="font-semibold text-ink mt-0.5">
                      {formData.contactName || "—"}
                      <span className="block text-xs font-normal text-ink-muted tabular-nums">
                        +91 {formData.contactPhone}
                        {formData.contactEmail ? ` · ${formData.contactEmail}` : ""}
                      </span>
                    </dd>
                  </div>
                </dl>
              </Card>

              {/* Review Section 2: Passengers & Seats */}
              <Card elevation="sm" padding="md" className="space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-brand" aria-hidden="true" />
                    <h2 className="text-sm sm:text-base font-semibold text-ink">
                      Passengers &amp; Seats ({formData.passengers.length})
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leftIcon={<Edit3 size={14} />}
                    onClick={() => goToStep(1)}
                  >
                    Edit
                  </Button>
                </div>

                <ul className="divide-y divide-border-subtle">
                  {formData.passengers.map((p, idx) => (
                    <li
                      key={idx}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">
                          {idx + 1}. {p.name}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {p.gender} · {p.age} yrs · {p.city}
                          {p.aadhar && p.aadhar !== "[UNCHANGED]" ? ` · Aadhaar: ${maskAadhaar(p.aadhar)}` : p.aadhar === "[UNCHANGED]" ? " · Aadhaar: (on file)" : ""}
                        </p>
                      </div>
                      <Badge variant={p.seatId ? "success" : "neutral"} size="sm" className="self-start sm:self-center">
                        {p.seatId ? `Seat ${p.seatId}` : "Unassigned"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Review Section 3: Pricing & Payment */}
              <Card elevation="sm" padding="md" className="space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-brand" aria-hidden="true" />
                    <h2 className="text-sm sm:text-base font-semibold text-ink">
                      Pricing &amp; Payment
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leftIcon={<Edit3 size={14} />}
                    onClick={() => goToStep(2)}
                  >
                    Edit
                  </Button>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Payment mode</span>
                    <span className="font-semibold text-ink">{summary.paymentMode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Base package amount</span>
                    <span className="font-semibold text-ink tabular-nums">
                      {formatINR(summary.baseAmount)}
                    </span>
                  </div>
                  {summary.discountAmount > 0 ? (
                    <div className="flex justify-between text-success-text">
                      <span>Discount</span>
                      <span className="font-semibold tabular-nums">
                        -{formatINR(summary.discountAmount)}
                      </span>
                    </div>
                  ) : null}
                  {summary.gstRate > 0 ? (
                    <div className="flex justify-between text-brand">
                      <span>
                        GST ({summary.gstRate}% {summary.isTaxInclusive ? "inclusive" : "exclusive"})
                      </span>
                      <span className="font-semibold tabular-nums">
                        +{formatINR(summary.taxAmount)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-2 border-t border-border-subtle font-bold text-ink">
                    <span>Final total</span>
                    <span className="tabular-nums">{formatINR(summary.finalTotal)}</span>
                  </div>
                  <div className="flex justify-between text-success-text">
                    <span>Advance received</span>
                    <span className="font-semibold tabular-nums">
                      {formatINR(summary.advanceReceived)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-brand">
                    <span>Balance due</span>
                    <span className="tabular-nums">{formatINR(summary.balanceDue)}</span>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {/* Desktop Footer Navigation Controls */}
          <Card elevation="sm" padding="md" className="hidden lg:flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft size={16} />}
              onClick={handleBackStep}
            >
              {currentStep === 0 ? "Cancel" : "Back"}
            </Button>

            <span className="text-xs font-medium text-ink-muted tabular-nums">
              Step {currentStep + 1} of {BOOKING_STEPS.length}
            </span>

            {currentStep < BOOKING_STEPS.length - 1 ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                rightIcon={<ArrowRight size={16} />}
                onClick={handleNextStep}
              >
                Next: {BOOKING_STEPS[currentStep + 1].shortLabel}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="accent"
                size="md"
                loading={isSubmitting}
                leftIcon={<Save size={16} />}
              >
                {isEditMode ? "Update Booking" : "Confirm Booking"}
              </Button>
            )}
          </Card>
        </div>

        {/* Desktop Sticky Summary Column (lg and up) */}
        <aside className="hidden lg:block lg:col-span-4 lg:sticky lg:top-20 self-start">
          <Card elevation="sm" padding="lg" className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border-subtle">
              <h2 className="text-sm font-semibold text-ink">Booking Summary</h2>
              <Badge variant="neutral" size="sm">
                Live estimate
              </Badge>
            </div>
            <PricingSummaryRows summary={summary} />
          </Card>
        </aside>
      </div>

      {/* Mobile Sticky Collapsible Summary + Step Actions Footer (<lg) */}
      <div className="lg:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[var(--yh-z-sticky)] bg-surface-elevated border-t border-border-subtle shadow-[var(--yh-shadow-lg)]">
        {mobileSummaryOpen ? (
          <div className="px-4 py-3 border-b border-border-subtle max-h-64 overflow-y-auto bg-surface">
            <PricingSummaryRows summary={summary} />
          </div>
        ) : null}

        <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between gap-2">
          <button
            type="button"
            aria-expanded={mobileSummaryOpen}
            onClick={() => setMobileSummaryOpen((prev) => !prev)}
            className={cn(
              "flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer py-1",
              FOCUS_RING_CLASS,
            )}
          >
            <span>Total:</span>
            <span className="font-bold tabular-nums">{formatINR(summary.finalTotal)}</span>
            <span className="text-ink-muted">·</span>
            <span className="text-brand tabular-nums">Due {formatINR(summary.balanceDue)}</span>
            {mobileSummaryOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          <span className="text-xs text-ink-muted tabular-nums">
            Step {currentStep + 1}/{BOOKING_STEPS.length}
          </span>
        </div>

        <div className="px-4 py-2.5 flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="md"
            leftIcon={<ArrowLeft size={15} />}
            onClick={handleBackStep}
            className="shrink-0"
          >
            {currentStep === 0 ? "Cancel" : "Back"}
          </Button>

          {currentStep < BOOKING_STEPS.length - 1 ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight size={15} />}
              onClick={handleNextStep}
            >
              Next: {BOOKING_STEPS[currentStep + 1].shortLabel}
            </Button>
          ) : (
            <Button
              type="submit"
              variant="accent"
              size="md"
              fullWidth
              loading={isSubmitting}
              leftIcon={<Save size={15} />}
            >
              {isEditMode ? "Update Booking" : "Confirm Booking"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Coach Seat Picker Modal (Migrated to Modal primitive) ── */}
      <Modal
        open={showSeatMap}
        onClose={() => setShowSeatMap(false)}
        size="5xl"
        title="Choose Seat"
        description={`Assigning seat for: ${
          formData.passengers[activePassengerIndex]?.name ||
          "Passenger " + (activePassengerIndex + 1)
        }`}
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={handleOpenAutoAssign}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--yh-brand-subtle)] text-[var(--yh-brand)] hover:bg-[var(--yh-brand)]/15 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Wand2 size={15} /> Auto-assign Seats
            </button>
            <Button
              type="button"
              onClick={() => setShowSeatMap(false)}
              variant="primary"
            >
              Confirm Selection
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {bookedSeats.length > 0 && (
            <p className="text-[11px] font-bold text-[var(--yh-danger)] uppercase tracking-wide flex items-center gap-1.5 bg-[var(--yh-danger-subtle)] px-3 py-1.5 rounded-full w-fit">
              <LockKeyhole size={12} /> {bookedSeats.length} seats already booked
            </p>
          )}
          <div className="overflow-y-auto custom-scrollbar p-2">
            <SeatLayout
              passengers={formData.passengers}
              bookedSeats={bookedSeats}
              onSeatSelect={handleSeatSelection}
              seatLayout={formData.seatLayout || "2x1"}
            />
          </div>
        </div>
      </Modal>

      {/* ── Accessible Auto-Assign Seats Modal (Part 3.4) ── */}
      <Modal
        isOpen={showAutoAssignModal}
        onClose={() => setShowAutoAssignModal(false)}
        size="md"
        title={
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[var(--yh-radius-md)] bg-brand-soft text-brand shrink-0">
              <Wand2 size={18} />
            </div>
            <div>
              <span className="text-base font-bold text-ink">Auto-assign Seats</span>
              <p className="text-xs text-ink-muted font-normal mt-0.5">
                Proposing {tempAssignments.length} nearby seats
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
              onClick={() => setShowAutoAssignModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleApplyAutoAssign}
            >
              Apply Assignments
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-ink-secondary">
              Deck Preference
            </span>
            <div role="group" aria-label="Deck preference" className="grid grid-cols-3 gap-2">
              {[
                { id: "any", label: "Any Deck" },
                { id: "lower", label: "Lower Deck" },
                { id: "upper", label: "Upper Deck" },
              ].map((deck) => (
                <button
                  key={deck.id}
                  type="button"
                  aria-pressed={deckPreference === deck.id}
                  onClick={() => handleDeckPreferenceChange(deck.id)}
                  className={cn(
                    "py-2 px-3 rounded-[var(--yh-radius-md)] text-xs font-semibold border transition-colors cursor-pointer min-h-10",
                    deckPreference === deck.id
                      ? "bg-brand text-brand-fg border-brand"
                      : "bg-surface text-ink-secondary border-border-subtle hover:bg-surface-hover hover:text-ink",
                    FOCUS_RING_CLASS,
                  )}
                >
                  {deck.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {tempAssignments.map((assign, idx) => (
              <div
                key={assign.passengerIndex}
                className="p-3 bg-surface-muted/60 rounded-[var(--yh-radius-md)] border border-border-subtle flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">
                    {assign.passengerName}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    Passenger #{assign.passengerIndex + 1}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-ink-muted font-medium">Assigned:</span>
                  <input
                    type="text"
                    aria-label={`Assigned seat for ${assign.passengerName || `Passenger #${assign.passengerIndex + 1}`}`}
                    value={assign.proposedSeatId}
                    onChange={(e) => {
                      const val = e.target.value.trim()
                      const updated = [...tempAssignments]
                      updated[idx].proposedSeatId = val
                      setTempAssignments(updated)
                    }}
                    className={cn(
                      "w-28 px-2.5 py-1.5 bg-surface border border-border-strong rounded-[var(--yh-radius-sm)] text-xs font-mono font-bold text-brand text-center uppercase tabular-nums",
                      FOCUS_RING_CLASS,
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </form>
  )
}
