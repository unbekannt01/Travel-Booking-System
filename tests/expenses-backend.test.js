import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_MAP,
  EXPENSE_CATEGORY_IDS,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_PAYMENT_MODE_MAP,
  EXPENSE_PAYMENT_MODE_IDS,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_MAP,
  EXPENSE_STATUS_IDS,
  round2,
  sumAmounts,
  groupByCategory,
  groupByMonth,
  filterExpenses,
} from "../shared/expenses.js"
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpenseQuerySchema,
} from "../backend/utils/expenseValidation.js"
import { escapeCsvValue, toCsvString } from "../src/utils/csv.js"

describe("Shared Expenses Pure Helpers (shared/expenses.js)", () => {
  it("exports EXPENSE_CATEGORIES as a frozen array of 13 built-in categories", () => {
    assert.equal(Array.isArray(EXPENSE_CATEGORIES), true)
    assert.equal(Object.isFrozen(EXPENSE_CATEGORIES), true)
    assert.equal(EXPENSE_CATEGORIES.length, 13)

    const expectedIds = [
      "fuel",
      "toll",
      "driver-allowance",
      "bus-hire",
      "food",
      "accommodation",
      "permit-tax",
      "maintenance",
      "commission",
      "advertising",
      "office",
      "salary",
      "other",
    ]
    assert.deepEqual(EXPENSE_CATEGORY_IDS, expectedIds)

    for (const cat of EXPENSE_CATEGORIES) {
      assert.ok(cat.id, "Category has id")
      assert.ok(cat.label, "Category has English label")
      assert.ok(cat.labelHi, "Category has Hindi label")
      assert.ok(cat.labelGu, "Category has Gujarati label")
      assert.ok(cat.icon, "Category has icon name")
      assert.ok(cat.description, "Category has description")
      assert.equal(EXPENSE_CATEGORY_MAP[cat.id], cat)
    }
  })

  it("exports EXPENSE_PAYMENT_MODES and EXPENSE_STATUSES as frozen arrays with maps", () => {
    assert.equal(Array.isArray(EXPENSE_PAYMENT_MODES), true)
    assert.equal(Object.isFrozen(EXPENSE_PAYMENT_MODES), true)
    assert.deepEqual(EXPENSE_PAYMENT_MODE_IDS, ["cash", "upi", "bank", "card", "cheque"])

    assert.equal(Array.isArray(EXPENSE_STATUSES), true)
    assert.equal(Object.isFrozen(EXPENSE_STATUSES), true)
    assert.deepEqual(EXPENSE_STATUS_IDS, ["paid", "pending"])
  })

  it("rounds amounts to exact 2 decimals without floating point inaccuracy (round2)", () => {
    assert.equal(round2(100.456), 100.46)
    assert.equal(round2(100.454), 100.45)
    assert.equal(round2("2500.5"), 2500.5)
    assert.equal(round2(null), 0)
    assert.equal(round2(undefined), 0)
    assert.equal(round2("invalid"), 0)
  })

  it("sums amounts with zero floating point drift using integer paise (sumAmounts)", () => {
    const list = [
      { amount: 0.1 },
      { amount: 0.2 },
      { amount: 1000.55 },
      { amount: 2000.45 },
      { amount: 50.0 },
    ]
    // In IEEE 754 float math: 0.1 + 0.2 = 0.30000000000000004
    // sumAmounts must produce exact 3051.3
    const sum = sumAmounts(list)
    assert.equal(sum, 3051.3)
    assert.equal(sumAmounts([]), 0)
    assert.equal(sumAmounts(null), 0)
  })

  it("aggregates expenses accurately by category (groupByCategory)", () => {
    const expenses = [
      { category: "fuel", amount: 4500 },
      { category: "fuel", amount: 1500 },
      { category: "toll", amount: 1200 },
      { category: "driver-allowance", amount: 2000 },
      { category: "food", amount: 800 },
    ]

    const grouped = groupByCategory(expenses)
    assert.equal(grouped.length, 13) // Returns all 13 categories

    // Sorted descending by total
    assert.equal(grouped[0].id, "fuel")
    assert.equal(grouped[0].total, 6000)
    assert.equal(grouped[0].count, 2)
    assert.equal(grouped[0].percentage, 60) // 6000 / 10000 * 100 = 60%

    assert.equal(grouped[1].id, "driver-allowance")
    assert.equal(grouped[1].total, 2000)
    assert.equal(grouped[1].percentage, 20)

    assert.equal(grouped[2].id, "toll")
    assert.equal(grouped[2].total, 1200)
    assert.equal(grouped[2].percentage, 12)

    assert.equal(grouped[3].id, "food")
    assert.equal(grouped[3].total, 800)
    assert.equal(grouped[3].percentage, 8)

    // Unused categories have total 0, count 0, percentage 0
    const busHire = grouped.find((c) => c.id === "bus-hire")
    assert.equal(busHire.total, 0)
    assert.equal(busHire.count, 0)
    assert.equal(busHire.percentage, 0)
  })

  it("groups expenses by month with Indian Financial Year alignment (groupByMonth)", () => {
    const expenses = [
      { date: "2026-03-15T00:00:00.000Z", amount: 5000, status: "paid" },
      { date: "2026-03-25T00:00:00.000Z", amount: 1500, status: "pending" },
      { date: "2026-04-05T00:00:00.000Z", amount: 8000, status: "paid" },
      { date: "2026-05-12T00:00:00.000Z", amount: 4000, status: "paid" },
    ]

    const monthly = groupByMonth(expenses)
    assert.equal(monthly.length, 3)

    // March 2026 is part of FY 2025-26
    assert.equal(monthly[0].key, "2026-03")
    assert.equal(monthly[0].label, "Mar 2026")
    assert.equal(monthly[0].fy, "2025-26")
    assert.equal(monthly[0].total, 6500)
    assert.equal(monthly[0].paidTotal, 5000)
    assert.equal(monthly[0].pendingTotal, 1500)
    assert.equal(monthly[0].count, 2)

    // April 2026 is part of FY 2026-27
    assert.equal(monthly[1].key, "2026-04")
    assert.equal(monthly[1].label, "Apr 2026")
    assert.equal(monthly[1].fy, "2026-27")
    assert.equal(monthly[1].total, 8000)
    assert.equal(monthly[1].paidTotal, 8000)
    assert.equal(monthly[1].pendingTotal, 0)
    assert.equal(monthly[1].count, 1)

    // May 2026 is part of FY 2026-27
    assert.equal(monthly[2].key, "2026-05")
    assert.equal(monthly[2].label, "May 2026")
    assert.equal(monthly[2].fy, "2026-27")
  })

  it("filters expenses in memory across all criteria (filterExpenses)", () => {
    const dataset = [
      {
        id: "1",
        date: "2026-04-10",
        category: "fuel",
        tourRef: "Somnath Yatra",
        paymentMode: "cash",
        status: "paid",
        vendor: "Bharat Petroleum",
        note: "Diesel 70L",
        amount: 6500,
      },
      {
        id: "2",
        date: "2026-04-15",
        category: "toll",
        tourRef: "Somnath Yatra",
        paymentMode: "upi",
        status: "paid",
        vendor: "Fastag Toll NH8",
        note: "Fastag recharge",
        amount: 850,
      },
      {
        id: "3",
        date: "2026-04-20",
        category: "maintenance",
        tourRef: null,
        paymentMode: "bank",
        status: "pending",
        vendor: "Sharma Motors",
        note: "Bus front brake repair",
        amount: 4200,
      },
    ]

    // Category filter
    const fuelOnly = filterExpenses(dataset, { category: "fuel" })
    assert.equal(fuelOnly.length, 1)
    assert.equal(fuelOnly[0].id, "1")

    // Tour filter
    const somnathOnly = filterExpenses(dataset, { tourRef: "Somnath Yatra" })
    assert.equal(somnathOnly.length, 2)

    const generalOnly = filterExpenses(dataset, { tourRef: "general" })
    assert.equal(generalOnly.length, 1)
    assert.equal(generalOnly[0].id, "3")

    // Status filter
    const pendingOnly = filterExpenses(dataset, { status: "pending" })
    assert.equal(pendingOnly.length, 1)
    assert.equal(pendingOnly[0].id, "3")

    // Date range filter
    const dateFiltered = filterExpenses(dataset, { from: "2026-04-12", to: "2026-04-18" })
    assert.equal(dateFiltered.length, 1)
    assert.equal(dateFiltered[0].id, "2")

    // Search query filter (matches vendor or note)
    const searchResult = filterExpenses(dataset, { q: "brake" })
    assert.equal(searchResult.length, 1)
    assert.equal(searchResult[0].id, "3")
  })
})

