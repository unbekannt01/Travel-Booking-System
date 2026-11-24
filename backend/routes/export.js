import express from "express"
import rateLimit from "express-rate-limit"
import verifyToken from "../middleware/auth.js"
import Customer from "../models/Customer.js"
import Expense from "../models/Expense.js"
import Booking from "../models/Booking.js"
import CashEntry from "../models/CashEntry.js"
import Payment from "../models/Payment.js"
import { logAudit } from "../models/AuditLog.js"
import { toCsv } from "../../shared/csv.js"
import { EXPENSE_CATEGORY_MAP } from "../../shared/expenses.js"
import { buildDayBook } from "../../shared/cashbook.js"
import CashBookSetup from "../models/CashBookSetup.js"
import { calculateProfitLoss } from "../../shared/profitLoss.js"

const router = express.Router()

export const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many export requests. Please try again later." },
})

/**
 * Format ISO date string (YYYY-MM-DD)
 */
function toDateStr(d) {
  if (!d) return ""
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10)
}

/**
 * Format currency string (two decimal places)
 */
function toCurrency(num) {
  const n = Number(num)
  if (isNaN(n)) return "0.00"
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2)
}

/**
 * GET /api/export/:type
 * Generates an RFC 4180 CSV with UTF-8 BOM, formula injection defense, and tenant isolation.
 * Supported types: customers, expenses, bookings, passengers, payments, cashbook/daybook, receivables/outstanding, tour-pnl/pnl
 */
