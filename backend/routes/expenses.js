import express from "express"
import rateLimit from "express-rate-limit"
import Expense from "../models/Expense.js"
import verifyToken from "../middleware/auth.js"
import { logAudit } from "../models/AuditLog.js"
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpenseQuerySchema,
} from "../utils/expenseValidation.js"
import {
  sumAmounts,
  groupByCategory,
  groupByMonth,
  round2,
} from "../../shared/expenses.js"
import { assertBooksOpen, BooksLockedError } from "../utils/booksLock.js"
import recordHistory from "../utils/recordHistory.js"

const router = express.Router()

// Rate limiter for write operations (SEC-009)
const expenseWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many expense write requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Helper to build the MongoDB filter query from validated parameters.
 */
function buildExpenseFilter(userId, filters) {
  const query = {
    userId,
    deletedAt: null,
  }

  // Date range filter
  if (filters.from || filters.to) {
    query.date = {}
    if (filters.from) {
      const fromDate = new Date(`${filters.from}T00:00:00.000Z`)
      if (!isNaN(fromDate.getTime())) {
        query.date.$gte = fromDate
      }
    }
    if (filters.to) {
      const toDate = new Date(`${filters.to}T23:59:59.999Z`)
      if (!isNaN(toDate.getTime())) {
        query.date.$lte = toDate
      }
    }
  }

  // Category filter
  if (filters.category && filters.category !== "all") {
    query.category = filters.category
  }

  // Tour reference filter
  if (filters.tourRef && filters.tourRef !== "all") {
    if (filters.tourRef === "general") {
      query.$or = [{ tourRef: null }, { tourRef: "" }, { tourName: null }]
    } else {
      query.$or = [{ tourRef: filters.tourRef }, { tourName: filters.tourRef }]
    }
  }

  // Explicit Tour Name filter
  if (filters.tourName && filters.tourName !== "all") {
    if (filters.tourName === "general") {
      query.$or = [{ tourRef: null }, { tourRef: "" }, { tourName: null }]
    } else {
      query.$or = [{ tourName: filters.tourName }, { tourRef: filters.tourName }]
    }
  }

  // Explicit Departure Key filter
  if (filters.departureKey && filters.departureKey !== "all") {
    query.$or = [{ departureKey: filters.departureKey }, { tourRef: filters.departureKey }]
  }

  // Payment mode filter
  if (filters.paymentMode && filters.paymentMode !== "all") {
    query.paymentMode = filters.paymentMode
  }

  // Status filter
  if (filters.status && filters.status !== "all") {
    query.status = filters.status
  }

  // Text search query across vendor, note, tourLabel
  if (filters.q && filters.q.trim()) {
    const escaped = filters.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(escaped, "i")
    const searchConditions = [{ vendor: regex }, { note: regex }, { tourLabel: regex }]
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchConditions }]
      delete query.$or
    } else {
      query.$or = searchConditions
    }
  }

  return query
}

/**
 * GET /api/expenses/summary
 * Returns aggregated statistics (total, pending, category breakdown, monthly trend)
 * NOTE: Placed before /:id route to prevent route collision.
 */
router.get("/summary", verifyToken, async (req, res) => {
  try {
    const parsed = listExpenseQuerySchema.parse(req.query)
    const query = buildExpenseFilter(req.user.id, parsed)

    // Fetch all matching un-paginated expenses for accurate in-memory summary
    const matchingExpenses = await Expense.find(query).sort({ date: -1 }).lean()

    const count = matchingExpenses.length
    const totalExpenses = sumAmounts(matchingExpenses)

    const paidExpenses = matchingExpenses.filter((e) => e.status !== "pending")
    const pendingExpenses = matchingExpenses.filter((e) => e.status === "pending")

    const paidTotal = sumAmounts(paidExpenses)
    const pendingTotal = sumAmounts(pendingExpenses)

    const byCategory = groupByCategory(matchingExpenses)
    const byMonth = groupByMonth(matchingExpenses)

    // Identify top category this period
    const topCategory = byCategory.find((c) => c.total > 0) || null

    res.json({
      count,
      totalExpenses: round2(totalExpenses),
      paidTotal: round2(paidTotal),
      pendingTotal: round2(pendingTotal),
      byCategory,
      byMonth,
      topCategory,
    })
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: error.errors[0]?.message || "Invalid summary parameters" })
    }
    console.error("Expense summary error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to generate expense summary" })
  }
})

/**
 * GET /api/expenses
 * Lists paginated expenses matching filter criteria.
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const parsed = listExpenseQuerySchema.parse(req.query)
    const query = buildExpenseFilter(req.user.id, parsed)

    const page = parsed.page
    const limit = parsed.limit
    const skip = (page - 1) * limit
    const sort = { [parsed.sortBy]: parsed.sortOrder === "asc" ? 1 : -1, _id: -1 }

    const [expenses, total] = await Promise.all([
      Expense.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Expense.countDocuments(query),
    ])

    const totalPages = Math.ceil(total / limit) || 1

    res.json({
      expenses: expenses.map((e) => ({
        ...e,
        id: e._id.toString(),
      })),
      total,
      page,
      limit,
      totalPages,
    })
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ message: error.errors[0]?.message || "Invalid filter parameters" })
    }
    console.error("Expense listing error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to retrieve expenses" })
  }
})

/**
 * GET /api/expenses/:id
 * Fetches a single expense by ID.
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user.id,
      deletedAt: null,
    }).lean()

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" })
    }

    res.json({
      ...expense,
      id: expense._id.toString(),
    })
  } catch (error) {
    console.error("Expense fetch error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to retrieve expense" })
  }
})

/**
 * POST /api/expenses
 * Creates a new expense record with strict Zod validation and audit logging.
 */
