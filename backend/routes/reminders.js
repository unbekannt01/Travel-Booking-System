import express from "express"
import rateLimit from "express-rate-limit"
import verifyToken from "../middleware/auth.js"
import { logAudit } from "../models/AuditLog.js"
import Customer from "../models/Customer.js"
import Booking from "../models/Booking.js"
import ReminderLog from "../models/ReminderLog.js"
import { normalizeIndianMobile } from "../../shared/customers.js"
import { calculateBookingFinancials } from "../../shared/profitLoss.js"
import { round2 } from "../../shared/businessLogic.js"
import {
  createReminderSchema,
  listRemindersQuerySchema,
} from "../utils/reminderValidation.js"

const router = express.Router()

// Rate limiter for reminder actions (SEC-009)
const reminderWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many reminder requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * GET /api/reminders
 * List chronological reminder logs for tenant (optionally filtered by customerId).
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const parsed = listRemindersQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message || "Invalid query parameters",
        errors: parsed.error.issues,
      })
    }

    const { customerId, limit } = parsed.data
    const filter = { userId: req.user.id }
    if (customerId) {
      filter.customerId = customerId
    }

    const logs = await ReminderLog.find(filter)
      .sort({ openedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean()

    res.json({
      reminders: logs.map((l) => ({
        id: l._id.toString(),
        customerId: l.customerId ? l.customerId.toString() : "",
        bookingIds: (l.bookingIds || []).map((b) => b.toString()),
        tone: l.tone,
        language: l.language,
        amount: l.amount,
        templateSource: l.templateSource,
        status: l.status,
        openedAt: l.openedAt,
        markedSentAt: l.markedSentAt || null,
      })),
    })
  } catch (error) {
    console.error("List reminder logs error:", error)
    res.status(500).json({ message: "Failed to list reminder logs" })
  }
})

/**
 * POST /api/reminders
 * Logs opening of a reminder link.
 * STRICT PRIVACY: Zero message body or phone stored in DB or audit log.
 * Recomputes balance on server using calculateBookingFinancials.
 */
router.post("/", verifyToken, reminderWriteLimiter, async (req, res) => {
  try {
    const parsed = createReminderSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message || "Invalid reminder request body",
        errors: parsed.error.issues,
      })
    }

    const { customerId, bookingIds, tone, language, templateSource } = parsed.data

    // 1. Verify customer exists, belongs to tenant, not deleted
    const customer = await Customer.findOne({
      _id: customerId,
      userId: req.user.id,
      deletedAt: null,
    }).lean()

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" })
    }

    // 2. Reject if opted out of WhatsApp
    if (customer.whatsappOptOut === true) {
      return res.status(409).json({ message: "Customer has opted out of WhatsApp messages" })
    }

    // 3. Validate customer phone with normalizeIndianMobile
    const { valid: phoneValid, normalized: normalizedPhone } = normalizeIndianMobile(customer.phone)
    if (!phoneValid || !normalizedPhone) {
      return res.status(422).json({ message: "Customer has an invalid Indian mobile number" })
    }

    // 4. Server-side balance recomputation
    const bookingQuery = {
      userId: req.user.id,
      customerId: customer._id,
      deletedAt: null,
      status: { $ne: "Cancelled" },
    }
    if (Array.isArray(bookingIds) && bookingIds.length > 0) {
      bookingQuery._id = { $in: bookingIds }
    }

    const bookings = await Booking.find(bookingQuery).lean()
    let totalBalance = 0
    const validBookingIds = []

    for (const b of bookings) {
      const fin = calculateBookingFinancials(b)
      if (fin.outstanding > 0) {
        totalBalance = round2(totalBalance + fin.outstanding)
        validBookingIds.push(b._id)
      }
    }

    if (totalBalance <= 0) {
      return res.status(409).json({ message: "No outstanding balance for this customer" })
    }

    // 5. Create ReminderLog (NO message text, NO phone)
    const log = await ReminderLog.create({
      userId: req.user.id,
      customerId: customer._id,
      bookingIds: validBookingIds.slice(0, 20),
      tone,
      language,
      amount: totalBalance,
      templateSource,
      status: "opened",
      openedAt: new Date(),
      createdBy: req.user.id,
    })

    // 6. Audit log (strictly non-PII)
    await logAudit({
      userId: req.user.id,
      action: "reminder_prepared",
      req,
      meta: {
        customerId: customer._id.toString(),
        bookingCount: validBookingIds.length,
        tone,
        language,
        amount: totalBalance,
      },
    })

    res.json({
      id: log._id.toString(),
      status: log.status,
      amount: totalBalance,
      openedAt: log.openedAt,
    })
  } catch (error) {
    console.error("Create reminder log error:", error)
    res.status(500).json({ message: "Failed to record reminder" })
  }
})

/**
 * POST /api/reminders/:id/sent
 * Marks reminder status as sent.
 */
router.post("/:id/sent", verifyToken, reminderWriteLimiter, async (req, res) => {
  try {
    const log = await ReminderLog.findOne({
      _id: req.params.id,
      userId: req.user.id,
    })

    if (!log) {
      return res.status(404).json({ message: "Reminder log not found" })
    }

    log.status = "sent"
    log.markedSentAt = new Date()
    await log.save()

    await logAudit({
      userId: req.user.id,
      action: "reminder_marked_sent",
      req,
      meta: {
        reminderId: log._id.toString(),
        customerId: log.customerId ? log.customerId.toString() : "",
      },
    })

    res.json({
      success: true,
      reminder: {
        id: log._id.toString(),
        status: log.status,
        markedSentAt: log.markedSentAt,
      },
    })
  } catch (error) {
    console.error("Mark reminder sent error:", error)
    res.status(500).json({ message: "Failed to mark reminder as sent" })
  }
})

export default router
