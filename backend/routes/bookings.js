import express from "express"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import Payment from "../models/Payment.js"
import { getNextReceiptNo, syncBookingPayments } from "./payments.js"
import verifyToken from "../middleware/auth.js"

const router = express.Router()

// Helper function to generate tour code from tour name
export const generateTourCode = (tourName) => {
  if (!tourName) return "GEN"
  const words = tourName.trim().split(/\s+/)
  if (words.length === 1) {
    return tourName.substring(0, 3).toUpperCase().padEnd(3, "X")
  }
  return words
    .map((w) => w.charAt(0).toUpperCase())
    .join("")
    .substring(0, 3)
    .padEnd(3, "X")
}

// Helper function to get month code (JAN, FEB, etc.)
export const getMonthCode = (date) => {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
  const d = new Date(date)
  const month = isNaN(d.getMonth()) ? new Date().getMonth() : d.getMonth()
  return months[month]
}

// Safely extracts YYYY-MM-DD and returns day bounds for query
export const getDayBounds = (dateInput) => {
  let dateStr = ""
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) {
      dateStr = match[1]
    }
  }
  if (!dateStr) {
    const d = new Date(dateInput)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    dateStr = `${year}-${month}-${day}`
  }

  const start = new Date(`${dateStr}T00:00:00.000Z`)
  const end = new Date(`${dateStr}T23:59:59.999Z`)
  return { start, end, dateStr }
}

// Generates next unique invoice number for user with customizable prefix
export const getNextInvoiceNo = async (userId, tourName, journeyDate, customPrefix = "YHB") => {
  const tourCode = generateTourCode(tourName)
  const monthCode = getMonthCode(journeyDate || new Date())
  const pfx = (customPrefix || "YHB").toUpperCase().trim()
  const prefix = `${pfx}-${tourCode}-${monthCode}-`

  const existingBookings = await Booking.find({
    userId,
    invoiceNo: { $regex: `^${prefix}` },
  }).select("invoiceNo")

  let maxSerial = 0
  for (const b of existingBookings) {
    const match = b.invoiceNo.match(/(\d{3,})$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxSerial) maxSerial = num
    }
  }

  const nextSerial = maxSerial + 1
  return `${prefix}${String(nextSerial).padStart(3, "0")}`
}

// Indian mobile validation
export const validateIndianPhone = (phone) => {
  if (!phone) return false
  const clean = phone.toString().replace(/[\s\-()+]/g, "")
  if (clean.length === 12 && clean.startsWith("91")) {
    return /^[6-9]\d{9}$/.test(clean.slice(2))
  }
  if (clean.length === 11 && clean.startsWith("0")) {
    return /^[6-9]\d{9}$/.test(clean.slice(1))
  }
  return /^[6-9]\d{9}$/.test(clean)
}

// Aadhaar validation
export const validateAadhaar = (aadhar) => {
  if (!aadhar) return true // Aadhaar is optional
  const clean = aadhar.toString().replace(/\s+/g, "")
  return /^\d{12}$/.test(clean)
}

// Seat conflict validation
export const checkSeatConflicts = async ({ userId, tourName, journeyDate, passengers, excludeBookingId = null }) => {
  const seatIds = (passengers || []).map((p) => p.seatId).filter(Boolean)
  if (seatIds.length === 0) return null

  // 1. Check internal duplicates in current booking
  const seen = new Set()
  for (const s of seatIds) {
    if (seen.has(s)) {
      return {
        status: 400,
        message: `Seat ${s} is assigned to multiple passengers in this booking.`,
      }
    }
    seen.add(s)
  }

  // 2. Check against other active bookings for the same tour and journey date
  const { start, end } = getDayBounds(journeyDate)
  const query = {
    userId,
    tourName,
    journeyDate: { $gte: start, $lte: end },
    status: { $nin: ["Cancelled", "cancelled"] },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  }
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId }
  }

  const conflictingBookings = await Booking.find(query)
  const bookedSeats = new Map()
  for (const b of conflictingBookings) {
    for (const p of b.passengers) {
      if (p.seatId) {
        bookedSeats.set(p.seatId, { passengerName: p.name, invoiceNo: b.invoiceNo })
      }
    }
  }

  const conflicts = seatIds.filter((s) => bookedSeats.has(s))
  if (conflicts.length > 0) {
    return {
      status: 409,
      message: `Seat(s) ${conflicts.join(", ")} already booked for ${tourName} on this date.`,
      conflictingSeats: conflicts,
    }
  }

  return null
}