router.post("/", verifyToken, expenseWriteLimiter, async (req, res) => {
  try {
    const input = createExpenseSchema.parse(req.body)

    let paidOn = input.paidOn
    if (input.status === "paid" && !paidOn) {
      paidOn = input.date
    } else if (input.status === "pending") {
      paidOn = null
    }

    if (input.status === "paid") {
      await assertBooksOpen(req.user.id, paidOn)
    }

    const expense = await Expense.create({
      ...input,
      paidOn,
      userId: req.user.id,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    })

    await logAudit({
      userId: req.user.id,
      action: "EXPENSE_CREATED",
      req,
      meta: {
        expenseId: expense._id.toString(),
        amount: expense.amount,
        category: expense.category,
        tourRef: expense.tourRef,
      },
    })

    await recordHistory({
      userId: req.user.id,
      entityType: "expense",
      entityId: expense._id,
      action: "created",
      user: req.user,
    })

    res.status(201).json({
      message: "Expense recorded successfully",
      expense: {
        ...expense.toObject(),
        id: expense._id.toString(),
      },
    })
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    if (error.name === "ZodError") {
      return res.status(400).json({ message: error.errors[0]?.message || "Validation failed" })
    }
    console.error("Expense creation error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to record expense" })
  }
})

/**
 * PUT /api/expenses/:id
 * Updates an existing expense record.
 */
router.put("/:id", verifyToken, expenseWriteLimiter, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user.id,
      deletedAt: null,
    })

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" })
    }

    const before = expense.toObject()

    const input = updateExpenseSchema.parse(req.body)

    // Handle paidOn synchronization
    let paidOn = input.paidOn !== undefined ? input.paidOn : expense.paidOn
    const newStatus = input.status !== undefined ? input.status : expense.status
    if (newStatus === "paid" && !paidOn) {
      paidOn = input.date || expense.date || new Date()
    } else if (newStatus === "pending") {
      paidOn = null
    }

    const isOldPaid = expense.status === "paid"
    const isNewPaid = newStatus === "paid"
    const oldDate = expense.paidOn || expense.date
    const newDate = paidOn || input.date || oldDate

    const isMoneyChanging =
      (input.amount !== undefined && input.amount !== expense.amount) ||
      (input.paymentMode !== undefined && input.paymentMode !== expense.paymentMode) ||
      (input.status !== undefined && input.status !== expense.status) ||
      (input.paidOn !== undefined && input.paidOn !== expense.paidOn) ||
      (input.date !== undefined && input.date !== expense.date)

    if (isMoneyChanging) {
      if (isOldPaid) {
        await assertBooksOpen(req.user.id, oldDate)
      }
      if (isNewPaid) {
        await assertBooksOpen(req.user.id, newDate)
      }
    }

    Object.assign(expense, input, {
      paidOn,
      updatedBy: req.user.id,
    })

    await expense.save()

    await logAudit({
      userId: req.user.id,
      action: "EXPENSE_UPDATED",
      req,
      meta: {
        expenseId: expense._id.toString(),
        amount: expense.amount,
        category: expense.category,
        tourRef: expense.tourRef,
      },
    })

    await recordHistory({
      userId: req.user.id,
      entityType: "expense",
      entityId: expense._id,
      action: "updated",
      before,
      after: expense.toObject(),
      user: req.user,
    })

    res.json({
      message: "Expense updated successfully",
      expense: {
        ...expense.toObject(),
        id: expense._id.toString(),
      },
    })
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    if (error.name === "ZodError") {
      return res.status(400).json({ message: error.errors[0]?.message || "Validation failed" })
    }
    console.error("Expense update error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to update expense" })
  }
})

/**
 * DELETE /api/expenses/:id
 * Soft deletes an expense record.
 */
router.delete("/:id", verifyToken, expenseWriteLimiter, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      userId: req.user.id,
      deletedAt: null,
    })

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" })
    }

    if (expense.status === "paid") {
      await assertBooksOpen(req.user.id, expense.paidOn || expense.date)
    }

    expense.deletedAt = new Date()
    expense.deletedBy = req.user.id
    await expense.save()

    await recordHistory({
      userId: req.user.id,
      entityType: "expense",
      entityId: expense._id,
      action: "deleted",
      user: req.user,
    })

    await logAudit({
      userId: req.user.id,
      action: "EXPENSE_DELETED",
      req,
      meta: {
        expenseId: expense._id.toString(),
        amount: expense.amount,
        category: expense.category,
      },
    })

    res.json({
      message: "Expense removed successfully",
      id: expense._id.toString(),
    })
  } catch (error) {
    if (error.statusCode === 423 || error.name === "BooksLockedError") {
      return res.status(423).json({
        message: error.message,
        lockDate: error.lockDate,
        transactionDate: error.transactionDate,
      })
    }
    console.error("Expense deletion error:", error.name, error.code || "")
    res.status(500).json({ message: "Failed to delete expense" })
  }
})

export default router