router.get("/:type", verifyToken, exportLimiter, async (req, res) => {
  try {
    let { type } = req.params
    const userId = req.user.id
    const startDate = req.query.startDate || req.query.from
    const endDate = req.query.endDate || req.query.to
    const { category, tourName } = req.query

    // Aliases
    if (type === "daybook") type = "cashbook"
    if (type === "outstanding") type = "receivables"
    if (type === "pnl") type = "tour-pnl"

    // 366-day date range limit check
    if (startDate && endDate) {
      const dStart = new Date(startDate)
      const dEnd = new Date(endDate)
      if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Expected YYYY-MM-DD." })
      }
      const diffMs = dEnd.getTime() - dStart.getTime()
      if (diffMs < 0) {
        return res.status(400).json({ message: "Start date must be before or equal to end date." })
      }
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays > 366) {
        return res.status(400).json({ message: "Date range cannot exceed 366 days." })
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    let columns = []
    let rows = []
    let fileName = `yatrahub-${type}-${todayStr}.csv`

    if (type === "customers") {
      const customers = await Customer.find({ userId, deletedAt: null })
        .sort({ createdAt: -1 })
        .lean()

      columns = [
        { key: "name", label: "Customer Name" },
        { key: "phone", label: "Phone Number" },
        { key: "city", label: "City / Village" },
        { key: "email", label: "Email Address" },
        { key: "emergencyContact", label: "Emergency Contact" },
        { key: "bloodGroup", label: "Blood Group" },
        { key: "tags", label: "Tags" },
        { key: "whatsappOptOut", label: "WhatsApp Opt-Out" },
        { key: "notes", label: "Notes" },
        { key: "createdAt", label: "Created Date" },
      ]

      rows = customers.map((c) => ({
        name: c.name || "",
        phone: c.phone || "",
        city: c.city || "",
        email: c.email || "",
        emergencyContact: c.emergencyContact || "",
        bloodGroup: c.bloodGroup || "",
        tags: Array.isArray(c.tags) ? c.tags.join("; ") : "",
        whatsappOptOut: c.whatsappOptOut ? "Yes" : "No",
        notes: c.notes || "",
        createdAt: toDateStr(c.createdAt),
      }))
    } else if (type === "expenses") {
      const query = { userId, deletedAt: null }
      if (startDate || endDate) {
        query.date = {}
        if (startDate) query.date.$gte = new Date(startDate)
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          query.date.$lte = end
        }
      }
      if (category && category !== "all") {
        query.category = category
      }

      const expenses = await Expense.find(query).sort({ date: -1 }).lean()

      columns = [
        { key: "date", label: "Date" },
        { key: "category", label: "Category ID" },
        { key: "categoryLabel", label: "Category" },
        { key: "amount", label: "Amount (₹)" },
        { key: "paymentMode", label: "Payment Mode" },
        { key: "status", label: "Status" },
        { key: "vendor", label: "Vendor / Payee" },
        { key: "tourName", label: "Tour" },
        { key: "departureKey", label: "Departure" },
        { key: "note", label: "Description / Notes" },
      ]

      rows = expenses.map((e) => ({
        date: toDateStr(e.date),
        category: e.category || "",
        categoryLabel: EXPENSE_CATEGORY_MAP[e.category]?.label || e.category || "",
        amount: toCurrency(e.amount),
        paymentMode: e.paymentMode || "cash",
        status: e.status || "paid",
        vendor: e.vendor || "",
        tourName: e.tourName || "",
        departureKey: e.departureKey || "",
        note: e.note || "",
      }))
    } else if (type === "bookings") {
      const query = { userId, deletedAt: null }
      if (startDate || endDate) {
        query.date = {}
        if (startDate) query.date.$gte = new Date(startDate)
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          query.date.$lte = end
        }
      }
      if (tourName && tourName !== "all") {
        query.tourName = tourName
      }

      const bookings = await Booking.find(query).sort({ date: -1 }).lean()

      columns = [
        { key: "invoiceNo", label: "Invoice No" },
        { key: "date", label: "Booking Date" },
        { key: "journeyDate", label: "Journey Date" },
        { key: "tourName", label: "Tour Name" },
        { key: "contactName", label: "Contact Name" },
        { key: "contactPhone", label: "Contact Phone" },
        { key: "paxCount", label: "Passengers Count" },
        { key: "seatNumbers", label: "Seat Numbers" },
        { key: "totalAmount", label: "Total Amount (₹)" },
        { key: "advanceReceived", label: "Advance Received (₹)" },
        { key: "balance", label: "Balance (₹)" },
        { key: "status", label: "Status" },
        { key: "paymentMode", label: "Payment Mode" },
      ]

      rows = bookings.map((b) => {
        const total = Number(b.totalAmount) || 0
        const advance = Number(b.advanceReceived) || 0
        const balance = Math.max(0, total - advance)
        const seats = Array.isArray(b.passengers)
          ? b.passengers.map((p) => p.seatNumber || p.seatId).filter(Boolean).join(", ")
          : ""

        return {
          invoiceNo: b.invoiceNo || "",
          date: toDateStr(b.date),
          journeyDate: toDateStr(b.journeyDate),
          tourName: b.tourName || "",
          contactName: b.contactName || "",
          contactPhone: b.contactPhone || "",
          paxCount: Array.isArray(b.passengers) ? b.passengers.length : 0,
          seatNumbers: seats,
          totalAmount: toCurrency(total),
          advanceReceived: toCurrency(advance),
          balance: toCurrency(balance),
          status: b.status || "Confirmed",
          paymentMode: b.paymentMode || "Cash",
        }
      })
    } else if (type === "passengers") {
      // Passenger List Export - strictly NO Aadhaar
      const query = { userId, deletedAt: null }
      if (startDate || endDate) {
        query.journeyDate = {}
        if (startDate) query.journeyDate.$gte = new Date(startDate)
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          query.journeyDate.$lte = end
        }
      }
      if (tourName && tourName !== "all") {
        query.tourName = tourName
      }

      const bookings = await Booking.find(query).sort({ journeyDate: -1 }).lean()

      columns = [
        { key: "invoiceNo", label: "Invoice No" },
        { key: "tourName", label: "Tour Name" },
        { key: "journeyDate", label: "Journey Date" },
        { key: "passengerName", label: "Passenger Name" },
        { key: "age", label: "Age" },
        { key: "gender", label: "Gender" },
        { key: "city", label: "City" },
        { key: "seatNumber", label: "Seat No" },
        { key: "bookingStatus", label: "Booking Status" },
      ]

      bookings.forEach((b) => {
        const pList = Array.isArray(b.passengers) ? b.passengers : []
        pList.forEach((p) => {
          rows.push({
            invoiceNo: b.invoiceNo || "",
            tourName: b.tourName || "",
            journeyDate: toDateStr(b.journeyDate),
            passengerName: p.name || "",
            age: p.age || "",
            gender: p.gender || "",
            city: p.city || "",
            seatNumber: p.seatNumber || p.seatId || "",
            bookingStatus: b.status || "Confirmed",
          })
        })
      })
    } else if (type === "payments") {
      // Payments Ledger Export
      const query = { userId, deletedAt: null }
      if (startDate || endDate) {
        query.paymentDate = {}
        if (startDate) query.paymentDate.$gte = new Date(startDate)
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          query.paymentDate.$lte = end
        }
      }

      const payments = await Payment.find(query).sort({ paymentDate: -1 }).lean()

      // Fetch corresponding bookings to populate invoiceNo and customerName
      const bookingIds = [...new Set(payments.map((p) => String(p.bookingId)).filter(Boolean))]
      const bookings = await Booking.find({ _id: { $in: bookingIds } })
        .select("invoiceNo contactName customerName")
        .lean()
      const bookingMap = new Map(bookings.map((b) => [String(b._id), b]))

      columns = [
        { key: "receiptNo", label: "Receipt No" },
        { key: "paymentDate", label: "Receipt Date" },
        { key: "invoiceNo", label: "Invoice No" },
        { key: "customerName", label: "Customer Name" },
        { key: "paymentMode", label: "Payment Mode" },
        { key: "type", label: "Payment Type" },
        { key: "amount", label: "Amount (₹)" },
        { key: "status", label: "Status" },
        { key: "recordedBy", label: "Recorded By" },
      ]

      rows = payments.map((p) => {
        const b = bookingMap.get(String(p.bookingId)) || {}
        const isRefund = p.type === "refund"
        const amt = Number(p.amount) || 0
        const signedAmount = isRefund ? -Math.abs(amt) : Math.abs(amt)

        return {
          receiptNo: p.receiptNo || "",
          paymentDate: toDateStr(p.paymentDate || p.createdAt),
          invoiceNo: b.invoiceNo || "",
          customerName: b.contactName || b.customerName || "",
          paymentMode: p.paymentMode || "Cash",
          type: p.type || "payment",
          amount: toCurrency(signedAmount),
          status: p.isVoid ? "Voided" : "Active",
          recordedBy: p.recordedBy || "",
        }
      })
    } else if (type === "tour-pnl") {
      // Tour-wise Profit/Loss Export (reuses existing P&L engine)
      const [bookings, expenses] = await Promise.all([
        Booking.find({ userId, deletedAt: null }).lean(),
        Expense.find({ userId, deletedAt: null }).lean(),
      ])

      const pnl = calculateProfitLoss({
        bookings,
        expenses,
        filters: { from: startDate, to: endDate, tourName },
      })

      columns = [
        { key: "tourName", label: "Tour Name" },
        { key: "departuresCount", label: "Departures" },
        { key: "passengers", label: "Passengers" },
        { key: "bookedRevenue", label: "Booked Revenue (₹)" },
        { key: "collected", label: "Collected (₹)" },
        { key: "outstanding", label: "Outstanding (₹)" },
        { key: "expensesTotal", label: "Total Expenses (₹)" },
        { key: "profitBooked", label: "Booked Profit/Loss (₹)" },
        { key: "marginPercent", label: "Operating Margin (%)" },
      ]

      rows = (pnl.tours || []).map((t) => ({
        tourName: t.tourName || "",
        departuresCount: t.departuresCount || 0,
        passengers: t.passengers || 0,
        bookedRevenue: toCurrency(t.bookedRevenue),
        collected: toCurrency(t.collected),
        outstanding: toCurrency(t.outstanding),
        expensesTotal: toCurrency(t.expensesTotal),
        profitBooked: toCurrency(t.profitBooked),
        marginPercent: t.marginPercent != null ? `${t.marginPercent}%` : "—",
      }))
    } else if (type === "cashbook") {
      const start = startDate || todayStr
      const end = endDate || todayStr

      const setup = await CashBookSetup.findOne({ userId }).lean()

      const [entries, expenses, payments, bookings] = await Promise.all([
        CashEntry.find({ userId, deletedAt: null }).lean(),
        Expense.find({ userId, deletedAt: null, status: "paid" }).lean(),
        Payment.find({ userId, deletedAt: null }).lean(),
        Booking.find({ userId, deletedAt: null }).lean(),
      ])

      const dayBook = buildDayBook({
        startDate: start,
        endDate: end,
        setup,
        bookings,
        payments,
        expenses,
        manualEntries: entries,
      })

      const dayBookEntries = dayBook?.entries || []

      columns = [
        { key: "date", label: "Date" },
        { key: "refNo", label: "Reference / Invoice" },
        { key: "description", label: "Description / Party" },
        { key: "type", label: "Type" },
        { key: "account", label: "Account" },
        { key: "inAmount", label: "Receipt In (₹)" },
        { key: "outAmount", label: "Payment Out (₹)" },
        { key: "cashBalance", label: "Cash Balance (₹)" },
        { key: "bankBalance", label: "Bank Balance (₹)" },
        { key: "totalBalance", label: "Total Balance (₹)" },
      ]

      rows = dayBookEntries.map((e) => ({
        date: toDateStr(e.date),
        refNo: e.refNo || "",
        description: e.partyName || e.description || "",
        type: e.type || "",
        account: e.account || "cash",
        inAmount: e.inAmount > 0 ? toCurrency(e.inAmount) : "",
        outAmount: e.outAmount > 0 ? toCurrency(e.outAmount) : "",
        cashBalance: toCurrency(e.cashBalance),
        bankBalance: toCurrency(e.bankBalance),
        totalBalance: toCurrency(e.totalBalance),
      }))
    } else if (type === "receivables") {
      const bookings = await Booking.find({ userId, deletedAt: null }).lean()
      const customerMap = new Map()

      for (const b of bookings) {
        if (b.status === "Cancelled") continue
        const total = Number(b.totalAmount) || 0
        const advance = Number(b.advanceReceived) || 0
        const balance = total - advance
        if (balance <= 0) continue

        const key = b.contactPhone || b.contactName || "Unknown"
        const existing = customerMap.get(key) || {
          name: b.contactName || "Unknown",
          phone: b.contactPhone || "",
          city: "",
          totalBookings: 0,
          totalInvoiced: 0,
          totalReceived: 0,
          outstandingBalance: 0,
          oldestDue: b.journeyDate || b.date,
        }

        existing.totalBookings += 1
        existing.totalInvoiced += total
        existing.totalReceived += advance
        existing.outstandingBalance += balance
        if (b.date && (!existing.oldestDue || new Date(b.date) < new Date(existing.oldestDue))) {
          existing.oldestDue = b.date
        }

        customerMap.set(key, existing)
      }

      columns = [
        { key: "name", label: "Customer Name" },
        { key: "phone", label: "Phone Number" },
        { key: "totalBookings", label: "Total Active Bookings" },
        { key: "totalInvoiced", label: "Total Invoiced (₹)" },
        { key: "totalReceived", label: "Total Received (₹)" },
        { key: "outstandingBalance", label: "Outstanding Balance (₹)" },
        { key: "oldestDue", label: "Oldest Due Date" },
      ]

      rows = Array.from(customerMap.values())
        .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
        .map((c) => ({
          name: c.name,
          phone: c.phone,
          totalBookings: c.totalBookings,
          totalInvoiced: toCurrency(c.totalInvoiced),
          totalReceived: toCurrency(c.totalReceived),
          outstandingBalance: toCurrency(c.outstandingBalance),
          oldestDue: toDateStr(c.oldestDue),
        }))
    } else {
      return res.status(400).json({ message: `Unsupported export type: ${type}` })
    }

    const csvContent = toCsv({ columns, rows, bom: true, eol: "\r\n" })

    await logAudit({
      userId,
      action: "EXPORT_CSV",
      req,
      meta: {
        type,
        rowCount: rows.length,
      },
    })

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.send(csvContent)
  } catch (error) {
    console.error("Export CSV error:", error.name)
    res.status(500).json({ message: "Failed to generate CSV export." })
  }
})

export default router
