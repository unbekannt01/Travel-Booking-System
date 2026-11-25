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
  MapPin,
} from "lucide-react"
import { useToast } from "./common/ToastContext"
import { toDateInputValue, formatDisplayDate } from "../utils/date"
import { calculatePricing } from "../utils/pricing"
import { autoAssignSeats } from "../utils/seatAssignment"
import { formatINR, maskAadhaar, formatSeatLabel } from "../utils/formatters"
import { isMaskedAadhaar } from "../utils/validators"
import { lookupCustomerByPhone } from "../data/customers"
import { cn } from "../utils/cn"
import { getAuthToken } from "../data/adapters/rest"
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
import SeatMap from "./seats/SeatMap"
import { getSeatLayout, layoutKeyForBusType, resolveSeatId, STANDARD_BUS_TYPES } from "../../shared/seatLayouts"

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
  const isEditMode = Boolean(editData && !editData.isNewFromSeatMap)

  const [formData, setFormData] = useState(() => ({
    id: editData?.isNewFromSeatMap ? Date.now().toString() : (editData?.id || editData?._id || Date.now().toString()),
    _id: editData?.isNewFromSeatMap ? null : (editData?._id || editData?.id),
    invoiceNo: editData?.isNewFromSeatMap ? "" : (editData?.invoiceNo || ""),
    date: toDateInputValue(editData?.date || new Date()),
    contactName: editData?.contactName || "",
    contactPhone: editData?.contactPhone || "",
    contactEmail: editData?.contactEmail || "",
    pickupPoint: editData?.pickupPoint || "",
    pickupTime: editData?.pickupTime || "",
    dropPoint: editData?.dropPoint || "",
    tourName: editData?.tourName || "",
    journeyDate: toDateInputValue(editData?.journeyDate),
    duration: editData?.duration || "",
    busType: editData?.busType || "",
    holdId: editData?.holdId || "",
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
          pickupPoint: p.pickupPoint || editData?.pickupPoint || "",
          pickupTime: p.pickupTime || editData?.pickupTime || "",
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
            pickupPoint: editData?.pickupPoint || "",
            pickupTime: editData?.pickupTime || "",
            aadhar: "",
            seatId: "",
          },
        ],
    isFixedPrice: false,
    groupName: editData?.groupName || "",
    seatLayout: layoutKeyForBusType(editData?.busType),
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

  const tourPickupSuggestions = useMemo(() => {
    if (!formData.tourName) return []
    const points = new Set()
    bookings
      .filter((b) => b.tourName === formData.tourName && !b.deletedAt && b.status !== "Cancelled")
      .forEach((b) => {
        if (b.pickupPoint?.trim()) points.add(b.pickupPoint.trim())
        ;(b.passengers || []).forEach((p) => {
          if (p.pickupPoint?.trim()) points.add(p.pickupPoint.trim())
        })
      })
    return Array.from(points).slice(0, 30)
  }, [formData.tourName, bookings])

  const [activeHolds, setActiveHolds] = useState([])
  const [seatConfig, setSeatConfig] = useState(null)

  useEffect(() => {
    if (!formData.tourName || !formData.journeyDate) {
      setActiveHolds([])
      setSeatConfig(null)
      return
    }
    let cancelled = false
    const bus = formData.busType || "2x1 Sleeper Luxury"
    const key = `${formData.tourName}___${formData.journeyDate}___${bus}`

    fetch(`/api/departures/${encodeURIComponent(key)}/seat-holds`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setActiveHolds(data.filter((h) => h.isEffective))
        }
      })
      .catch(() => {})

    fetch(`/api/departures/${encodeURIComponent(key)}/seat-config`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.config) {
          setSeatConfig(data.config)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [formData.tourName, formData.journeyDate, formData.busType])

  const bookedSeatsMap = useMemo(() => {
    const layoutKey = layoutKeyForBusType(formData.busType || formData.seatLayout)
    const map = {}
    bookedSeats.forEach((bs) => {
      const canonicalId = resolveSeatId(layoutKey, bs.seatId)
      map[canonicalId] = {
        status: "booked",
        passengerName: bs.passengerName,
        invoiceNo: bs.invoiceNo,
      }
    })

    activeHolds.forEach((h) => {
      if (formData.holdId && (h._id === formData.holdId || h.id === formData.holdId)) {
        return // Permitted for this booking!
      }
      (h.seatIds || []).forEach((s) => {
        const canonicalId = resolveSeatId(layoutKey, s)
        map[canonicalId] = {
          status: h.kind === "block" ? "blocked" : "held",
          holderName: h.holderName,
          mode: h.mode,
          note: h.note,
        }
      })
    })

    if (seatConfig) {
      (seatConfig.ladiesSeats || []).forEach((raw) => {
        const canonicalId = resolveSeatId(layoutKey, raw)
        if (!map[canonicalId]) {
          map[canonicalId] = { status: "available" }
        }
        map[canonicalId].ladies = true
      });
      (seatConfig.couplePairs || []).forEach((cp) => {
        const canA = resolveSeatId(layoutKey, cp.a)
        const canB = resolveSeatId(layoutKey, cp.b)
        if (!map[canA]) map[canA] = { status: "available" }
        if (!map[canB]) map[canB] = { status: "available" }
        map[canA].pairWith = canB
        map[canB].pairWith = canA
      })
    }

    return map
  }, [bookedSeats, activeHolds, seatConfig, formData.holdId, formData.busType, formData.seatLayout])

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
      const isUpper = p.seatId
        ? p.seatId.toLowerCase().startsWith("upper") ||
          /-[Uu]\d+-/.test(p.seatId) ||
          p.seatId.toLowerCase() === "rear-b2"
        : false
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
      const seatLayoutType = layoutKeyForBusType(tour.busType)
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

  const [ladiesOverrideDialog, setLadiesOverrideDialog] = useState(null)
  const [overrideReasonInput, setOverrideReasonInput] = useState("")
  const [overrideReasonError, setOverrideReasonError] = useState("")
  const [fareSuggestionHint, setFareSuggestionHint] = useState("")

  const mixedGenderBerths = useMemo(() => {
    const layoutKey = layoutKeyForBusType(formData.busType || formData.seatLayout)
    const layout = getSeatLayout(layoutKey)
    if (!layout || layout.category !== "sleeper") return []

    const cabins = new Map()
    formData.passengers.forEach((p) => {
      if (!p.seatId) return
      const canonical = resolveSeatId(layoutKey, p.seatId)
      const seatDef = layout.seats.find((s) => s.id === canonical)
      if (seatDef?.cabin) {
        if (!cabins.has(seatDef.cabin)) cabins.set(seatDef.cabin, [])
        cabins.get(seatDef.cabin).push({
          name: p.name || "Traveler",
          gender: p.gender || "Unknown",
          seatId: p.seatId,
        })
      }
    })

    const mixed = []
    for (const [cabin, paxList] of cabins.entries()) {
      if (paxList.length >= 2) {
        const genders = new Set(paxList.map((p) => (p.gender || "").toLowerCase()).filter(Boolean))
        if (genders.has("male") && genders.has("female")) {
          mixed.push({ cabin, paxList })
        }
      }
    }
    return mixed
  }, [formData.passengers, formData.busType, formData.seatLayout])

  const applySeatAssignment = (paxIndex, newSeatId, updatedPax, overrideData = null) => {
    const layoutKey = layoutKeyForBusType(formData.busType || formData.seatLayout)
    const updated = updatedPax ? [...updatedPax] : formData.passengers.map((p) => ({ ...p }))
    updated[paxIndex].seatId = newSeatId

    // Auto-select couple pair partner for next unseated passenger
    if (newSeatId && seatConfig?.couplePairs?.length > 0) {
      const pair = seatConfig.couplePairs.find((cp) => {
        const canA = resolveSeatId(layoutKey, cp.a)
        const canB = resolveSeatId(layoutKey, cp.b)
        return canA === newSeatId || canB === newSeatId
      })
      if (pair) {
        const canA = resolveSeatId(layoutKey, pair.a)
        const canB = resolveSeatId(layoutKey, pair.b)
        const partnerSeat = canA === newSeatId ? canB : canA
        const nextUnseatedIdx = updated.findIndex((p, idx) => idx !== paxIndex && !p.seatId)
        if (nextUnseatedIdx !== -1) {
          updated[nextUnseatedIdx].seatId = partnerSeat
          toast.info(
            `Auto-selected couple pair seat ${formatSeatLabel(partnerSeat)} for ${
              updated[nextUnseatedIdx].name || `Passenger ${nextUnseatedIdx + 1}`
            }`,
          )
        }
      }
    }

    // Fare presets suggestion pre-fill (lower, upper, rear, seat)
    let suggestedBaseAmount = null
    if (!isEditMode && seatConfig?.fares) {
      let totalPreset = 0
      let hasPresets = false
      updated.forEach((p) => {
        if (!p.seatId) return
        const sid = p.seatId.toLowerCase()
        let paise = 0
        if (sid.includes("-u") || sid === "rear-b2") {
          paise = seatConfig.fares.upper || 0
        } else if (sid.startsWith("rear")) {
          paise = seatConfig.fares.rear || seatConfig.fares.lower || 0
        } else if (sid.startsWith("seat-")) {
          paise = seatConfig.fares.seat || 0
        } else {
          paise = seatConfig.fares.lower || 0
        }
        if (paise > 0) {
          totalPreset += paise / 100
          hasPresets = true
        }
      })
      if (hasPresets && totalPreset > 0) {
        suggestedBaseAmount = totalPreset
        setFareSuggestionHint("Suggested from seat settings")
      }
    }

    const calculatedTourTotal = calculateTotal(updated, formData.tourName)
    const effectiveTotal = suggestedBaseAmount || calculatedTourTotal || formData.totalAmount

    clearFieldError(`passenger-${paxIndex}-seat`)
    setFormData((prev) => ({
      ...prev,
      passengers: updated,
      totalAmount: effectiveTotal,
      baseAmount: effectiveTotal,
      overrideLadies: overrideData ? overrideData.overrideLadies : prev.overrideLadies,
      overrideReason: overrideData ? overrideData.overrideReason : prev.overrideReason,
    }))
  }

  const handleSeatSelection = (seatId) => {
    const layoutKey = layoutKeyForBusType(formData.busType || formData.seatLayout)
    const canonicalId = resolveSeatId(layoutKey, seatId)
    const updated = formData.passengers.map((p) => ({ ...p }))
    const occupantIdx = updated.findIndex(
      (p) => p.seatId && resolveSeatId(layoutKey, p.seatId) === canonicalId,
    )
    if (occupantIdx !== -1 && occupantIdx !== activePassengerIndex) return

    const currentPassengerSeat = updated[activePassengerIndex]?.seatId
      ? resolveSeatId(layoutKey, updated[activePassengerIndex].seatId)
      : ""
    const isDeselecting = currentPassengerSeat === canonicalId
    const targetSeatId = isDeselecting ? "" : canonicalId

    // Check Ladies reservation
    if (!isDeselecting && seatConfig?.ladiesSeats?.includes(canonicalId)) {
      const paxGender = (updated[activePassengerIndex]?.gender || "").trim().toLowerCase()
      if (paxGender && paxGender !== "female") {
        setLadiesOverrideDialog({
          seatId: canonicalId,
          passengerIndex: activePassengerIndex,
          passengerName: updated[activePassengerIndex]?.name || `Passenger ${activePassengerIndex + 1}`,
        })
        setOverrideReasonInput("")
        setOverrideReasonError("")
        return
      }
    }

    applySeatAssignment(activePassengerIndex, targetSeatId, updated)
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
      layout: formData.busType || formData.seatLayout || "2x1",
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
      layout: formData.busType || formData.seatLayout || "2x1",
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
      setFormData((prev) => ({
        ...prev,
        passengers: updated,
        groupName: updated.length > 1 ? prev.groupName : "",
      }))
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
    if (e?.preventDefault) {
      e.preventDefault()
    }

    // Owner requirement (Problem 1): Submitting can ONLY happen on Step 3 (Review step).
    // Pressing Enter in an input field never advances or creates a booking.
    if (currentStep !== BOOKING_STEPS.length - 1) {
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
      groupName:
        formData.groupName?.trim() ||
        (formData.passengers?.length > 1
          ? `${formData.passengers[0]?.name || formData.contactName || "Lead"} + ${formData.passengers.length - 1}`
          : ""),
      totalAmount: pricingBreakdown.finalTotal,
      baseAmount: pricingBreakdown.baseAmount,
      discount: pricingBreakdown.discountAmount,
      discountType: formData.discountType,
      gstRate: pricingBreakdown.gstRate,
      taxAmount: pricingBreakdown.taxAmount,
      isTaxInclusive: pricingBreakdown.isTaxInclusive,
      passengers: (formData.passengers || []).map((p) => {
        const paxObj = { ...p }
        if (isMaskedAadhaar(paxObj.aadhar)) {
          paxObj.aadhar = "[UNCHANGED]"
        }
        paxObj.pickupPoint = paxObj.pickupPoint || formData.pickupPoint || ""
        paxObj.pickupTime = paxObj.pickupTime || formData.pickupTime || ""
        return paxObj
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
    /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
    <form
      ref={formTopRef}
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        // Prevent Enter in text/numeric inputs from submitting or jumping steps
        if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
          e.preventDefault()
        }
      }}
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
                          const layoutKey = layoutKeyForBusType(busType)
                          clearFieldError("busType")
                          setFormData((prev) => ({ ...prev, busType, seatLayout: layoutKey }))
                        }}
                      >
                        <option value="">Select bus type...</option>
                        {STANDARD_BUS_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                        {formData.busType && !STANDARD_BUS_TYPES.includes(formData.busType) && (
                          <option value={formData.busType}>{formData.busType}</option>
                        )}
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

              {/* Boarding & Pickup Details */}
              <Card elevation="sm" padding="lg" className="space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--yh-radius-md)] bg-brand-soft text-brand"
                  >
                    <MapPin size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-ink">
                      Boarding &amp; Drop Details (Optional)
                    </h2>
                    <p className="text-xs text-ink-muted">
                      Specify pickup location and schedule for manifests and coordinator WhatsApp lists
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field
                    id="pickupPoint"
                    label="Pickup point"
                    hint="e.g. Geeta Mandir, Iscon Cross Road"
                    error={stepErrors.pickupPoint}
                  >
                    {({ id, describedBy }) => (
                      <>
                        <Input
                          id={id}
                          list="tour-pickup-datalist"
                          placeholder="Select or enter pickup stop"
                          value={formData.pickupPoint}
                          aria-describedby={describedBy}
                          maxLength={80}
                          onChange={(e) => {
                            clearFieldError("pickupPoint")
                            setFormData((prev) => ({ ...prev, pickupPoint: e.target.value }))
                          }}
                        />
                        <datalist id="tour-pickup-datalist">
                          {tourPickupSuggestions.map((stop) => (
                            <option key={stop} value={stop} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </Field>

                  <Field
                    id="pickupTime"
                    label="Pickup time"
                    hint="e.g. 06:30 AM or 18:00"
                    error={stepErrors.pickupTime}
                  >
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        type="text"
                        placeholder="HH:MM (e.g. 06:30 AM)"
                        value={formData.pickupTime}
                        aria-describedby={describedBy}
                        maxLength={20}
                        onChange={(e) => {
                          clearFieldError("pickupTime")
                          setFormData((prev) => ({ ...prev, pickupTime: e.target.value }))
                        }}
                      />
                    )}
                  </Field>

                  <Field
                    id="dropPoint"
                    label="Drop point"
                    hint="Destination stop/station"
                    error={stepErrors.dropPoint}
                  >
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        placeholder="e.g. Somnath Temple Gate"
                        value={formData.dropPoint}
                        aria-describedby={describedBy}
                        maxLength={80}
                        onChange={(e) => {
                          clearFieldError("dropPoint")
                          setFormData((prev) => ({ ...prev, dropPoint: e.target.value }))
                        }}
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

              {mixedGenderBerths.length > 0 && (
                <div className="space-y-2">
                  {mixedGenderBerths.map((m) => (
                    <div
                      key={m.cabin}
                      className="flex items-start gap-2 p-3 text-xs rounded-[var(--yh-radius-md)] bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/25"
                    >
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <span className="font-bold block">Mixed-Gender Berth Box: {m.cabin}</span>
                        <span>
                          Berth box {m.cabin} has travelers of mixed genders (
                          {m.paxList
                            .map((p) => `${p.name || "Traveler"}: ${p.gender || "Unknown"}`)
                            .join(", ")}
                          ).
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {formData.passengers.length > 1 && (
                  <div className="rounded-[var(--yh-radius-lg)] bg-brand-soft/40 border border-brand/20 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-brand text-white font-bold text-xs shrink-0">
                        👥
                      </span>
                      <div>
                        <p className="font-bold text-ink text-sm">
                          Group booking ({formData.passengers.length} passengers)
                        </p>
                        <p className="text-ink-muted text-[11px]">
                          Treated as a unified group on payment sheets, summaries &amp; operator manifests.
                        </p>
                      </div>
                    </div>
                    <div className="sm:w-64 shrink-0">
                      <label htmlFor="group-name-input" className="block text-[11px] font-semibold text-ink-muted mb-1">
                        Group Name (Optional)
                      </label>
                      <Input
                        id="group-name-input"
                        type="text"
                        placeholder={
                          formData.passengers[0]?.name || formData.contactName
                            ? `${formData.passengers[0]?.name || formData.contactName} + ${formData.passengers.length - 1}`
                            : "Group Name"
                        }
                        value={formData.groupName || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, groupName: e.target.value }))}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                )}

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
                  label={
                    <span className="flex items-center justify-between w-full">
                      <span>Base package cost (₹)</span>
                      {fareSuggestionHint && (
                        <span className="text-[11px] font-normal text-brand">
                          ({fareSuggestionHint})
                        </span>
                      )}
                    </span>
                  }
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
                        setFareSuggestionHint("")
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
                  {(formData.pickupPoint || formData.dropPoint) && (
                    <div className="sm:col-span-2 pt-2 border-t border-border-subtle">
                      <dt className="text-xs text-ink-muted">Boarding &amp; Drop</dt>
                      <dd className="font-medium text-ink mt-0.5 text-xs">
                        {formData.pickupPoint ? `Pickup: ${formData.pickupPoint}` : ""}
                        {formData.pickupTime ? ` (${formData.pickupTime})` : ""}
                        {formData.pickupPoint && formData.dropPoint ? " · " : ""}
                        {formData.dropPoint ? `Drop: ${formData.dropPoint}` : ""}
                      </dd>
                    </div>
                  )}
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
                        {p.seatId ? `Seat ${formatSeatLabel(p.seatId, { busType: formData.busType })}` : "Unassigned"}
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
              {currentStep === BOOKING_STEPS.length - 1 ? "Back to edit" : currentStep === 0 ? "Cancel" : "Back"}
            </Button>

            <span className="text-xs font-medium text-ink-muted tabular-nums">
              Step {currentStep + 1} of {BOOKING_STEPS.length}
            </span>

            {currentStep < BOOKING_STEPS.length - 1 ? (
              <Button
                key="step-btn-next"
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
                key="step-btn-confirm"
                type="button"
                variant="accent"
                size="md"
                loading={isSubmitting}
                disabled={isSubmitting}
                leftIcon={<Save size={16} />}
                onClick={handleSubmit}
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
            {currentStep === BOOKING_STEPS.length - 1 ? "Back to edit" : currentStep === 0 ? "Cancel" : "Back"}
          </Button>

          {currentStep < BOOKING_STEPS.length - 1 ? (
            <Button
              key="mobile-step-btn-next"
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
              key="mobile-step-btn-confirm"
              type="button"
              variant="accent"
              size="md"
              fullWidth
              loading={isSubmitting}
              disabled={isSubmitting}
              leftIcon={<Save size={15} />}
              onClick={handleSubmit}
            >
              {isEditMode ? "Update Booking" : "Confirm Booking"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Coach Seat Picker Modal (Migrated to Modal primitive) ── */}
      <Modal
        isOpen={showSeatMap}
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
            <SeatMap
              layout={layoutKeyForBusType(formData.busType || formData.seatLayout)}
              seatStates={bookedSeatsMap}
              selectedIds={formData.passengers.map((p) => p.seatId).filter(Boolean)}
              onSeatClick={handleSeatSelection}
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

      {/* ── Ladies Seat Override Modal ── */}
      {ladiesOverrideDialog && (
        <Modal
          isOpen={Boolean(ladiesOverrideDialog)}
          onClose={() => setLadiesOverrideDialog(null)}
          title="Ladies Reserved Seat Override"
          description={`Seat ${formatSeatLabel(ladiesOverrideDialog.seatId)} is reserved for ladies. Passenger "${ladiesOverrideDialog.passengerName}" is registered as non-female.`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-500/10 rounded-[var(--yh-radius-md)] border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold block mb-1">Authorization Required</span>
              <span>
                To assign a ladies-reserved seat to this passenger, please provide an operational override reason (minimum 3 characters). This action will be logged in the audit trail.
              </span>
            </div>

            <Field
              label="Override Reason"
              required
              error={overrideReasonError}
            >
              <Input
                type="text"
                placeholder="e.g. Traveling with family / operator approval"
                value={overrideReasonInput}
                onChange={(e) => {
                  setOverrideReasonInput(e.target.value)
                  if (overrideReasonError) setOverrideReasonError("")
                }}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setLadiesOverrideDialog(null)}
              >
                Cancel Assignment
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  if (overrideReasonInput.trim().length < 3) {
                    setOverrideReasonError("Please enter a reason of at least 3 characters.")
                    return
                  }
                  applySeatAssignment(
                    ladiesOverrideDialog.passengerIndex,
                    ladiesOverrideDialog.seatId,
                    null,
                    {
                      overrideLadies: true,
                      overrideReason: overrideReasonInput.trim(),
                    },
                  )
                  setLadiesOverrideDialog(null)
                }}
              >
                Confirm Override
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </form>
  )
}