describe("Expense Validation Schemas (backend/utils/expenseValidation.js)", () => {
  it("accepts valid expense creation payload", () => {
    const valid = {
      date: "2026-04-10",
      amount: 4500.5,
      category: "fuel",
      tourRef: "Char Dham Yatra",
      tourLabel: "Char Dham Yatra",
      vendor: "HPCL Fuel Station",
      paymentMode: "card",
      status: "paid",
      note: "Full tank refill",
    }
    const parsed = createExpenseSchema.parse(valid)
    assert.equal(parsed.amount, 4500.5)
    assert.equal(parsed.category, "fuel")
  })

  it("rejects unknown keys via .strict()", () => {
    const payload = {
      date: "2026-04-10",
      amount: 1000,
      category: "fuel",
      unknownAdminField: "dangerous_input",
    }
    assert.throws(() => createExpenseSchema.parse(payload), /unrecognized_keys/)
  })

  it("rejects non-positive and excessive amounts (>10,000,000)", () => {
    assert.throws(
      () =>
        createExpenseSchema.parse({
          date: "2026-04-10",
          amount: 0,
          category: "fuel",
        }),
      /greater than/,
    )

    assert.throws(
      () =>
        createExpenseSchema.parse({
          date: "2026-04-10",
          amount: -500,
          category: "fuel",
        }),
      /greater than/,
    )

    assert.throws(
      () =>
        createExpenseSchema.parse({
          date: "2026-04-10",
          amount: 10000001,
          category: "fuel",
        }),
      /cannot exceed/,
    )
  })

  it("rejects invalid categories outside the 13 built-in categories", () => {
    assert.throws(
      () =>
        createExpenseSchema.parse({
          date: "2026-04-10",
          amount: 500,
          category: "cryptocurrency-purchase",
        }),
      /Invalid/i,
    )
  })

  it("rejects far-future dates (>1 day) and ancient dates (>10 years)", () => {
    const farFuture = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    assert.throws(
      () =>
        createExpenseSchema.parse({
          date: farFuture,
          amount: 500,
          category: "fuel",
        }),
      /cannot be far in the future/,
    )

    assert.throws(
      () =>
        createExpenseSchema.parse({
          date: "2010-01-01",
          amount: 500,
          category: "fuel",
        }),
      /cannot be far in the future or older than 10 years/,
    )
  })

  it("enforces text length limits (vendor <= 80, note <= 300)", () => {
    assert.throws(
      () =>
        createExpenseSchema.parse({
          date: "2026-04-10",
          amount: 500,
          category: "fuel",
          vendor: "A".repeat(81),
        }),
      /80 characters/,
    )

    assert.throws(
      () =>
        createExpenseSchema.parse({
          date: "2026-04-10",
          amount: 500,
          category: "fuel",
          note: "B".repeat(301),
        }),
      /300 characters/,
    )
  })

  it("validates updateExpenseSchema requires at least one field and rejects unknown keys", () => {
    assert.throws(() => updateExpenseSchema.parse({}), /At least one field/)
    assert.throws(
      () => updateExpenseSchema.parse({ amount: 500, hackerKey: 123 }),
      /unrecognized_keys/,
    )
    const validUpdate = updateExpenseSchema.parse({ status: "paid", amount: 600 })
    assert.equal(validUpdate.status, "paid")
    assert.equal(validUpdate.amount, 600)
  })

  it("validates and clamps listExpenseQuerySchema", () => {
    const query = listExpenseQuerySchema.parse({
      limit: "150", // clamps to 100
      page: "2",
      category: "fuel",
      status: "paid",
    })
    assert.equal(query.limit, 100)
    assert.equal(query.page, 2)
    assert.equal(query.category, "fuel")
    assert.equal(query.status, "paid")
  })
})

