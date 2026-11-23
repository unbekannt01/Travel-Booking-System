import express from "express"
import rateLimit from "express-rate-limit"
import verifyToken from "../middleware/auth.js"
import Booking from "../models/Booking.js"
import Expense from "../models/Expense.js"
import Customer from "../models/Customer.js"
import CashEntry from "../models/CashEntry.js"
import Payment from "../models/Payment.js"
import { logAudit } from "../models/AuditLog.js"
import recordHistory from "../utils/recordHistory.js"
import { getEffectiveLockDate, formatLockDateDisplay } from "../utils/booksLock.js"
import { classifyRestore, HISTORY_ENTITIES } from "../../shared/history.js"

const router = express.Router()

const trashLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { message: "Too many trash requests. Please try again later." },
})

const getModelForType = (type) => {
  switch (type) {
    case "booking":
      return Booking
    case "expense":
      return Expense
    case "customer":
      return Customer
    case "cashEntry":
      return CashEntry
    default:
      return null
  }
}

/**
 * GET /api/trash
 * Lists soft-deleted items across entities with restore eligibility evaluation.
 */
router.get("/", verifyToken, trashLimiter, async (req, res) => {
  try {
    const { type = "all", q = "", page = 1, limit = 25 } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25))
    const userId = req.user.id

    const lockDate = await getEffectiveLockDate(userId)

    // Compute counts across all 4 types in parallel
    const [bookingCount, expenseCount, customerCount, cashEntryCount] = await Promise.all([
      Booking.countDocuments({ userId, deletedAt: { $ne: null } }),
      Expense.countDocuments({ userId, deletedAt: { $ne: null } }),
      Customer.countDocuments({ userId, deletedAt: { $ne: null } }),
      CashEntry.countDocuments({ userId, deletedAt: { $ne: null } }),
    ])

    const counts = {
      all: bookingCount + expenseCount + customerCount + cashEntryCount,
      booking: bookingCount,
      expense: expenseCount,
      customer: customerCount,
      cashEntry: cashEntryCount,
    }

    const typesToFetch = type === "all" ? HISTORY_ENTITIES : [type].filter((t) => HISTORY_ENTITIES.includes(t))

    let allItems = []

    // Fetch items per requested type
    for (const t of typesToFetch) {
      const Model = getModelForType(t)
      if (!Model) continue

      const filter = { userId, deletedAt: { $ne: null } }
      if (q && q.trim()) {
        const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        if (t === "booking") {
          filter.$or = [{ invoiceNo: regex }, { contactName: regex }, { contactPhone: regex }, { tourName: regex }]
        } else if (t === "expense") {
          filter.$or = [{ vendor: regex }, { notes: regex }, { category: regex }, { invoiceRef: regex }]
        } else if (t === "customer") {
          filter.$or = [{ name: regex }, { phone: regex }, { city: regex }]
        } else if (t === "cashEntry") {
          filter.$or = [{ partyName: regex }, { notes: regex }, { voucherNo: regex }]
        }
      }

      const docs = await Model.find(filter).sort({ deletedAt: -1 }).lean()

      for (const doc of docs) {
        let conflicts = {}

        if (t === "customer") {
          // Check if active customer exists with the same phone
          const activeWithPhone = await Customer.findOne({
            userId,
            phone: doc.phone,
            deletedAt: null,
          }).select("_id").lean()
          if (activeWithPhone) {
            conflicts.phoneConflict = true
            conflicts.numberConflict = true
          }
        } else if (t === "booking") {
          // Check if active booking exists with the same invoiceNo
          if (doc.invoiceNo) {
            const activeInvoice = await Booking.findOne({
              userId,
              invoiceNo: doc.invoiceNo,
              deletedAt: null,
            }).select("_id").lean()
            if (activeInvoice) {
              conflicts.numberConflict = true
            }
          }
          // Fetch any active payments linked to this booking to evaluate lockDate
          const bookingPayments = await Payment.find({
            userId,
            bookingId: doc._id,
            isVoid: false,
          }).select("paymentDate").lean()
          doc.payments = bookingPayments
        }

        const restoreEval = classifyRestore({
          entity: t,
          record: doc,
          lockDate,
          conflicts,
        })

        let title = ""
        let subtitle = ""
        let amount = null
        let itemDate = doc.date || doc.createdAt

        if (t === "booking") {
          title = `Booking #${doc.invoiceNo || "N/A"} (${doc.tourName || "Custom Tour"})`
          subtitle = `${doc.contactName || "Traveler"} • ${doc.contactPhone || ""}`
          amount = doc.totalAmount
        } else if (t === "expense") {
          title = `Expense: ${doc.category || "General"} — ${doc.vendor || "Unknown Vendor"}`
          subtitle = `Status: ${doc.status} | Mode: ${doc.paymentMode || "Cash"}`
          amount = doc.amount
          itemDate = doc.paidOn || doc.date
        } else if (t === "customer") {
          title = `Customer: ${doc.name || "Customer"}`
          subtitle = `${doc.phone || ""} • ${doc.city || "No City"}`
          amount = null
        } else if (t === "cashEntry") {
          title = `Cash Entry: ${doc.type}`
          subtitle = `${doc.account === "cash" ? "Cash" : "Bank"} • ${doc.partyName || "N/A"}`
          amount = doc.amount
        }

        allItems.push({
          _id: doc._id.toString(),
          type: t,
          deletedAt: doc.deletedAt,
          title,
          subtitle,
          amount,
          date: itemDate,
          restore: restoreEval,
          raw: doc,
        })
      }
    }

    // Sort all combined items by deletedAt descending
    allItems.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())

    const total = allItems.length
    const totalPages = Math.ceil(total / limitNum) || 1
    const paginatedItems = allItems.slice((pageNum - 1) * limitNum, pageNum * limitNum)

    res.json({
      items: paginatedItems,
      total,
      page: pageNum,
      totalPages,
      counts,
      lockDate,
    })
  } catch (error) {
    console.error("Trash listing error:", error.name)
    res.status(500).json({ message: "Failed to load trash items." })
  }
})

