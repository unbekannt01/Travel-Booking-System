import { useState, useMemo } from "react"
import {
  ArrowLeft,
  Save,
  UserPlus,
  Trash2,
  Bus,
  CreditCard,
  Calendar,
  Building,
  ChevronDown,
  Check,
  Layout,
  X,
  LockKeyhole,
} from "lucide-react"
import { useToast } from "./common/ToastContext"
import { toDateInputValue } from "../utils/date"
import { isValidIndianPhone, isValidAadhaar } from "../utils/validators"
import { calculatePricing } from "../utils/pricing"

const CustomSelect = ({ label, value, options, onChange, placeholder, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`space-y-2 relative ${className}`}>
      {label && <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-left focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-600 transition-all outline-none flex items-center justify-between group"
        >
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {options.find((opt) => opt.value === value)?.label || placeholder}
          </span>
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      value === option.value ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                    {value === option.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const GenderSelector = ({ value, onChange }) => {
  const options = [
    { label: "Male", value: "Male" },
    { label: "Female", value: "Female" },
  ]

  return (
    <div className="flex gap-2 w-full">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
            value === opt.value
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-white border-2 border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const rows = [1, 2, 3, 4, 5, 6]
const rows2x2 = [1, 2, 3, 4, 5] // 2x2 has 5 rows (10 seats per deck)

const Seat = ({ id, label, passengers, onSeatSelect, bookedSeats }) => {
  const getSeatInfo = (id) => passengers.find((p) => p.seatId === id)
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
          ? "border-red-300 bg-red-50 cursor-not-allowed opacity-75"
          : isSelectedInCurrentBooking
            ? "border-indigo-600 bg-indigo-50 cursor-pointer"
            : "border-slate-200 bg-white hover:border-indigo-300 cursor-pointer"
      }`}
    >
      <span
        className={`text-[8px] md:text-[9px] font-black mb-0.5 ${
          isBookedByOther ? "text-red-600" : isSelectedInCurrentBooking ? "text-indigo-600" : "text-slate-400"
        }`}
      >
        {label}
      </span>
      {isBookedByOther ? (
        <div className="flex flex-col items-center">
          <LockKeyhole size={10} className="text-red-500 mb-0.5" />
          <div className="text-[7px] font-bold text-red-700 leading-tight text-center truncate w-full px-1">
            {bookedBy.passengerName?.split(" ")[0] || "Booked"}
          </div>
        </div>
      ) : isSelectedInCurrentBooking ? (
        <div className="text-[8px] font-bold text-indigo-900 leading-tight text-center truncate w-full px-1">
          {occupant.name?.split(" ")[0] || "USER"}
        </div>
      ) : (
        <div className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-indigo-300" />
      )}
    </button>
  )
}

const DeckGrid = ({ deck, passengers, onSeatSelect, bookedSeats }) => (
  <div className="flex flex-col items-center space-y-4">
    <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 mb-2">
      {deck} DECK
    </div>
    <div className="relative bg-slate-100 p-4 rounded-2xl border-4 border-slate-200 shadow-inner">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-300 px-3 py-1 rounded-full text-[8px] font-black text-slate-600 uppercase tracking-widest z-10">
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

        <div className="w-8 md:w-10 bg-slate-200/50 rounded-lg flex items-center justify-center relative overflow-hidden">
          <div className="rotate-90 whitespace-nowrap text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.5em] flex items-center gap-2">
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

const DeckGrid2x2 = ({ deck, passengers, onSeatSelect, bookedSeats }) => {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 mb-2">
        {deck} DECK
      </div>
      <div className="relative bg-slate-100 p-4 rounded-2xl border-4 border-slate-200 shadow-inner">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-300 px-3 py-1 rounded-full text-[8px] font-black text-slate-600 uppercase tracking-widest z-10">
          FRONT
        </div>

        <div className="flex gap-4">
          {/* Left side - 2 seats */}
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

          <div className="w-8 md:w-10 bg-slate-200/50 rounded-lg flex items-center justify-center relative overflow-hidden">
            <div className="rotate-90 whitespace-nowrap text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.5em] flex items-center gap-2">
              <span className="opacity-20">----------</span>
              GALLARY
              <span className="opacity-20">----------</span>
            </div>
          </div>

          {/* Right side - 2 seats */}
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
}

const SeatLegend = () => (
  <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-2.5 px-6 bg-slate-50 border border-slate-200/80 rounded-2xl w-full max-w-xl mx-auto mb-4">
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-md border-2 border-slate-200 bg-white" />
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Available</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-md border-2 border-indigo-600 bg-indigo-50 flex items-center justify-center text-[9px] font-black text-indigo-600">✓</div>
      <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700">Selected</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-md border-2 border-red-300 bg-red-50 flex items-center justify-center">
        <LockKeyhole size={10} className="text-red-500" />
      </div>
      <span className="text-[11px] font-black uppercase tracking-wider text-red-600">Booked</span>
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

export default function BookingForm({ onSave, tours, editData, onCancel, bookings = [] }) {
  const { toast } = useToast()
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
    passengers: editData?.passengers || [
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

  const [showSeatMap, setShowSeatMap] = useState(false)
  const [activePassengerIndex, setActivePassengerIndex] = useState(0)

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

  const bookedSeats = useMemo(() => {
    if (!formData.tourName || !formData.journeyDate) return []

    const targetDate = toDateInputValue(formData.journeyDate)

    const relevantBookings = bookings.filter((b) => {
      const isSameTour = b.tourName === formData.tourName
      const bookingDate = toDateInputValue(b.journeyDate || b.date)
      const isSameDate = bookingDate === targetDate
      const isNotCurrentBooking = b.id !== formData.id && b._id !== formData.id && b.id !== formData._id && b._id !== formData._id
      const isNotCancelled = b.status !== "Cancelled" && b.status !== "cancelled"
      return isSameTour && isSameDate && isNotCurrentBooking && isNotCancelled
    })

    const seats = []
    relevantBookings.forEach((booking) => {
      booking.passengers.forEach((passenger) => {
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

  const calculateTotal = (passengers, tourName) => {
    const tour = tours.find((t) => t.name === tourName)
    if (!tour) return 0

    return passengers.reduce((sum, p) => {
      // Check if tour uses fixed pricing
      if (tour.pricingType === "fixed" || (tour.fixedPrice && !tour.pricingType)) {
        return sum + (Number(tour.fixedPrice) || 0)
      }

      // Otherwise use berth-based pricing
      const isUpper = p.seatId?.startsWith("upper")
      const price = isUpper ? Number(tour.upperPrice) || 0 : Number(tour.lowerPrice) || 0
      return sum + price
    }, 0)
  }

  const handleTourSelect = (tourName) => {
    if (tourName === "custom") {
      setFormData({ ...formData, tourName: "" })
      return
    }
    const tour = tours.find((t) => t.name === tourName)
    if (tour) {
      const newTotal = calculateTotal(formData.passengers, tour.name)
      const seatLayoutType = tour.busType?.startsWith("2x2") ? "2x2" : "2x1"

      setFormData((prev) => ({
        ...prev,
        tourName: tour.name,
        duration: tour.duration,
        busType: tour.busType,
        journeyDate: tour.journeyDate || prev.journeyDate,
        totalAmount: newTotal,
        baseAmount: newTotal,
        invoiceNo: editData?.invoiceNo || "",
        isFixedPrice: tour.isFixedPrice,
        seatLayout: seatLayoutType,
      }))
    } else {
      setFormData({ ...formData, tourName: tourName })
    }
  }

  const handleSeatSelection = (seatId) => {
    const updated = [...formData.passengers]
    const occupantIdx = updated.findIndex((p) => p.seatId === seatId)
    if (occupantIdx !== -1 && occupantIdx !== activePassengerIndex) return

    updated[activePassengerIndex].seatId = updated[activePassengerIndex].seatId === seatId ? "" : seatId

    const newTotal = calculateTotal(updated, formData.tourName)
    setFormData({
      ...formData,
      passengers: updated,
      totalAmount: newTotal,
      baseAmount: newTotal,
    })
  }

  const addPassenger = () => {
    setFormData({
      ...formData,
      passengers: [
        ...formData.passengers,
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
    })
  }

  const removePassenger = (index) => {
    if (formData.passengers.length > 1) {
      const updated = formData.passengers.filter((_, i) => i !== index)
      setFormData({ ...formData, passengers: updated })
    }
  }

  const updatePassenger = (index, field, value) => {
    const updated = [...formData.passengers]
    updated[index][field] = value
    setFormData({ ...formData, passengers: updated })
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!formData.contactName?.trim()) {
      toast.error("Please enter the primary traveler's name")
      return
    }

    if (!isValidIndianPhone(formData.contactPhone)) {
      toast.error("Please provide a valid 10-digit Indian mobile number")
      return
    }

    if (!formData.tourName) {
      toast.error("Please select a tour package")
      return
    }

    if (!formData.journeyDate) {
      toast.error("Please select a journey date")
      return
    }

    const numTotal = pricingBreakdown.finalTotal
    const numAdvance = Number(formData.advanceReceived || 0)

    if (isNaN(numTotal) || numTotal < 0) {
      toast.error("Total amount must be 0 or greater")
      return
    }

    if (isNaN(numAdvance) || numAdvance < 0) {
      toast.error("Advance payment cannot be negative")
      return
    }

    if (numAdvance > numTotal) {
      toast.error("Advance payment cannot exceed total amount")
      return
    }

    for (let i = 0; i < formData.passengers.length; i++) {
      const p = formData.passengers[i]
      if (!p.name?.trim() || !p.city?.trim()) {
        toast.error(`Passenger ${i + 1}: Name and city are required`)
        return
      }
      const age = Number(p.age)
      if (isNaN(age) || age < 1 || age > 120) {
        toast.error(`Passenger ${p.name || i + 1}: Please enter a valid age`)
        return
      }
      if (p.aadhar && !isValidAadhaar(p.aadhar)) {
        toast.error(`Passenger ${p.name || i + 1}: Aadhaar must be a 12-digit number`)
        return
      }
    }

    // Check for internal duplicate seats
    const seatIds = formData.passengers.map((p) => p.seatId).filter(Boolean)
    const seenSeats = new Set()
    for (const s of seatIds) {
      if (seenSeats.has(s)) {
        toast.error(`Seat ${s} is selected by multiple passengers in this booking`)
        return
      }
      seenSeats.add(s)
    }

    // Check against already booked seats on client
    const bookedSeatIds = new Set(bookedSeats.map((bs) => bs.seatId))
    const conflicts = seatIds.filter((s) => bookedSeatIds.has(s))
    if (conflicts.length > 0) {
      toast.error(`Seat(s) ${conflicts.join(", ")} already booked for this tour on this date`)
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
    }

    onSave(finalData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10 pb-20 animate-entrance">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 text-slate-400 hover:text-primary font-bold text-sm mb-2 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
          </button>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            {editData ? "Refine Reservation" : "Plan New Journey"}
          </h2>
        </div>
        <button
          type="submit"
          className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Save size={18} /> {editData ? "Update Details" : "Confirm Booking"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white rounded-[2rem] p-8 lg:p-10 shadow-sm border border-slate-200/50">
            <div className="flex items-center gap-3 mb-10">
              <div className="bg-primary/10 text-primary p-3 rounded-2xl">
                <Building size={20} />
              </div>
              <h3 className="font-black text-xl text-slate-900">Contact Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Primary Traveler
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full name as per ID"
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-primary/20 transition-all outline-none"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Mobile Contact
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 XXXX XXX XXX"
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.contactPhone ? `+91 ${formData.contactPhone}` : ""}
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(/^\+91\s*/, "")
                      .replace(/\D/g, "")
                      .slice(0, 10)
                    setFormData({ ...formData, contactPhone: value })
                  }}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Email ID (Optional)
                </label>
                <input
                  type="email"
                  placeholder="email@address.com"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs">
                  #{1}
                </div>
                <h3 className="font-black text-lg text-slate-900">Passenger Manifest</h3>
              </div>
              <button
                type="button"
                onClick={addPassenger}
                className="text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 active:scale-95"
              >
                <UserPlus size={16} /> Add Passenger
              </button>
            </div>

            <div className="space-y-6">
              {formData.passengers.map((p, i) => (
                <div
                  key={i}
                  className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 relative group transition-all overflow-visible"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs">
                      #{i + 1}
                    </span>
                    {formData.passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePassenger(i)}
                        className="p-2 text-slate-300 hover:text-white hover:bg-red-500 rounded-xl transition-all shadow-sm"
                        title="Remove Passenger"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Name</label>
                        <input
                          type="text"
                          required
                          className="w-full px-0 py-1 bg-transparent border-b border-slate-200 text-sm font-bold focus:border-indigo-600 transition-all outline-none"
                          value={p.name}
                          onChange={(e) => updatePassenger(i, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">City</label>
                        <input
                          type="text"
                          required
                          className="w-full px-0 py-1 bg-transparent border-b border-slate-200 text-sm font-bold focus:border-indigo-600 transition-all outline-none"
                          value={p.city}
                          onChange={(e) => updatePassenger(i, "city", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Age</label>
                        <input
                          type="number"
                          required
                          className="w-full px-0 py-1 bg-transparent border-b border-slate-200 text-sm font-bold focus:border-indigo-600 transition-all outline-none"
                          value={p.age}
                          onChange={(e) => updatePassenger(i, "age", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gender</label>
                        <GenderSelector value={p.gender} onChange={(val) => updatePassenger(i, "gender", val)} />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                          Selected Seat
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setActivePassengerIndex(i)
                            setShowSeatMap(true)
                          }}
                          className={`w-full py-2.5 rounded-xl text-xs font-black border-2 transition-all flex items-center justify-center gap-2 ${
                            p.seatId
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 text-slate-400 bg-white"
                          }`}
                        >
                          <Layout size={14} /> {p.seatId || "Select Seat"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 border-dashed">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                          Internal Contact (Admin Only)
                        </label>
                        <input
                          type="tel"
                          placeholder="+91 XXXXXXXXXX"
                          className="w-full px-4 py-2 bg-white border-transparent rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-100 transition-all outline-none"
                          value={p.contact ? `+91 ${p.contact}` : ""}
                          onChange={(e) => {
                            const value = e.target.value
                              .replace(/^\+91\s*/, "") // remove +91
                              .replace(/\D/g, "") // only digits
                              .slice(0, 10) // max 10 digits

                            updatePassenger(i, "contact", value)
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                          Aadhar Card (Admin Only)
                        </label>
                        <input
                          type="text"
                          placeholder="XXXX XXXX XXXX"
                          maxLength={14}
                          className="w-full px-4 py-2 bg-white border-transparent rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-100 transition-all outline-none"
                          value={p.aadhar ? p.aadhar.replace(/(\d{4})(?=\d)/g, "$1 ") : ""}
                          onChange={(e) => {
                            const raw = e.target.value
                              .replace(/\D/g, "") // only digits
                              .slice(0, 12) // max 12 digits

                            updatePassenger(i, "aadhar", raw)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {showSeatMap && (
            <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-white/95 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-300 max-h-[95vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900">Choose Seat</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1.5">
                      Assigning seat for:{" "}
                      <span className="text-indigo-600">
                        {formData.passengers[activePassengerIndex].name || "Passenger " + (activePassengerIndex + 1)}
                      </span>
                    </p>
                    {bookedSeats.length > 0 && (
                      <p className="text-[11px] font-bold text-red-600 uppercase tracking-wide mt-2 flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-full">
                        <LockKeyhole size={12} /> {bookedSeats.length} seats already booked
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSeatMap(false)}
                    className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1 p-6 md:p-8">
                  <SeatLayout
                    passengers={formData.passengers}
                    bookedSeats={bookedSeats}
                    onSeatSelect={handleSeatSelection}
                    seatLayout={formData.seatLayout || "2x1"}
                  />
                </div>

                <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => setShowSeatMap(false)}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] float-right"
                  >
                    Confirm Selection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-10">
          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-orange-50 text-orange-600 p-2.5 rounded-xl">
                <Bus size={20} />
              </div>
              <h3 className="font-black text-lg text-slate-900">Tour Logistics</h3>
            </div>
            <div className="space-y-6">
              <CustomSelect
                label="Quick Tour Selection"
                value={formData.tourName}
                onChange={handleTourSelect}
                placeholder="Select a pre-defined tour..."
                options={[
                  ...tours.map((t) => ({ label: t.name, value: t.name })),
                  { label: "+ Manual Entry", value: "custom" },
                ]}
              />

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Tour Destination Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nepal-Special Package"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.tourName}
                  onChange={(e) => setFormData({ ...formData, tourName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Journey Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="date"
                    required
                    className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                    value={formData.journeyDate}
                    onChange={(e) => setFormData({ ...formData, journeyDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Bus Arrangement</label>
                <select
                  required
                  value={formData.busType}
                  onChange={(e) => {
                    const busType = e.target.value
                    const layoutType = busType.startsWith("2x2") ? "2x2" : "2x1"
                    setFormData({ ...formData, busType, seatLayout: layoutType })
                  }}
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none cursor-pointer appearance-none bg-no-repeat bg-right"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    paddingRight: "2.5rem",
                  }}
                >
                  <option value="">Select Bus Type...</option>
                  <option value="2x1 Sleeper Luxury">2x1 Sleeper Luxury</option>
                  <option value="2x2 Sleeper Luxury">2x2 Sleeper Luxury</option>
                </select>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                <CreditCard size={20} />
              </div>
              <h3 className="font-black text-lg text-slate-900">Billing Summary</h3>
            </div>
            <div className="space-y-5">
              {/* Base Package Cost */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Base Package Cost (₹)
                </label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.baseAmount || ""}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0
                    setFormData({
                      ...formData,
                      baseAmount: val,
                      totalAmount: val,
                    })
                  }}
                />
              </div>

              {/* Discount Section */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Discount
                  </label>
                  <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, discountType: "fixed" })}
                      className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                        formData.discountType === "fixed" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      ₹ Flat
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, discountType: "percentage" })}
                      className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all ${
                        formData.discountType === "percentage" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      % Pct
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  max={formData.discountType === "percentage" ? "100" : undefined}
                  placeholder={formData.discountType === "percentage" ? "e.g. 10%" : "e.g. 500"}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.discount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </div>

              {/* GST / Tax Configuration */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    GST / Tax Rate
                  </label>
                  <select
                    value={formData.gstRate}
                    onChange={(e) => setFormData({ ...formData, gstRate: Number(e.target.value) || 0 })}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value={0}>0% (Tax Exempt)</option>
                    <option value={5}>5% (Bus Tour Standard)</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                  </select>
                </div>
                {formData.gstRate > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={formData.isTaxInclusive}
                      onChange={(e) => setFormData({ ...formData, isTaxInclusive: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-600">
                      Price already includes GST (Inclusive)
                    </span>
                  </label>
                )}
              </div>

              {/* Live Accounting Breakdown */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1.5 text-xs font-bold text-slate-600">
                <div className="flex justify-between">
                  <span>Gross Base:</span>
                  <span className="text-slate-900 font-black">₹{pricingBreakdown.baseAmount.toLocaleString()}</span>
                </div>
                {pricingBreakdown.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount ({formData.discountType === "percentage" ? `${formData.discount}%` : "Flat"}):</span>
                    <span className="font-black">-₹{pricingBreakdown.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {pricingBreakdown.gstRate > 0 && (
                  <>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Taxable Value:</span>
                      <span>₹{pricingBreakdown.netBeforeTax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-indigo-600 text-[11px]">
                      <span>CGST ({pricingBreakdown.gstRate / 2}%):</span>
                      <span>+₹{pricingBreakdown.cgstAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-indigo-600 text-[11px]">
                      <span>SGST ({pricingBreakdown.gstRate / 2}%):</span>
                      <span>+₹{pricingBreakdown.sgstAmount.toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t border-indigo-200/60 pt-2 text-sm text-indigo-950 font-black">
                  <span>Final Total:</span>
                  <span>₹{pricingBreakdown.finalTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Advance Received */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Advance Received (₹)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-5 py-3.5 bg-emerald-50 text-emerald-700 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.advanceReceived || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      advanceReceived: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Balance Due Card */}
              <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 block mb-1">
                  Balance Due
                </span>
                <div className="text-3xl font-black">
                  ₹{Math.max(0, pricingBreakdown.finalTotal - (formData.advanceReceived || 0)).toLocaleString()}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </form>
  )
}