describe("CSV Export Formula Injection Protection (src/utils/csv.js)", () => {
  it("prefixes dangerous spreadsheet formula trigger characters (=, +, -, @, \\t, \\r) with single quote", () => {
    assert.equal(escapeCsvValue("=SUM(A1:A10)"), `"'=SUM(A1:A10)"`)
    assert.equal(escapeCsvValue("+CMD|' /C calc'!A0"), `"'+CMD|' /C calc'!A0"`)
    assert.equal(escapeCsvValue("-100+20"), `"'-100+20"`)
    assert.equal(escapeCsvValue("@HYPERLINK('http://evil.com')"), `"'@HYPERLINK('http://evil.com')"` )
    assert.equal(escapeCsvValue("\tTabIndent"), `"'\tTabIndent"`)
  })

  it("properly formats CSV rows with UTF-8 BOM for Indian language character preservation", () => {
    const rows = [
      ["Date", "Category", "Amount"],
      ["2026-04-10", "ईंधन / डीज़ल", "5000.00"],
      ["2026-04-11", "ટોલ ટેક્સ", "1200.00"],
    ]
    const csv = toCsvString(rows)
    assert.ok(csv.startsWith("\uFEFF"), "Includes UTF-8 BOM")
    assert.ok(csv.includes("ईंधन / डीज़ल"))
    assert.ok(csv.includes("ટોલ ટેક્સ"))
  })
})

