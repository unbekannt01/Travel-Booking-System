import express from "express"
import rateLimit from "express-rate-limit"
import CashEntry from "../models/CashEntry.js"
import CashBookSetup from "../models/CashBookSetup.js"
import BooksClose from "../models/BooksClose.js"
import Booking from "../models/Booking.js"
import Payment from "../models/Payment.js"
import Expense from "../models/Expense.js"
import { logAudit } from "../models/AuditLog.js"
import verifyToken from "../middleware/auth.js"
import {
  getEffectiveLockDate,
  assertBooksOpen,
  verifyStepUpAuth,
  BooksLockedError,
} from "../utils/booksLock.js"
import {
  buildDayBook,
  computeClosePreview,
  validateManualEntry,
  toDateString,
  round2,
} from "../../shared/cashbook.js"
import recordHistory from "../utils/recordHistory.js"

const router = express.Router()

const cashbookWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many cash book operations. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

const closeStepUpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: "Too many day close / reopen attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

// Central helper to fetch all records needed for buildDayBook
async function fetchDayBookDependencies(userId) {
  const [setup, latestActiveClose, bookings, payments, expenses, manualEntries] =
    await Promise.all([
      CashBookSetup.findOne({ userId }).lean(),
      BooksClose.findOne({ userId, status: "active" }).sort({ closedUpTo: -1 }).lean(),
      Booking.find({ userId, deletedAt: null }).lean(),
      Payment.find({ userId, isVoid: false })
        .populate("bookingId", "invoiceNo tourName contactName contactPhone deletedAt")
        .lean(),
      Expense.find({ userId, deletedAt: null, status: "paid" }).lean(),
      CashEntry.find({ userId, deletedAt: null }).lean(),
    ])

  // Exclude payments that belong to soft-deleted bookings
  const activePayments = payments.filter((p) => {
    if (!p.bookingId) return true
    return p.bookingId.deletedAt === null || p.bookingId.deletedAt === undefined
  })

  return {
    setup,
    latestActiveClose,
    bookings,
    payments: activePayments,
    expenses,
    manualEntries,
  }
}

/**
 * GET /api/cashbook
 * Query: startDate, endDate, account
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const todayStr = toDateString(new Date())
    const startDate = req.query.startDate ? toDateString(req.query.startDate) : todayStr
    const endDate = req.query.endDate ? toDateString(req.query.endDate) : startDate
    const accountFilter = req.query.account || "all"

    const { setup, latestActiveClose, bookings, payments, expenses, manualEntries } =
      await fetchDayBookDependencies(req.user.id)

    const dayBook = buildDayBook({
      startDate,
      endDate,
      setup,
      bookings,
      payments,
      expenses,
      manualEntries,
    })

    // If account filter is specified, filter entries while keeping summaries intact
    let filteredEntries = dayBook.entries
    if (accountFilter === "cash") {
      filteredEntries = dayBook.entries.filter(
        (e) => e.account === "cash" || e.type.startsWith("transfer-"),
      )
    } else if (accountFilter === "bank") {
      filteredEntries = dayBook.entries.filter(
        (e) => e.account === "bank" || e.type.startsWith("transfer-"),
      )
    }

    const lockDate = latestActiveClose ? latestActiveClose.closedUpTo : null

    // Mark locked state on each entry
    const entriesWithLock = filteredEntries.map((e) => ({
      ...e,
      isLocked: Boolean(lockDate && e.date <= lockDate),
    }))

    res.json({
      dayBook: {
        ...dayBook,
        entries: entriesWithLock,
      },
      lockDate,
      setup,
      lastClose: latestActiveClose,
    })
  } catch (error) {
    console.error("GET /api/cashbook error:", error)
    res.status(500).json({ message: error.message || "Failed to load cash book data." })
  }
})

/**
 * GET /api/cashbook/setup
 */
router.get("/setup", verifyToken, async (req, res) => {
  try {
    const [setup, latestActiveClose] = await Promise.all([
      CashBookSetup.findOne({ userId: req.user.id }).lean(),
      BooksClose.findOne({ userId: req.user.id, status: "active" }).select("_id").lean(),
    ])

    res.json({
      setup: setup || {
        cashOpening: 0,
        bankOpening: 0,
        asOfDate: "2026-01-01",
        notes: "",
      },
      isEditable: !latestActiveClose,
    })
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch setup." })
  }
})

/**
 * PUT /api/cashbook/setup
 */
