import express from "express"
import Payment from "../models/Payment.js"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import verifyToken from "../middleware/auth.js"

const router = express.Router()

// Helper: Generate next receipt number e.g. REC-2609-001
export const getNextReceiptNo = async (userId, customPrefix = "REC") => {
  const now = new Date()
  const year = String(now.getFullYear()).slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const prefix = `${customPrefix.toUpperCase()}-${year}${month}-`

  const existingPayments = await Payment.find({
    userId,
    receiptNo: { $regex: `^${prefix}` },
  }).select("receiptNo")

  let maxSerial = 0
  for (const p of existingPayments) {
    const parts = p.receiptNo.split("-")
    const serial = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(serial) && serial > maxSerial) {
      maxSerial = serial
    }
  }

  const nextSerial = maxSerial + 1
  return `${prefix}${String(nextSerial).padStart(3, "0")}`
}

// Recalculate booking financials from payment ledger
export const syncBookingPayments = async (bookingId, userId) => {
  const payments = await Payment.find({
    bookingId,
    userId,
    isVoid: false,
  })

  let totalReceived = 0
  for (const p of payments) {
    if (p.type === "refund") {
      totalReceived -= p.amount
    } else {
      totalReceived += p.amount
    }
  }

  // Ensure advanceReceived doesn't drop below 0
  totalReceived = Math.max(0, Math.round(totalReceived * 100) / 100)

  const booking = await Booking.findOne({ _id: bookingId, userId })
  if (booking) {
    booking.advanceReceived = totalReceived
    booking.isPaid = booking.advanceReceived >= booking.totalAmount
    // Also keep the embedded payments array in sync for backward compatibility
    booking.payments = payments.map((p) => ({
      amount: p.type === "refund" ? -p.amount : p.amount,
      date: p.paymentDate,
      mode: p.paymentMode,
      notes: p.isVoid ? `[VOIDED] ${p.notes}` : p.notes,
      recordedBy: p.recordedBy,
    }))
    await booking.save()
  }
  return { booking, totalReceived }
}

// GET /api/payments?bookingId=...
router.get("/", verifyToken, async (req, res) => {
  try {
    const query = { userId: req.user.id }
    if (req.query.bookingId) {
      query.bookingId = req.query.bookingId
    }

    const payments = await Payment.find(query)
      .populate("bookingId", "invoiceNo tourName journeyDate contactName contactPhone")
      .sort({ createdAt: -1 })

    res.json(payments)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// POST /api/payments
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      bookingId,
      amount,
      paymentMode = "Cash",
      type = "partial",
      referenceNo = "",
      notes = "",
    } = req.body

    const numAmount = Math.round(Number(amount) * 100) / 100
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero." })
    }

    const booking = await Booking.findOne({ _id: bookingId, userId: req.user.id })
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." })
    }

    // Check remaining balance for non-refund payments
    if (type !== "refund") {
      const remaining = Math.round((booking.totalAmount - (booking.advanceReceived || 0)) * 100) / 100
      if (numAmount > remaining) {
        return res.status(400).json({
          message: `Payment amount ₹${numAmount} exceeds remaining balance of ₹${remaining}.`,
        })
      }
    }

    const user = await User.findById(req.user.id)
    const receiptPrefix = user?.receiptPrefix || "REC"

    // Retry loop for receiptNo collision
    let newPayment = null
    let attempts = 0
    while (attempts < 5) {
      attempts++
      try {
        const receiptNo = await getNextReceiptNo(req.user.id, receiptPrefix)
        newPayment = new Payment({
          userId: req.user.id,
          bookingId: booking._id,
          receiptNo,
          amount: numAmount,
          type,
          paymentMode,
          paymentDate: new Date(),
          referenceNo,
          notes,
          recordedBy: req.user.userName || req.user.email || "Operator",
        })
        await newPayment.save()
        break
      } catch (err) {
        if (err.code === 11000 && err.keyPattern && err.keyPattern.receiptNo) {
          continue
        }
        throw err
      }
    }

    if (!newPayment) {
      return res.status(500).json({ message: "Failed to generate a unique receipt number. Please try again." })
    }

    // Sync booking
    const { booking: updatedBooking } = await syncBookingPayments(booking._id, req.user.id)

    res.status(201).json({
      payment: newPayment,
      booking: updatedBooking,
    })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// POST /api/payments/:id/void
router.post("/:id/void", verifyToken, async (req, res) => {
  try {
    const { reason = "Voided by operator" } = req.body

    const payment = await Payment.findOne({ _id: req.params.id, userId: req.user.id })
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found." })
    }

    if (payment.isVoid) {
      return res.status(400).json({ message: "This payment has already been voided." })
    }

    payment.isVoid = true
    payment.voidReason = reason
    payment.voidedAt = new Date()
    payment.voidedBy = req.user.userName || req.user.email || "Operator"
    await payment.save()

    // Recalculate booking totals
    const { booking: updatedBooking } = await syncBookingPayments(payment.bookingId, req.user.id)

    res.json({
      payment,
      booking: updatedBooking,
      message: "Payment voided successfully.",
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

export default router