// POST /api/bookings/generate-invoice
router.post("/generate-invoice", verifyToken, async (req, res) => {
  try {
    const { tourName, journeyDate } = req.body
    if (!tourName) {
      return res.status(400).json({ message: "Tour name is required" })
    }
    const userDoc = await User.findById(req.user.id).select("invoicePrefix")
    const customPrefix = userDoc?.invoicePrefix || "YHB"
    const invoiceNo = await getNextInvoiceNo(req.user.id, tourName, journeyDate, customPrefix)
    res.json({ invoiceNo })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// GET /api/bookings/invoice/:invoiceNo
router.get("/invoice/:invoiceNo", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      userId: req.user.id,
      invoiceNo: req.params.invoiceNo,
    })
    if (!booking) return res.status(404).json({ message: "Booking not found" })
    res.json(booking)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// GET /api/bookings
router.get("/", verifyToken, async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId: req.user.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).sort({ createdAt: -1 })
    res.json(bookings)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/bookings
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      contactName,
      contactPhone,
      contactEmail,
      tourName,
      journeyDate,
      duration,
      busType,
      paymentMode,
      totalAmount,
      advanceReceived,
      passengers,
      discount = 0,
      discountType = "fixed",
      gstRate = 0,
      taxAmount = 0,
      isTaxInclusive = false,
      invoiceNo: clientInvoiceNo,
    } = req.body

    // Basic required validations
    if (!contactName || !contactPhone || !tourName || !journeyDate) {
      return res.status(400).json({ message: "Contact name, phone, tour name, and journey date are required." })
    }

    if (!validateIndianPhone(contactPhone)) {
      return res.status(400).json({ message: "Please provide a valid 10-digit Indian mobile number." })
    }

    const numTotal = Number(totalAmount)
    const numAdvance = Number(advanceReceived || 0)

    if (isNaN(numTotal) || numTotal < 0) {
      return res.status(400).json({ message: "Total amount must be 0 or greater." })
    }

    if (isNaN(numAdvance) || numAdvance < 0) {
      return res.status(400).json({ message: "Advance payment cannot be negative." })
    }

    if (numAdvance > numTotal) {
      return res.status(400).json({ message: "Advance payment cannot exceed total amount." })
    }

    if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({ message: "At least one passenger is required." })
    }

    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i]
      if (!p.name || !p.city) {
        return res.status(400).json({ message: `Passenger ${i + 1} is missing name or city.` })
      }
      const age = Number(p.age)
      if (isNaN(age) || age < 1 || age > 120) {
        return res.status(400).json({ message: `Passenger ${p.name || i + 1} must have a valid age.` })
      }
      if (p.aadhar && !validateAadhaar(p.aadhar)) {
        return res.status(400).json({ message: `Aadhaar for ${p.name} must be a valid 12-digit number.` })
      }
    }

    // Check seat conflicts
    const seatConflict = await checkSeatConflicts({
      userId: req.user.id,
      tourName,
      journeyDate,
      passengers,
    })
    if (seatConflict) {
      return res.status(seatConflict.status).json({
        message: seatConflict.message,
        conflictingSeats: seatConflict.conflictingSeats,
      })
    }

    // Fetch user settings for invoice and receipt prefixes if available
    const userDoc = await User.findById(req.user.id).select("invoicePrefix receiptPrefix")
    const customPrefix = userDoc?.invoicePrefix || "YHB"
    const customReceiptPrefix = userDoc?.receiptPrefix || "REC"

    // Single source of truth for invoiceNo: ensure user-uniqueness
    let invoiceNo = clientInvoiceNo
    if (invoiceNo) {
      const existing = await Booking.findOne({ userId: req.user.id, invoiceNo })
      if (existing) {
        invoiceNo = null
      }
    }

    const { start: normalizedJourneyDate } = getDayBounds(journeyDate)

    const isPaid = numAdvance >= numTotal && numTotal > 0

    const initialPayments =
      numAdvance > 0
        ? [
            {
              amount: numAdvance,
              date: req.body.date ? new Date(req.body.date) : new Date(),
              mode: paymentMode || "Cash",
              notes: "Initial advance payment",
            },
          ]
        : []

    const newBooking = new Booking({
      invoiceNo: "PENDING",
      date: req.body.date ? new Date(req.body.date) : new Date(),
      tourName,
      journeyDate: normalizedJourneyDate,
      duration: duration || "",
      busType: busType || "",
      contactName,
      contactPhone,
      contactEmail: contactEmail || "",
      paymentMode: paymentMode || "Cash",
      totalAmount: numTotal,
      advanceReceived: numAdvance,
      isPaid,
      status: "Confirmed",
      discount: Math.max(0, Number(discount) || 0),
      discountType: discountType === "percentage" ? "percentage" : "fixed",
      gstRate: Math.max(0, Number(gstRate) || 0),
      taxAmount: Math.max(0, Number(taxAmount) || 0),
      isTaxInclusive: Boolean(isTaxInclusive),
      payments: initialPayments,
      passengers,
      userId: req.user.id,
    })

    let savedBooking = null
    let attempts = 0
    while (!savedBooking && attempts < 5) {
      attempts++
      try {
        if (!invoiceNo || attempts > 1) {
          invoiceNo = await getNextInvoiceNo(req.user.id, tourName, journeyDate, customPrefix)
        }
        newBooking.invoiceNo = invoiceNo
        savedBooking = await newBooking.save()
      } catch (err) {
        if (err.code === 11000 && err.keyPattern && err.keyPattern.invoiceNo) {
          invoiceNo = null // regenerate on next attempt
        } else {
          throw err
        }
      }
    }

    if (!savedBooking) {
      return res.status(409).json({ message: "Could not generate a unique invoice number. Please try again." })
    }

    // If advance is received, record in separate Payment ledger collection
    if (numAdvance > 0) {
      try {
        const receiptNo = await getNextReceiptNo(req.user.id, customReceiptPrefix)
        const paymentDoc = new Payment({
          userId: req.user.id,
          bookingId: savedBooking._id,
          receiptNo,
          amount: numAdvance,
          type: "advance",
          paymentMode: paymentMode || "Cash",
          paymentDate: savedBooking.date,
          notes: "Initial advance payment",
          recordedBy: req.user.userName || req.user.email || "Operator",
        })
        await paymentDoc.save()
      } catch (payErr) {
        console.error("Warning: Could not create initial Payment ledger record:", payErr.message)
      }
    }

    res.status(201).json(savedBooking)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// PUT /api/bookings/:id (Whitelisted fields update)
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this booking" })
    }

    const effectiveTourName = req.body.tourName || booking.tourName
    const effectiveJourneyDate = req.body.journeyDate || booking.journeyDate
    const effectivePassengers = req.body.passengers || booking.passengers

    // Validate phone if provided
    if (req.body.contactPhone && !validateIndianPhone(req.body.contactPhone)) {
      return res.status(400).json({ message: "Please provide a valid 10-digit Indian mobile number." })
    }

    // Validate amounts if provided
    const newTotal = req.body.totalAmount !== undefined ? Number(req.body.totalAmount) : booking.totalAmount
    const newAdvance = req.body.advanceReceived !== undefined ? Number(req.body.advanceReceived) : booking.advanceReceived

    if (newTotal < 0) {
      return res.status(400).json({ message: "Total amount cannot be negative." })
    }
    if (newAdvance < 0) {
      return res.status(400).json({ message: "Advance payment cannot be negative." })
    }
    if (newAdvance > newTotal) {
      return res.status(400).json({ message: "Advance payment cannot exceed total amount." })
    }

    // Validate passengers if provided
    if (req.body.passengers) {
      if (!Array.isArray(req.body.passengers) || req.body.passengers.length === 0) {
        return res.status(400).json({ message: "At least one passenger is required." })
      }
      for (let i = 0; i < req.body.passengers.length; i++) {
        const p = req.body.passengers[i]
        if (!p.name || !p.city) {
          return res.status(400).json({ message: `Passenger ${i + 1} is missing name or city.` })
        }
        const age = Number(p.age)
        if (isNaN(age) || age < 1 || age > 120) {
          return res.status(400).json({ message: `Passenger ${p.name || i + 1} must have a valid age.` })
        }
        if (p.aadhar && !validateAadhaar(p.aadhar)) {
          return res.status(400).json({ message: `Aadhaar for ${p.name} must be a valid 12-digit number.` })
        }
      }
    }

    // Seat conflicts check (409)
    if (req.body.passengers || req.body.journeyDate || req.body.tourName) {
      const seatConflict = await checkSeatConflicts({
        userId: req.user.id,
        tourName: effectiveTourName,
        journeyDate: effectiveJourneyDate,
        passengers: effectivePassengers,
        excludeBookingId: booking._id,
      })
      if (seatConflict) {
        return res.status(seatConflict.status).json({
          message: seatConflict.message,
          conflictingSeats: seatConflict.conflictingSeats,
        })
      }
    }

    // Whitelist allowed fields to update
    const allowedFields = [
      "contactName",
      "contactPhone",
      "contactEmail",
      "tourName",
      "duration",
      "busType",
      "paymentMode",
      "totalAmount",
      "advanceReceived",
      "isPaid",
      "status",
      "discount",
      "discountType",
      "gstRate",
      "taxAmount",
      "isTaxInclusive",
      "cancellationCharge",
      "refundAmount",
      "passengers",
    ]

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        booking[field] = req.body[field]
      }
    }

    if (req.body.journeyDate !== undefined) {
      const { start } = getDayBounds(req.body.journeyDate)
      booking.journeyDate = start
    }

    if (booking.advanceReceived >= booking.totalAmount && booking.totalAmount > 0) {
      booking.isPaid = true
    }

    await booking.save()
    res.json(booking)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// PUT /api/bookings/:bookingId/passengers/:passengerIdentifier/checkin