router.put("/setup", verifyToken, cashbookWriteLimiter, async (req, res) => {
  try {
    const activeClose = await BooksClose.findOne({
      userId: req.user.id,
      status: "active",
    }).lean()

    if (activeClose) {
      return res.status(400).json({
        message:
          "Opening balance setup is locked because active books closes exist. Reopen existing closes before changing setup.",
      })
    }

    const { cashOpening = 0, bankOpening = 0, asOfDate, notes = "" } = req.body

    const cleanCash = round2(Number(cashOpening) || 0)
    const cleanBank = round2(Number(bankOpening) || 0)
    const cleanDate = toDateString(asOfDate)

    if (cleanCash < 0 || cleanBank < 0) {
      return res.status(400).json({ message: "Opening balances cannot be negative." })
    }
    if (!cleanDate) {
      return res.status(400).json({ message: "A valid as-of date (YYYY-MM-DD) is required." })
    }

    const updated = await CashBookSetup.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          cashOpening: cleanCash,
          bankOpening: cleanBank,
          asOfDate: cleanDate,
          notes: String(notes || "").slice(0, 300),
          updatedBy: req.user.id,
        },
      },
      { upsert: true, new: true },
    )

    await logAudit({
      userId: req.user.id,
      action: "CASHBOOK_SETUP_UPDATED",
      req,
      details: { cashOpening: cleanCash, bankOpening: cleanBank, asOfDate: cleanDate },
    })

    res.json(updated)
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to save setup." })
  }
})

/**
 * POST /api/cashbook/entries (Add manual cash/bank entry)
 */
