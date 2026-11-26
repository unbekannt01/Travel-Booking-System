import express from "express"
import Payment from "../models/Payment.js"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import Counter from "../models/Counter.js"
import { logAudit } from "../models/AuditLog.js"
import verifyToken from "../middleware/auth.js"
import {
  buildReceiptPrefix,
  calculateNextReceiptNo,
  computeLedgerTotals,
} from "../../shared/businessLogic.js"
import { assertBooksOpen, BooksLockedError } from "../utils/booksLock.js"

const router = express.Router()

// Helper: Generate next receipt number e.g. REC-2609-001
export const getNextReceiptNo = async (userId, customPrefix = "REC", date = new Date()) => {
  const prefix = buildReceiptPrefix(customPrefix, date)

  let counter = await Counter.findOneAndUpdate(
    { userId, prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )

  if (counter.seq === 1) {
    const existingPayments = await Payment.find({
      userId,
      receiptNo: { $regex: `^${prefix}` },
    }).select("receiptNo")

    const nextReceipt = calculateNextReceiptNo(existingPayments.map((p) => p.receiptNo), prefix)
    const parts = nextReceipt.split("-")
    const maxSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(maxSeq) && maxSeq > 1) {
      counter = await Counter.findOneAndUpdate(
        { userId, prefix },
        { $set: { seq: maxSeq } },
        { new: true }
      )
    }
  }

  return `${prefix}${String(counter.seq).padStart(3, "0")}`
}

// Recalculate booking financials from payment ledger
export const syncBookingPayments = async (bookingId, userId) => {
  const payments = await Payment.find({
    bookingId,
    userId,
    isVoid: false,
  })

  const booking = await Booking.findOne({ _id: bookingId, userId })
  const { advanceReceived, totalReceived } = computeLedgerTotals(payments, booking?.totalAmount || 0)
  const received = advanceReceived !== undefined ? advanceReceived : (totalReceived || 0)

  if (booking) {
    booking.advanceReceived = received
    booking.isPaid = (booking.totalAmount || 0) > 0 && received >= (booking.totalAmount || 0)
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
  return { booking, totalReceived: received, advanceReceived: received }
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
    res.status(500).json({ message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message })
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

    const targetDate = req.body.paymentDate || new Date()
    await assertBooksOpen(req.user.id, targetDate)

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

// POST /api/payments/:id/void
router.post("/:id/void", verifyToken, async (req, res) => {
  try {
    const { reason = "Voided by operator" } = req.body

    const payment = await Payment.findOne({ _id: req.params.id, userId: req.user.id })
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found." })
    }

    await assertBooksOpen(req.user.id, payment.paymentDate)
    await assertBooksOpen(req.user.id, new Date())

    if (payment.isVoid) {
      return res.status(400).json({ message: "This payment has already been voided." })
    }

    payment.isVoid = true
    payment.voidReason = reason
    payment.voidedAt = new Date()
    payment.voidedBy = req.user.userName || req.user.email || "Operator"
    await payment.save()

    await logAudit({
      userId: req.user.id,
      action: "PAYMENT_VOIDED",
      req,
      meta: { paymentId: payment._id, receiptNo: payment.receiptNo, amount: payment.amount },
    })

    // Recalculate booking totals
    const { booking: updatedBooking } = await syncBookingPayments(payment.bookingId, req.user.id)

    res.json({
      payment,
      booking: updatedBooking,
      message: "Payment voided successfully.",
    })
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

export default router