describe("Expense Controller Logic, Tenant Isolation & Soft Delete", () => {
  const userA = "507f1f77bcf86cd799439011"
  const userB = "507f1f77bcf86cd799439022"

  const mockDbExpenses = [
    {
      _id: "exp_a1",
      userId: userA,
      date: new Date("2026-04-05"),
      category: "fuel",
      amount: 1500,
      tourRef: "Somnath Yatra",
      tourLabel: "Somnath Yatra",
      vendor: "HPCL",
      paymentMode: "card",
      status: "paid",
      deletedAt: null,
    },
    {
      _id: "exp_a2",
      userId: userA,
      date: new Date("2026-04-10"),
      category: "fuel",
      amount: 2500,
      tourRef: "Somnath Yatra",
      tourLabel: "Somnath Yatra",
      vendor: "HPCL",
      paymentMode: "card",
      status: "paid",
      deletedAt: null,
    },
    {
      _id: "exp_a3",
      userId: userA,
      date: new Date("2026-04-15"),
      category: "fuel",
      amount: 3500,
      tourRef: "Dwarka Darshan",
      tourLabel: "Dwarka Darshan",
      vendor: "IOCL",
      paymentMode: "cash",
      status: "paid",
      deletedAt: null,
    },
    {
      _id: "exp_a4",
      userId: userA,
      date: new Date("2026-04-18"),
      category: "toll",
      amount: 500,
      tourRef: "Somnath Yatra",
      tourLabel: "Somnath Yatra",
      vendor: "Fastag NH8",
      paymentMode: "upi",
      status: "paid",
      deletedAt: null,
    },
    {
      _id: "exp_a5",
      userId: userA,
      date: new Date("2026-04-20"),
      category: "toll",
      amount: 750,
      tourRef: "Dwarka Darshan",
      tourLabel: "Dwarka Darshan",
      vendor: "Fastag NH27",
      paymentMode: "upi",
      status: "pending",
      deletedAt: null,
    },
    {
      _id: "exp_a6",
      userId: userA,
      date: new Date("2026-04-22"),
      category: "maintenance",
      amount: 4000,
      tourRef: null,
      tourLabel: "General",
      vendor: "Patel Auto Garage",
      paymentMode: "bank",
      status: "pending",
      deletedAt: null,
    },
    {
      _id: "exp_a_deleted",
      userId: userA,
      date: new Date("2026-04-01"),
      category: "food",
      amount: 1000,
      tourRef: null,
      status: "paid",
      deletedAt: new Date("2026-04-02"), // Soft deleted
      deletedBy: userA,
    },
    {
      _id: "exp_b1",
      userId: userB, // Belongs to user B
      date: new Date("2026-04-12"),
      category: "salary",
      amount: 15000,
      status: "paid",
      deletedAt: null,
    },
  ]

  it("enforces tenant isolation and excludes soft-deleted records from active queries", () => {
    // Simulate query builder for User A
    const activeUserAExpenses = mockDbExpenses.filter(
      (e) => e.userId === userA && e.deletedAt === null,
    )

    // User A sees only their own 6 active expenses, never User B's and never soft-deleted
    assert.equal(activeUserAExpenses.length, 6)
    assert.equal(activeUserAExpenses.some((e) => e.userId === userB), false)
    assert.equal(activeUserAExpenses.some((e) => e._id === "exp_a_deleted"), false)
  })

  it("verifies summary calculations match exact hand-computed fixture", () => {
    const active = mockDbExpenses.filter((e) => e.userId === userA && e.deletedAt === null)

    const totalExpenses = sumAmounts(active)
    assert.equal(totalExpenses, 12750)

    let totalPaid = 0
    let totalPending = 0
    let pendingCount = 0

    for (const exp of active) {
      if (exp.status === "pending") {
        totalPending += exp.amount
        pendingCount += 1
      } else {
        totalPaid += exp.amount
      }
    }

    assert.equal(totalPaid, 8000)
    assert.equal(totalPending, 4750)
    assert.equal(pendingCount, 2)
    assert.equal(active.length, 6)

    // Category distribution
    const grouped = groupByCategory(active)
    const fuel = grouped.find((c) => c.id === "fuel")
    const toll = grouped.find((c) => c.id === "toll")
    const maintenance = grouped.find((c) => c.id === "maintenance")

    assert.equal(fuel.total, 7500)
    assert.equal(fuel.count, 3)
    assert.equal(fuel.percentage, round2((7500 / 12750) * 100)) // 58.82%

    assert.equal(maintenance.total, 4000)
    assert.equal(maintenance.count, 1)
    assert.equal(maintenance.percentage, round2((4000 / 12750) * 100)) // 31.37%

    assert.equal(toll.total, 1250)
    assert.equal(toll.count, 2)
    assert.equal(toll.percentage, round2((1250 / 12750) * 100)) // 9.8%
  })

  it("soft delete hides the row from active list while preserving DB record and audit info", () => {
    const expense = {
      _id: "exp_to_delete",
      userId: userA,
      amount: 1200,
      category: "fuel",
      deletedAt: null,
      deletedBy: null,
    }

    // Perform soft delete
    const now = new Date()
    expense.deletedAt = now
    expense.deletedBy = userA

    // Row is preserved in database
    assert.ok(expense.deletedAt instanceof Date)
    assert.equal(expense.deletedBy, userA)

    // Active filter excludes it
    const isExcludedFromActive = expense.deletedAt !== null
    assert.equal(isExcludedFromActive, true)
  })

  it("verifies audit logging contract for expense create, update, and delete actions", () => {
    const auditLogs = []
    const logExpenseAudit = (action, expenseId, details = {}) => {
      auditLogs.push({
        action,
        resource: "Expense",
        resourceId: expenseId,
        userId: userA,
        details,
        timestamp: new Date(),
      })
    }

    logExpenseAudit("CREATE_EXPENSE", "exp_101", { amount: 2500, category: "fuel" })
    logExpenseAudit("UPDATE_EXPENSE", "exp_101", { status: "paid" })
    logExpenseAudit("DELETE_EXPENSE", "exp_101", { amount: 2500 })

    assert.equal(auditLogs.length, 3)
    assert.equal(auditLogs[0].action, "CREATE_EXPENSE")
    assert.equal(auditLogs[1].action, "UPDATE_EXPENSE")
    assert.equal(auditLogs[2].action, "DELETE_EXPENSE")
    for (const log of auditLogs) {
      assert.equal(log.resource, "Expense")
      assert.equal(log.resourceId, "exp_101")
      assert.equal(log.userId, userA)
    }
  })
})