router.post("/entries", verifyToken, cashbookWriteLimiter, async (req, res) => {
  try {
    const { type, amount, account = "cash", date, voucherNo, referenceNo, partyName, notes } =
      req.body

    const cleanDate = toDateString(date)
    await assertBooksOpen(req.user.id, cleanDate)

    const validation = validateManualEntry({
      type,
      amount,
      account,
      date: cleanDate,
      notes,
    })

    if (!validation.valid) {
      return res.status(400).json({
        message: `Validation failed: ${validation.errors.join(", ")}`,
        errors: validation.errors,
      })
    }

    let direction = "debit"
    if (type === "owner-in" || type === "transfer-to-cash") {
      direction = "credit"
    } else if (type === "adjustment") {
      direction = req.body.direction === "credit" ? "credit" : "debit"
    }

    const entry = new CashEntry({
      userId: req.user.id,
      date: new Date(`${cleanDate}T12:00:00.000Z`),
      type,
      account,
      amount: round2(amount),
      direction,
      voucherNo: String(voucherNo || "").trim(),
      referenceNo: String(referenceNo || "").trim(),
      partyName: String(partyName || "").trim(),
      notes: String(notes || "").trim(),
      createdBy: req.user.id,
    })

    await entry.save()

    await recordHistory({
      userId: req.user.id,
      entityType: "cashEntry",
      entityId: entry._id,
      action: "created",
      user: req.user,
    })

    res.status(201).json(entry)
  } catch (error) {
    if (error instanceof BooksLockedError) {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(400).json({ message: error.message || "Failed to create entry." })
  }
})

/**
 * PUT /api/cashbook/entries/:id (Update manual entry)
 */
router.put("/entries/:id", verifyToken, cashbookWriteLimiter, async (req, res) => {
  try {
    const entry = await CashEntry.findOne({
      _id: req.params.id,
      userId: req.user.id,
      deletedAt: null,
    })

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" })
    }

    const before = entry.toObject()

    // Check existing date
    await assertBooksOpen(req.user.id, entry.date)

    const targetDate = req.body.date ? toDateString(req.body.date) : toDateString(entry.date)
    await assertBooksOpen(req.user.id, targetDate)

    const validation = validateManualEntry({
      type: req.body.type || entry.type,
      amount: req.body.amount !== undefined ? req.body.amount : entry.amount,
      account: req.body.account || entry.account,
      date: targetDate,
      notes: req.body.notes !== undefined ? req.body.notes : entry.notes,
    })

    if (!validation.valid) {
      return res.status(400).json({
        message: `Validation failed: ${validation.errors.join(", ")}`,
        errors: validation.errors,
      })
    }

    if (req.body.type) entry.type = req.body.type
    if (req.body.amount !== undefined) entry.amount = round2(req.body.amount)
    if (req.body.account) entry.account = req.body.account
    if (req.body.date) entry.date = new Date(`${targetDate}T12:00:00.000Z`)
    if (req.body.direction) entry.direction = req.body.direction
    if (req.body.voucherNo !== undefined) entry.voucherNo = String(req.body.voucherNo).trim()
    if (req.body.referenceNo !== undefined) entry.referenceNo = String(req.body.referenceNo).trim()
    if (req.body.partyName !== undefined) entry.partyName = String(req.body.partyName).trim()
    if (req.body.notes !== undefined) entry.notes = String(req.body.notes).trim()
    entry.updatedBy = req.user.id

    await entry.save()

    await recordHistory({
      userId: req.user.id,
      entityType: "cashEntry",
      entityId: entry._id,
      action: "updated",
      before,
      after: entry.toObject(),
      user: req.user,
    })

    res.json(entry)
  } catch (error) {
    if (error instanceof BooksLockedError) {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(400).json({ message: error.message || "Failed to update entry." })
  }
})

/**
 * DELETE /api/cashbook/entries/:id (Soft delete manual entry)
 */
router.delete("/entries/:id", verifyToken, cashbookWriteLimiter, async (req, res) => {
  try {
    const entry = await CashEntry.findOne({
      _id: req.params.id,
      userId: req.user.id,
      deletedAt: null,
    })

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" })
    }

    await assertBooksOpen(req.user.id, entry.date)

    entry.deletedAt = new Date()
    entry.deletedBy = req.user.id
    await entry.save()

    await recordHistory({
      userId: req.user.id,
      entityType: "cashEntry",
      entityId: entry._id,
      action: "deleted",
      user: req.user,
    })

    res.json({ message: "Entry deleted successfully", id: entry._id })
  } catch (error) {
    if (error instanceof BooksLockedError) {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    res.status(400).json({ message: error.message || "Failed to delete entry." })
  }
})

/**
 * GET /api/cashbook/close/preview
 * Query: asOfDate, countedCash
 */
router.get("/close/preview", verifyToken, async (req, res) => {
  try {
    const asOfDate = toDateString(req.query.asOfDate)
    if (!asOfDate) {
      return res.status(400).json({ message: "asOfDate query parameter is required." })
    }

    const countedCash = Number(req.query.countedCash)
    if (isNaN(countedCash) || countedCash < 0) {
      return res.status(400).json({ message: "countedCash query parameter must be a non-negative number." })
    }

    const { setup, bookings, payments, expenses, manualEntries } =
      await fetchDayBookDependencies(req.user.id)

    const dayBook = buildDayBook({
      startDate: asOfDate,
      endDate: asOfDate,
      setup,
      bookings,
      payments,
      expenses,
      manualEntries,
    })

    const preview = computeClosePreview({
      asOfDate,
      countedCash,
      dayBook,
    })

    res.json({ preview, dayBook })
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to generate close preview." })
  }
})

/**
 * POST /api/cashbook/close (Close Books for a Day with Step-Up Auth)
 */
router.post("/close", verifyToken, closeStepUpLimiter, async (req, res) => {
  try {
    const { asOfDate, countedCash, password, totpToken, notes, autoAdjust = false } = req.body

    const cleanDate = toDateString(asOfDate)
    if (!cleanDate) {
      return res.status(400).json({ message: "asOfDate (YYYY-MM-DD) is required." })
    }

    const todayStr = toDateString(new Date())
    if (cleanDate > todayStr) {
      return res.status(400).json({ message: "Cannot close books for future dates." })
    }

    const latestActiveClose = await BooksClose.findOne({
      userId: req.user.id,
      status: "active",
    })
      .sort({ closedUpTo: -1 })
      .lean()

    if (latestActiveClose && cleanDate <= latestActiveClose.closedUpTo) {
      return res.status(400).json({
        message: `Books are already closed up to ${latestActiveClose.closedUpTo}. Next close date must be after this date.`,
      })
    }

    // Step-up authentication
    const authResult = await verifyStepUpAuth({
      userId: req.user.id,
      password,
      totpToken,
    })

    if (!authResult.verified) {
      return res.status(401).json({ message: authResult.reason })
    }

    const cleanCounted = round2(Number(countedCash) || 0)
    if (cleanCounted < 0) {
      return res.status(400).json({ message: "Counted cash cannot be negative." })
    }

    // Fetch dependencies and compute daybook
    const { setup, bookings, payments, expenses, manualEntries } =
      await fetchDayBookDependencies(req.user.id)

    let currentManualEntries = [...manualEntries]
    let dayBook = buildDayBook({
      startDate: cleanDate,
      endDate: cleanDate,
      setup,
      bookings,
      payments,
      expenses,
      manualEntries: currentManualEntries,
    })

    let preview = computeClosePreview({
      asOfDate: cleanDate,
      countedCash: cleanCounted,
      dayBook,
    })

    let adjustmentEntry = null

    // If autoAdjust is requested and difference is non-zero, create an adjustment entry
    if (autoAdjust && preview.suggestedAdjustment) {
      const adj = preview.suggestedAdjustment
      adjustmentEntry = new CashEntry({
        userId: req.user.id,
        date: new Date(`${cleanDate}T12:00:00.000Z`),
        type: "adjustment",
        account: adj.account,
        amount: adj.amount,
        direction: adj.direction,
        notes: adj.notes,
        isAutoAdjustment: true,
        createdBy: req.user.id,
      })
      await adjustmentEntry.save()

      // Re-run dayBook with the new adjustment entry
      currentManualEntries.push(adjustmentEntry.toObject())
      dayBook = buildDayBook({
        startDate: cleanDate,
        endDate: cleanDate,
        setup,
        bookings,
        payments,
        expenses,
        manualEntries: currentManualEntries,
      })

      preview = computeClosePreview({
        asOfDate: cleanDate,
        countedCash: cleanCounted,
        dayBook,
      })
    }

    const booksClose = new BooksClose({
      userId: req.user.id,
      closedUpTo: cleanDate,
      systemCash: dayBook.closing.cash,
      systemBank: dayBook.closing.bank,
      countedCash: cleanCounted,
      difference: preview.difference,
      status: "active",
      notes: String(notes || "").trim(),
      adjustmentEntryId: adjustmentEntry ? adjustmentEntry._id : null,
      closedBy: req.user.id,
    })

    await booksClose.save()

    if (adjustmentEntry) {
      adjustmentEntry.closeId = booksClose._id
      await adjustmentEntry.save()
    }

    await logAudit({
      userId: req.user.id,
      action: "BOOKS_CLOSED",
      req,
      details: {
        closedUpTo: cleanDate,
        systemCash: dayBook.closing.cash,
        systemBank: dayBook.closing.bank,
        countedCash: cleanCounted,
        difference: preview.difference,
        adjustmentCreated: Boolean(adjustmentEntry),
      },
    })

    res.status(201).json({
      success: true,
      close: booksClose,
      dayBook,
    })
  } catch (error) {
    console.error("POST /api/cashbook/close error:", error)
    res.status(500).json({ message: error.message || "Failed to close day." })
  }
})

/**
 * POST /api/cashbook/reopen (Reopen last closed day with Step-Up Auth)
 */
router.post("/reopen", verifyToken, closeStepUpLimiter, async (req, res) => {
  try {
    const { password, totpToken, reason } = req.body

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        message: "A meaningful reason (minimum 5 characters) is required to reopen closed books.",
      })
    }

    // Step-up authentication
    const authResult = await verifyStepUpAuth({
      userId: req.user.id,
      password,
      totpToken,
    })

    if (!authResult.verified) {
      return res.status(401).json({ message: authResult.reason })
    }

    // Find the latest active close
    const latestActiveClose = await BooksClose.findOne({
      userId: req.user.id,
      status: "active",
    }).sort({ closedUpTo: -1 })

    if (!latestActiveClose) {
      return res.status(400).json({ message: "No active books close found to reopen." })
    }

    latestActiveClose.status = "reopened"
    latestActiveClose.reopenedAt = new Date()
    latestActiveClose.reopenedBy = req.user.id
    latestActiveClose.reopenReason = reason.trim()

    // If an auto adjustment entry was created during this close, soft delete it
    if (latestActiveClose.adjustmentEntryId) {
      await CashEntry.updateOne(
        { _id: latestActiveClose.adjustmentEntryId },
        { $set: { deletedAt: new Date(), deletedBy: req.user.id } },
      )
    }

    await latestActiveClose.save()

    await logAudit({
      userId: req.user.id,
      action: "BOOKS_REOPENED",
      req,
      meta: {
        closedUpTo: latestActiveClose.closedUpTo,
        reasonLength: reason.trim().length,
      },
    })

    // Fetch the new latest active lock date (if any earlier close exists)
    const newLockDate = await getEffectiveLockDate(req.user.id)

    res.json({
      success: true,
      message: `Day close for ${latestActiveClose.closedUpTo} reopened successfully.`,
      reopenedClose: latestActiveClose,
      newLockDate,
    })
  } catch (error) {
    console.error("POST /api/cashbook/reopen error:", error)
    res.status(500).json({ message: error.message || "Failed to reopen day." })
  }
})

export default router
