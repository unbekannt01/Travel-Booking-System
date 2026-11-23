import express from "express"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import Payment from "../models/Payment.js"
import Tour from "../models/Tour.js"
import Counter from "../models/Counter.js"
import Customer from "../models/Customer.js"
import { logAudit } from "../models/AuditLog.js"
import { encryptAadhaar, decryptAadhaar, maskAadhaar, validateVerhoeff, isMaskedOrUnchangedAadhaar } from "../utils/aadhaar.js"
import { getNextReceiptNo, syncBookingPayments } from "./payments.js"
import { ensureLegacyInvoiceDocument } from "./documents.js"
import verifyToken from "../middleware/auth.js"
import {
  generateTourCode,
  getMonthCode,
  buildInvoicePrefix,
  calculateNextInvoiceNo,
  getDayBounds,
  validateIndianPhone,
  validateAadhaar,
  calculateCancellationRefund,
  calculatePricing,
} from "../../shared/businessLogic.js"
import { normalizeIndianMobile } from "../../shared/customers.js"
import { assertBooksOpen, BooksLockedError } from "../utils/booksLock.js"

export {
  generateTourCode,
  getMonthCode,
  getDayBounds,
  validateIndianPhone,
  validateAadhaar,
  validateVerhoeff,
}


export const maskBookingPaxAadhaar = (booking) => {
  if (!booking) return booking
  const b = booking.toObject ? booking.toObject() : { ...booking }
  if (Array.isArray(b.passengers)) {
    b.passengers = b.passengers.map((p) => {
      const copy = { ...p }
      const aadharVal = copy.aadhar !== undefined ? copy.aadhar : copy.aadhaar
      const aadharEnc = copy.aadharEncrypted !== undefined ? copy.aadharEncrypted : copy.aadhaarEncrypted
      if (aadharVal) {
        const raw = aadharEnc ? decryptAadhaar(aadharVal) : aadharVal
        copy.aadhar = maskAadhaar(raw)
      }
      return copy
    })
  }
  return b
}

const router = express.Router()

// Generates next unique invoice number for user with customizable prefix using atomic counter
export const getNextInvoiceNo = async (userId, tourName, journeyDate, customPrefix = "YHB") => {
  const prefix = buildInvoicePrefix(customPrefix, tourName, journeyDate)

  let counter = await Counter.findOneAndUpdate(
    { userId, prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )

  if (counter.seq === 1) {
    const existingBookings = await Booking.find({
      userId,
      invoiceNo: { $regex: `^${prefix}` },
    }).select("invoiceNo")

    const existingInvoices = existingBookings.map((b) => b.invoiceNo)
    const nextInvoice = calculateNextInvoiceNo(existingInvoices, prefix)
    const match = nextInvoice.match(/(\d{3,})$/)
    const maxSeq = match ? parseInt(match[1], 10) : 1
    if (maxSeq > 1) {
      counter = await Counter.findOneAndUpdate(
        { userId, prefix },
        { $set: { seq: maxSeq } },
        { new: true }
      )
    }
  }

  return `${prefix}${String(counter.seq).padStart(3, "0")}`
}


// Validates passenger count matches seat count and seat ID row bounds for coach layout
export const validateSeatLayout = (passengers, busType) => {
  if (!passengers || !Array.isArray(passengers)) return null
  const seatIds = passengers.map((p) => p.seatId).filter(Boolean)
  if (seatIds.length === 0) return null

  // Ensure passenger count matches seat count if seats are assigned
  if (seatIds.length !== passengers.length) {
    return {
      status: 400,
      message: `Passenger count (${passengers.length}) must match assigned seat count (${seatIds.length}).`,
    }
  }

  // Validate each seat ID format and bounds if busType is provided
  if (busType) {
    const is2x2 = busType.startsWith("2x2")
    const maxRow = is2x2 ? 5 : 6

    for (const seatId of seatIds) {
      const match = seatId.match(/^(lower|upper)-([LR])(\d+)(?:-(\d+))?$/i)
      if (match) {
        const row = parseInt(match[3], 10)
        if (row < 1 || row > maxRow) {
          return {
            status: 400,
            message: `Seat ${seatId} row ${row} is out of bounds for ${busType} (max row ${maxRow}).`,
          }
        }
      }
    }
  }

  return null
}

// Server authority over pricing: query Tour, compute base amount, discount, and 5% GST
export const computeServerPricing = async ({
  userId,
  tourName,
  passengers,
  discount = 0,
  discountType = "fixed",
  gstRate,
  isTaxInclusive = false,
  baseAmount: clientBaseAmount,
}) => {
  const tour = await Tour.findOne({ name: tourName, userId })
  let baseAmount = 0

  if (tour) {
    if (tour.pricingType === "fixed" || (tour.fixedPrice && !tour.pricingType)) {
      const unitPrice = Number(tour.fixedPrice) || 0
      baseAmount = unitPrice * (passengers?.length || 1)
    } else {
      baseAmount = (passengers || []).reduce((sum, p) => {
        const isUpper =
          p.seatId &&
          (p.seatId.toLowerCase().startsWith("upper") ||
            p.seatId.toLowerCase().startsWith("u") ||
            p.seatId.toLowerCase().includes("-u"))
        const price = isUpper ? Number(tour.upperPrice) || 0 : Number(tour.lowerPrice) || 0
        return sum + price
      }, 0)
    }
  } else {
    baseAmount = Math.max(0, Number(clientBaseAmount) || 0)
  }

  const effectiveGst = gstRate !== undefined ? Number(gstRate) : 5
  const pricing = calculatePricing({
    baseAmount,
    discountType: discountType === "percentage" ? "percentage" : "fixed",
    discountValue: Math.max(0, Number(discount) || 0),
    gstRate: Math.max(0, effectiveGst),
    isTaxInclusive: Boolean(isTaxInclusive),
  })

  return { pricing, tour }
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
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
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
    res.json(maskBookingPaxAadhaar(booking))
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
  }
})