/**
 * POST /api/trash/:type/:id/restore
 * Restores a soft-deleted item with books lock and collision checks.
 */
router.post("/:type/:id/restore", verifyToken, trashLimiter, async (req, res) => {
  try {
    const { type, id } = req.params
    const userId = req.user.id

    if (!HISTORY_ENTITIES.includes(type)) {
      return res.status(400).json({ message: `Invalid entity type: ${type}` })
    }

    const Model = getModelForType(type)
    const record = await Model.findOne({
      _id: id,
      userId,
      deletedAt: { $ne: null },
    })

    if (!record) {
      return res.status(404).json({ message: "Item not found in trash." })
    }

    const lockDate = await getEffectiveLockDate(userId)
    const conflicts = {}

    if (type === "customer") {
      const activePhone = await Customer.findOne({
        userId,
        phone: record.phone,
        deletedAt: null,
      }).select("_id").lean()
      if (activePhone) {
        conflicts.phoneConflict = true
        conflicts.numberConflict = true
      }
    } else if (type === "booking") {
      if (record.invoiceNo) {
        const activeInvoice = await Booking.findOne({
          userId,
          invoiceNo: record.invoiceNo,
          deletedAt: null,
        }).select("_id").lean()
        if (activeInvoice) {
          conflicts.numberConflict = true
        }
      }
      const bookingPayments = await Payment.find({
        userId,
        bookingId: record._id,
        isVoid: false,
      }).select("paymentDate").lean()
      record.payments = bookingPayments
    }

    const restoreEval = classifyRestore({
      entity: type,
      record: record.toObject ? record.toObject() : record,
      lockDate,
      conflicts,
    })

    if (!restoreEval.allowed) {
      if (restoreEval.reasons.includes("BOOKS_LOCKED")) {
        const formattedDate = formatLockDateDisplay(lockDate)
        return res.status(423).json({
          message: `Books are closed up to ${formattedDate}. Reopen the books to change this.`,
          lockDate,
          reasons: restoreEval.reasons,
        })
      }
      if (restoreEval.reasons.includes("NUMBER_CONFLICT")) {
        return res.status(409).json({
          message:
            type === "customer"
              ? "An active customer with this phone number already exists."
              : "An active record with this number already exists.",
          reasons: restoreEval.reasons,
        })
      }
      if (restoreEval.reasons.includes("SEAT_CONFLICT")) {
        return res.status(409).json({
          message: "The seats on this departure are already booked by another active booking.",
          reasons: restoreEval.reasons,
        })
      }
      return res.status(400).json({
        message: "Cannot restore this record.",
        reasons: restoreEval.reasons,
      })
    }

    // Execute restore
    record.deletedAt = null
    await record.save()

    // Record in RecordHistory
    await recordHistory({
      userId,
      entityType: type,
      entityId: record._id,
      action: "restored",
      user: req.user,
    })

    // Record in AuditLog (no PII)
    await logAudit({
      userId,
      action: `RESTORE_${type.toUpperCase()}`,
      req,
      meta: { entityType: type, entityId: record._id },
    })

    res.json({
      success: true,
      message: "Item restored successfully",
      restoredItem: record,
    })
  } catch (error) {
    console.error("Trash restore error:", error.name)
    res.status(500).json({ message: "Failed to restore item." })
  }
})

export default router