router.put("/:bookingId/passengers/:passengerIdentifier/checkin", verifyToken, async (req, res) => {
  try {
    const { bookingId, passengerIdentifier } = req.params
    const booking = await Booking.findById(bookingId)

    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" })

    // Look up by subdocument _id or index
    let passenger = booking.passengers.id(passengerIdentifier)
    if (!passenger && /^\d+$/.test(passengerIdentifier)) {
      passenger = booking.passengers[parseInt(passengerIdentifier, 10)]
    }

    if (!passenger) {
      return res.status(404).json({ message: "Passenger not found" })
    }

    passenger.checkedIn = !passenger.checkedIn
    await booking.save()

    res.json(booking)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// PUT /api/bookings/:bookingId/passengers/batch-checkin
// Sets all passengers in a booking to checkedIn=true or false
router.put("/:bookingId/passengers/batch-checkin", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" })

    const { checkedIn } = req.body
    const newState = checkedIn !== false // default to true if not explicitly false

    for (const p of booking.passengers) {
      p.checkedIn = newState
    }

    await booking.save()
    res.json(booking)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// PUT /api/bookings/:bookingId/passengers/:passengerIdentifier
router.put("/:bookingId/passengers/:passengerIdentifier", verifyToken, async (req, res) => {
  try {
    const { bookingId, passengerIdentifier } = req.params
    const booking = await Booking.findById(bookingId)

    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" })

    let passenger = booking.passengers.id(passengerIdentifier)
    if (!passenger && /^\d+$/.test(passengerIdentifier)) {
      passenger = booking.passengers[parseInt(passengerIdentifier, 10)]
    }

    if (!passenger) {
      return res.status(404).json({ message: "Passenger not found" })
    }

    const { name, age, gender, city, seatId, contact, aadhar, checkedIn } = req.body

    if (name !== undefined) passenger.name = name
    if (age !== undefined) passenger.age = Number(age)
    if (gender !== undefined) passenger.gender = gender
    if (city !== undefined) passenger.city = city
    if (contact !== undefined) passenger.contact = contact
    if (aadhar !== undefined) {
      if (!validateAadhaar(aadhar)) {
        return res.status(400).json({ message: "Aadhaar must be a 12-digit number" })
      }
      passenger.aadhar = aadhar
    }
    if (checkedIn !== undefined) passenger.checkedIn = Boolean(checkedIn)

    if (seatId !== undefined && seatId !== passenger.seatId) {
      // Validate the new seatId is not booked
      passenger.seatId = seatId
      const seatConflict = await checkSeatConflicts({
        userId: req.user.id,
        tourName: booking.tourName,
        journeyDate: booking.journeyDate,
        passengers: booking.passengers,
        excludeBookingId: booking._id,
      })
      if (seatConflict) {
        return res.status(seatConflict.status).json({
          message: seatConflict.message,
          conflictingSeats: seatConflict.conflictingSeats,
        })
      }
    }

    await booking.save()
    res.json(booking)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// PUT /api/bookings/:bookingId/toggle-payment
router.put("/:bookingId/toggle-payment", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)

    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" })

    booking.isPaid = !booking.isPaid
    if (booking.isPaid) {
      booking.advanceReceived = booking.totalAmount
    }

    await booking.save()
    res.json(booking)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// PUT /api/bookings/:id/cancel
router.put("/:id/cancel", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to cancel this booking" })
    }

    const { reason, cancellationCharge, refundPaymentMode = "Cash" } = req.body
    const totalPaid = Math.round((booking.advanceReceived || 0) * 100) / 100
    let fee = 0
    if (cancellationCharge !== undefined && cancellationCharge !== null && cancellationCharge !== "") {
      fee = Math.round(Number(cancellationCharge) * 100) / 100
      if (isNaN(fee) || fee < 0) {
        return res.status(400).json({ message: "Cancellation charge cannot be negative." })
      }
      if (fee > totalPaid) {
        return res.status(400).json({
          message: `Cancellation charge ₹${fee} cannot exceed total amount collected ₹${totalPaid}.`,
        })
      }
    }

    const refundAmount = Math.max(0, Math.round((totalPaid - fee) * 100) / 100)

    booking.status = "Cancelled"
    booking.cancellationReason = reason || "Cancelled by operator"
    booking.cancelledAt = new Date()
    booking.cancellationCharge = fee
    booking.refundAmount = refundAmount
    booking.refundPaymentMode = refundPaymentMode

    // If there is an amount to refund, record a refund payment in Payment collection
    if (refundAmount > 0) {
      try {
        const user = await User.findById(req.user.id)
        const receiptPrefix = user?.receiptPrefix || "REC"
        const receiptNo = await getNextReceiptNo(req.user.id, receiptPrefix)
        const refundDoc = new Payment({
          userId: req.user.id,
          bookingId: booking._id,
          receiptNo,
          amount: refundAmount,
          type: "refund",
          paymentMode: refundPaymentMode,
          paymentDate: new Date(),
          notes: `Refund upon cancellation. Cancellation fee retained: ₹${fee}`,
          recordedBy: req.user.userName || req.user.email || "Operator",
        })
        await refundDoc.save()

        // Operator retained 'fee', so final advanceReceived is the retained fee
        booking.advanceReceived = fee
        booking.payments.push({
          amount: -refundAmount,
          date: new Date(),
          mode: refundPaymentMode,
          notes: `Refund upon cancellation (Fee: ₹${fee})`,
          recordedBy: req.user.userName || req.user.email || "Operator",
        })
      } catch (err) {
        console.error("Error creating refund payment record:", err)
      }
    }

    await booking.save()
    res.json(booking)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/bookings/:id/payments (Add payment to ledger)
router.post("/:id/payments", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update this booking" })
    }

    const { amount, mode = "Cash", notes = "", type, referenceNo = "" } = req.body
    const numAmount = Math.round(Number(amount) * 100) / 100

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero." })
    }

    const remainingBalance = Math.round((booking.totalAmount - (booking.advanceReceived || 0)) * 100) / 100
    if (numAmount > remainingBalance) {
      return res.status(400).json({
        message: `Payment amount ₹${numAmount} exceeds remaining balance of ₹${remainingBalance}.`,
      })
    }

    const user = await User.findById(req.user.id)
    const receiptPrefix = user?.receiptPrefix || "REC"
    const receiptNo = await getNextReceiptNo(req.user.id, receiptPrefix)

    const paymentType = type || (numAmount >= remainingBalance ? "balance" : "partial")

    const newPayment = new Payment({
      userId: req.user.id,
      bookingId: booking._id,
      receiptNo,
      amount: numAmount,
      type: paymentType,
      paymentMode: mode,
      paymentDate: new Date(),
      referenceNo,
      notes: notes || "",
      recordedBy: req.user.userName || req.user.email || "Operator",
    })
    await newPayment.save()

    const { booking: updatedBooking } = await syncBookingPayments(booking._id, req.user.id)
    res.status(201).json(updatedBooking || booking)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// DELETE /api/bookings/:id (soft delete)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)

    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this booking" })
    }

    booking.deletedAt = new Date()
    await booking.save()
    res.json({ message: "Booking moved to trash", id: booking._id, invoiceNo: booking.invoiceNo })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// PUT /api/bookings/:id/restore (restore soft-deleted booking)
router.put("/:id/restore", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)

    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to restore this booking" })
    }

    booking.deletedAt = null
    await booking.save()
    res.json(booking)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

export default router