// GET /api/bookings
router.get("/", verifyToken, async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId: req.user.id,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }).sort({ createdAt: -1 })
    res.json(bookings.map(maskBookingPaxAadhaar))
  } catch (error) {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
  }
})

// Non-blocking helper to find or create a Customer record from booking contact info
export async function upsertCustomerForBooking(userId, { contactName, contactPhone, contactEmail }) {
  if (!contactPhone || !userId) return null
  try {
    const { valid, normalized } = normalizeIndianMobile(contactPhone)
    if (!valid || !normalized) return null

    const cleanName = (contactName || "").trim() || "Customer"
    const cleanEmail = (contactEmail || "").trim()

    const customer = await Customer.findOneAndUpdate(
      { userId, phone: normalized, deletedAt: null },
      {
        $setOnInsert: {
          userId,
          phone: normalized,
          name: cleanName,
          email: cleanEmail,
          language: "en",
          tags: [],
          notes: "",
          whatsappOptOut: false,
          aliases: [],
          source: "booking",
          deletedAt: null,
        },
        $addToSet: {
          aliases: cleanName,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    )

    if (customer && customer.aliases && customer.aliases.length > 5) {
      customer.aliases = customer.aliases.slice(0, 5)
      await customer.save().catch(() => {})
    }

    return customer
  } catch (err) {
    console.warn("[CustomerUpsert] Non-blocking customer link failed:", err.name, err.code || "")
    return null
  }
}

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
      isTaxInclusive = false,
      invoiceNo: clientInvoiceNo,
    } = req.body

    // Basic required validations
    if (!contactName || !contactPhone || !tourName || !journeyDate) {
      return res.status(400).json({ message: "Contact name, phone, tour name, and journey date are required." })
    }

    const bookingDate = req.body.date || new Date()
    await assertBooksOpen(req.user.id, bookingDate)

    if (!validateIndianPhone(contactPhone)) {
      return res.status(400).json({ message: "Please provide a valid 10-digit Indian mobile number." })
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

    // Validate seat layout and passenger-seat parity
    const seatLayoutError = validateSeatLayout(passengers, busType)
    if (seatLayoutError) {
      return res.status(seatLayoutError.status).json({ message: seatLayoutError.message })
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

    // Server authority over pricing: query Tour & compute totals, discount, GST
    const { pricing } = await computeServerPricing({
      userId: req.user.id,
      tourName,
      passengers,
      discount,
      discountType,
      gstRate,
      isTaxInclusive,
      baseAmount: req.body.baseAmount || totalAmount,
    })

    const finalServerTotal = pricing.finalTotal
    const numAdvance = Number(advanceReceived || 0)

    if (isNaN(numAdvance) || numAdvance < 0) {
      return res.status(400).json({ message: "Advance payment cannot be negative." })
    }

    if (totalAmount !== undefined && totalAmount !== null) {
      const clientTotal = Math.round(Number(totalAmount) * 100) / 100
      if (Math.abs(clientTotal - finalServerTotal) > 0.05) {
        return res.status(400).json({
          message: `Total amount mismatch: client provided ₹${clientTotal}, but server calculated ₹${finalServerTotal}.`,
        })
      }
    }

    if (numAdvance > finalServerTotal) {
      return res.status(400).json({ message: "Advance payment cannot exceed total amount." })
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

    let linkedCustomer = null
    try {
      linkedCustomer = await upsertCustomerForBooking(req.user.id, {
        contactName,
        contactPhone,
        contactEmail,
      })
    } catch (custErr) {
      console.warn("[CustomerUpsert] Non-blocking customer link failed:", custErr.name, custErr.code || "")
    }

    const newBooking = new Booking({
      invoiceNo: "PENDING",
      customerId: linkedCustomer ? linkedCustomer._id : null,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      tourName,
      journeyDate: normalizedJourneyDate,
      duration: duration || "",
      busType: busType || "",
      contactName,
      contactPhone,
      contactEmail: contactEmail || "",
      paymentMode: paymentMode || "Cash",
      totalAmount: finalServerTotal,
      advanceReceived: numAdvance,
      isPaid: numAdvance >= finalServerTotal && finalServerTotal > 0,
      status: "Confirmed",
      discount: pricing.discountAmount,
      discountType: pricing.discountType,
      gstRate: pricing.gstRate,
      taxAmount: pricing.taxAmount,
      isTaxInclusive: pricing.isTaxInclusive,
      payments: initialPayments,
      passengers: passengers.map((p) => {
        const paxObj = { ...p }
        if (paxObj.aadhar) {
          paxObj.aadhar = encryptAadhaar(paxObj.aadhar)
          paxObj.aadharEncrypted = true
        }
        return paxObj
      }),
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

    // Single code path: Issue tax-invoice IssuedDocument alongside booking
    try {
      const user = req.userDoc || (await User.findById(req.user.id))
      if (user) {
        await ensureLegacyInvoiceDocument(savedBooking, user)
      }
    } catch (docErr) {
      console.error("Warning: Could not create initial IssuedDocument for booking:", docErr.name, docErr.code || "")
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
        await syncBookingPayments(savedBooking._id, req.user.id)
      } catch (payErr) {
        console.error("Warning: Could not create initial Payment ledger record:", payErr.name, payErr.code || "")
      }
    }

    res.status(201).json(maskBookingPaxAadhaar(savedBooking))
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
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

    await assertBooksOpen(req.user.id, booking.date)
    if (req.body.date) {
      await assertBooksOpen(req.user.id, req.body.date)
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
        if (p.aadhar && !isMaskedOrUnchangedAadhaar(p.aadhar)) {
          if (!validateAadhaar(p.aadhar)) {
            return res.status(400).json({ message: `Aadhaar for ${p.name || i + 1} must be a valid 12-digit number.` })
          }
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

    // Validate seat layout and parity
    const seatLayoutError = validateSeatLayout(effectivePassengers, req.body.busType || booking.busType)
    if (seatLayoutError) {
      return res.status(seatLayoutError.status).json({ message: seatLayoutError.message })
    }

    // Recompute server pricing
    const { pricing } = await computeServerPricing({
      userId: req.user.id,
      tourName: effectiveTourName,
      passengers: effectivePassengers,
      discount: req.body.discount !== undefined ? req.body.discount : booking.discount,
      discountType: req.body.discountType || booking.discountType,
      gstRate: req.body.gstRate !== undefined ? req.body.gstRate : booking.gstRate,
      isTaxInclusive: req.body.isTaxInclusive !== undefined ? req.body.isTaxInclusive : booking.isTaxInclusive,
      baseAmount: req.body.baseAmount || req.body.totalAmount || booking.totalAmount,
    })

    if (req.body.totalAmount !== undefined && req.body.totalAmount !== null) {
      const clientTotal = Math.round(Number(req.body.totalAmount) * 100) / 100
      if (Math.abs(clientTotal - pricing.finalTotal) > 0.05) {
        return res.status(400).json({
          message: `Total amount mismatch: client provided ₹${clientTotal}, but server recomputed ₹${pricing.finalTotal}.`,
        })
      }
    }

    // Whitelist allowed fields to update (advanceReceived & isPaid are strictly controlled by payment ledger)
    const allowedFields = [
      "contactName",
      "contactPhone",
      "contactEmail",
      "tourName",
      "duration",
      "busType",
      "paymentMode",
      "status",
      "discount",
      "discountType",
      "gstRate",
      "isTaxInclusive",
      "cancellationCharge",
      "refundAmount",
    ]

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        booking[field] = req.body[field]
      }
    }

    if (req.body.contactPhone || req.body.contactName) {
      try {
        const linkedCustomer = await upsertCustomerForBooking(req.user.id, {
          contactName: booking.contactName,
          contactPhone: booking.contactPhone,
          contactEmail: booking.contactEmail,
        })
        if (linkedCustomer && linkedCustomer._id) {
          booking.customerId = linkedCustomer._id
        }
      } catch (custErr) {
        console.warn("[CustomerUpsert] Non-blocking customer update failed:", custErr.name, custErr.code || "")
      }
    }

    if (Array.isArray(req.body.passengers)) {
      const existingPax = Array.isArray(booking.passengers) ? booking.passengers : []
      const existingPaxById = new Map()
      const existingPaxBySeat = new Map()

      for (const ep of existingPax) {
        if (ep._id) {
          existingPaxById.set(String(ep._id), ep)
        }
        if (ep.seatId) {
          existingPaxBySeat.set(ep.seatId, ep)
        }
      }

      booking.passengers = req.body.passengers.map((p) => {
        const paxObj = { ...p }
        const inputAadhaar = paxObj.aadhar !== undefined ? paxObj.aadhar : paxObj.aadhaar
        const matched =
          (p._id && existingPaxById.get(String(p._id))) ||
          (p.id && existingPaxById.get(String(p.id))) ||
          (p.seatId && existingPaxBySeat.get(p.seatId)) ||
          null

        if (isMaskedOrUnchangedAadhaar(inputAadhaar)) {
          // Preserve existing encrypted Aadhaar if matched passenger already had one
          const matchedAadhaar = matched && (matched.aadhar !== undefined ? matched.aadhar : matched.aadhaar)
          const matchedEnc = matched && (matched.aadharEncrypted !== undefined ? matched.aadharEncrypted : matched.aadhaarEncrypted)
          if (matched && matchedAadhaar) {
            paxObj.aadhar = matchedAadhaar
            paxObj.aadharEncrypted = matchedEnc !== undefined ? matchedEnc : true
          } else {
            paxObj.aadhar = ""
            paxObj.aadharEncrypted = false
          }
        } else if (inputAadhaar && typeof inputAadhaar === "string" && inputAadhaar.trim().length > 0) {
          paxObj.aadhar = encryptAadhaar(inputAadhaar.trim())
          paxObj.aadharEncrypted = true
        } else {
          paxObj.aadhar = ""
          paxObj.aadharEncrypted = false
        }
        delete paxObj.aadhaar
        delete paxObj.aadhaarEncrypted

        return paxObj
      })
    }

    if (req.body.journeyDate !== undefined) {
      const { start } = getDayBounds(req.body.journeyDate)
      booking.journeyDate = start
    }

    booking.totalAmount = pricing.finalTotal
    booking.discount = pricing.discountAmount
    booking.discountType = pricing.discountType
    booking.gstRate = pricing.gstRate
    booking.taxAmount = pricing.taxAmount
    booking.isTaxInclusive = pricing.isTaxInclusive

    await booking.save()
    const { booking: syncedBooking } = await syncBookingPayments(booking._id, req.user.id)
    res.json(maskBookingPaxAadhaar(syncedBooking || booking))
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
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

    await assertBooksOpen(req.user.id, booking.date)

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

    res.json(maskBookingPaxAadhaar(booking))
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

    await assertBooksOpen(req.user.id, booking.date)

    const { checkedIn } = req.body
    const newState = checkedIn !== false // default to true if not explicitly false

    for (const p of booking.passengers) {
      p.checkedIn = newState
    }

    await booking.save()
    res.json(maskBookingPaxAadhaar(booking))
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
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

    await assertBooksOpen(req.user.id, booking.date)

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

    const incomingAadhar = aadhar !== undefined ? aadhar : req.body.aadhaar
    if (incomingAadhar !== undefined) {
      if (isMaskedOrUnchangedAadhaar(incomingAadhar)) {
        // Retain existing encrypted Aadhaar if present
      } else if (typeof incomingAadhar === "string" && incomingAadhar.trim().length > 0) {
        if (!validateAadhaar(incomingAadhar)) {
          return res.status(400).json({ message: "Aadhaar must be a 12-digit number" })
        }
        passenger.aadhar = encryptAadhaar(incomingAadhar.trim())
        passenger.aadharEncrypted = true
      } else {
        passenger.aadhar = ""
        passenger.aadharEncrypted = false
      }
      delete passenger.aadhaar
      delete passenger.aadhaarEncrypted
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
    res.json(maskBookingPaxAadhaar(booking))
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(400).json({ message: error.message })
  }
})

// PUT /api/bookings/:bookingId/toggle-payment
router.put("/:bookingId/toggle-payment", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)

    if (!booking) return res.status(404).json({ message: "Booking not found" })
    if (booking.userId.toString() !== req.user.id) return res.status(403).json({ message: "Unauthorized" })

    await assertBooksOpen(req.user.id, booking.date)

    booking.isPaid = !booking.isPaid
    if (booking.isPaid) {
      booking.advanceReceived = booking.totalAmount
    }

    await booking.save()
    res.json(maskBookingPaxAadhaar(booking))
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
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

    await assertBooksOpen(req.user.id, booking.date)
    await assertBooksOpen(req.user.id, new Date())

    const { reason, cancellationCharge, refundPaymentMode = "Cash" } = req.body
    const totalPaid = Math.round((booking.advanceReceived || 0) * 100) / 100
    let calc
    try {
      calc = calculateCancellationRefund({ totalPaid, cancellationCharge })
    } catch (calcErr) {
      return res.status(400).json({ message: calcErr.message })
    }

    const fee = calc.cancellationCharge
    const refundAmount = calc.refundAmount

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
        await syncBookingPayments(booking._id, req.user.id)

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
        console.error("Error creating refund payment record:", err.name, err.code || "")
      }
    }

    await booking.save()

    await logAudit({
      userId: req.user.id,
      action: "BOOKING_CANCELLED",
      req,
      meta: { bookingId: booking._id, invoiceNo: booking.invoiceNo, refundAmount },
    })

    res.json(maskBookingPaxAadhaar(booking))
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
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

    await assertBooksOpen(req.user.id, booking.date)
    if (req.body.date) {
      await assertBooksOpen(req.user.id, req.body.date)
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
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
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

    await assertBooksOpen(req.user.id, booking.date)

    booking.deletedAt = new Date()
    await booking.save()
    res.json({ message: "Booking moved to trash", id: booking._id, invoiceNo: booking.invoiceNo })
  } catch (error) {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
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

    await assertBooksOpen(req.user.id, booking.date)

    booking.deletedAt = null
    await booking.save()
    res.json(maskBookingPaxAadhaar(booking))
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
  }
})


