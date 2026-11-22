import express from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import verifyToken from "../middleware/auth.js"
import Booking from "../models/Booking.js"
import Expense from "../models/Expense.js"
import { calculateProfitLoss } from "../../shared/profitLoss.js"

const router = express.Router()

/**
 * Rate limiter for read-heavy analytical report endpoints.
 */
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per window
  message: { message: "Too many report requests from this IP. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Returns current Indian Financial Year date bounds (1 Apr to 31 Mar).
 */
export function getCurrentIndianFinancialYearRange(refDate = new Date()) {
  const d = new Date(refDate)
  const year = d.getFullYear()
  const month = d.getMonth() // 0-indexed: 0 = Jan, 3 = April
  const startYear = month >= 3 ? year : year - 1
  const endYear = startYear + 1
  return {
    from: `${startYear}-04-01`,
    to: `${endYear}-03-31`,
  }
}

/**
 * Strict Zod validation schema for Tour P&L report queries.
 * Unknown parameters are strictly rejected.
 */
export const tourPnlQuerySchema = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid from date format (YYYY-MM-DD)")
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid to date format (YYYY-MM-DD)")
      .optional(),
    tourName: z.string().max(120, "Tour name cannot exceed 120 characters").optional(),
    departureKey: z.string().max(160, "Departure key cannot exceed 160 characters").optional(),
    groupBy: z.enum(["tour", "departure"]).optional().default("tour"),
    includeGeneral: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional()
      .default(true)
      .transform((val) => val === true || val === "true"),
  })
  .strict({ message: "Unknown query parameters are not allowed" })

/**
 * GET /api/reports/tour-pnl
 * Generates Tour-wise and Departure-wise Profit & Loss analysis.
 * Tenant isolated, rate-limited, bounded, and guaranteed zero PII.
 */
router.get("/tour-pnl", verifyToken, reportLimiter, async (req, res) => {
  try {
    const parsed = tourPnlQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0]?.message || "Invalid report query parameters",
        errors: parsed.error.errors,
      })
    }

    const { tourName, departureKey, groupBy, includeGeneral } = parsed.data
    const defaultFY = getCurrentIndianFinancialYearRange()
    const from = parsed.data.from || defaultFY.from
    const to = parsed.data.to || defaultFY.to

    const fromDate = new Date(`${from}T00:00:00.000Z`)
    const toDate = new Date(`${to}T23:59:59.999Z`)

    // Bounded queries for bookings - select ONLY non-PII financial fields
    const bookingQuery = {
      userId: req.user.id,
      deletedAt: null,
      $or: [
        { journeyDate: { $gte: fromDate, $lte: toDate } },
        { date: { $gte: fromDate, $lte: toDate } },
      ],
    }
    if (tourName && tourName !== "all" && tourName !== "general") {
      bookingQuery.tourName = tourName
    }

    // Explicit projection: NO customer personal data (no contactName, contactPhone, aadhar, email)
    const bookings = await Booking.find(bookingQuery)
      .select("invoiceNo date tourName journeyDate busType totalAmount advanceReceived isPaid status cancellationCharge refundAmount passengers.seatId passengers._id")
      .lean()

    // Bounded queries for expenses
    const expenseQuery = {
      userId: req.user.id,
      deletedAt: null,
      date: { $gte: fromDate, $lte: toDate },
    }
    if (tourName && tourName !== "all") {
      if (tourName === "general") {
        expenseQuery.$or = [{ tourRef: null }, { tourRef: "" }, { tourName: null }]
      } else {
        expenseQuery.$or = [{ tourName }, { tourRef: tourName }]
      }
    }
    if (departureKey && departureKey !== "all") {
      expenseQuery.$or = [{ departureKey }, { tourRef: departureKey }]
    }

    // Explicit projection: NO PII
    const expenses = await Expense.find(expenseQuery)
      .select("date amount category tourRef tourName departureKey tourLabel vendor paymentMode status note paidOn")
      .lean()

    // Compute metrics with pure shared engine
    const report = calculateProfitLoss({
      bookings,
      expenses,
      filters: {
        from,
        to,
        tourName,
        departureKey,
        groupBy,
      },
    })

    // Mask any remaining unneeded raw arrays for safe client consumption
    const sanitizedTours = report.tours.map((t) => ({
      ...t,
      departures: t.departures.map((d) => ({
        ...d,
        bookings: (d.bookings || []).map((b) => ({
          invoiceNo: b.invoiceNo,
          date: b.date || b.journeyDate,
          paxCount: Array.isArray(b.passengers) ? b.passengers.length : 0,
          totalAmount: b.totalAmount,
          advanceReceived: b.advanceReceived,
          isPaid: b.isPaid,
          status: b.status,
          cancellationCharge: b.cancellationCharge || 0,
          refundAmount: b.refundAmount || 0,
        })),
        expenses: (d.expenses || []).map((e) => ({
          id: e._id || e.id,
          date: e.date,
          amount: e.amount,
          category: e.category,
          vendor: e.vendor || "",
          paymentMode: e.paymentMode,
          status: e.status,
          note: e.note || "",
        })),
      })),
      unallocatedExpenses: (t.unallocatedExpenses || []).map((e) => ({
        id: e._id || e.id,
        date: e.date,
        amount: e.amount,
        category: e.category,
        vendor: e.vendor || "",
        paymentMode: e.paymentMode,
        status: e.status,
        note: e.note || "",
      })),
    }))

    const sanitizedDepartures = report.departures.map((d) => ({
      ...d,
      bookings: (d.bookings || []).map((b) => ({
        invoiceNo: b.invoiceNo,
        date: b.date || b.journeyDate,
        paxCount: Array.isArray(b.passengers) ? b.passengers.length : 0,
        totalAmount: b.totalAmount,
        advanceReceived: b.advanceReceived,
        isPaid: b.isPaid,
        status: b.status,
        cancellationCharge: b.cancellationCharge || 0,
        refundAmount: b.refundAmount || 0,
      })),
      expenses: (d.expenses || []).map((e) => ({
        id: e._id || e.id,
        date: e.date,
        amount: e.amount,
        category: e.category,
        vendor: e.vendor || "",
        paymentMode: e.paymentMode,
        status: e.status,
        note: e.note || "",
      })),
    }))

    const sanitizedGeneralExpenses = includeGeneral
      ? report.generalExpenses.map((e) => ({
          id: e._id || e.id,
          date: e.date,
          amount: e.amount,
          category: e.category,
          vendor: e.vendor || "",
          paymentMode: e.paymentMode,
          status: e.status,
          note: e.note || "",
        }))
      : []

    res.json({
      success: true,
      meta: {
        from,
        to,
        tourName: tourName || "all",
        departureKey: departureKey || "all",
        groupBy,
      },
      summary: report.summary,
      tours: sanitizedTours,
      departures: sanitizedDepartures,
      generalExpenses: sanitizedGeneralExpenses,
    })
  } catch (error) {
    console.error("Tour P&L report generation error:", error.message)
    res.status(500).json({ message: "Failed to generate Profit & Loss report" })
  }
})

export default router