// GET /api/bookings/:id/passengers/:paxId/reveal-aadhaar (SEC-012)
router.get("/:id/passengers/:paxId/reveal-aadhaar", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.id })
    if (!booking) return res.status(404).json({ message: "Booking not found" })

    let passenger = booking.passengers.id(req.params.paxId)
    if (!passenger && /^\d+$/.test(req.params.paxId)) {
      passenger = booking.passengers[parseInt(req.params.paxId, 10)]
    }

    if (!passenger) return res.status(404).json({ message: "Passenger not found" })

    const aadharVal = passenger.aadhar !== undefined ? passenger.aadhar : passenger.aadhaar
    const aadharEnc = passenger.aadharEncrypted !== undefined ? passenger.aadharEncrypted : passenger.aadhaarEncrypted
    const rawAadhaar = aadharEnc ? decryptAadhaar(aadharVal) : aadharVal

    await logAudit({
      userId: req.user.id,
      action: "AADHAAR_REVEALED",
      req,
      meta: {
        bookingId: booking._id,
        invoiceNo: booking.invoiceNo,
        passengerId: passenger._id,
        passengerName: passenger.name,
      },
    })

    res.json({
      success: true,
      passengerId: passenger._id,
      seatId: passenger.seatId,
      name: passenger.name,
      aadhar: rawAadhaar,
      aadhaar: rawAadhaar,
      maskedAadhaar: maskAadhaar(rawAadhaar),
      maskedAadhar: maskAadhaar(rawAadhaar),
    })
  } catch (error) {
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
  }
})

export default router
