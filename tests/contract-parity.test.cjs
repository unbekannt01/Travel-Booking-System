const { test, describe } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")

// Pure logic
const businessLogic = require("../shared/businessLogic.cjs")

describe("Adapter Contract & Business Logic Parity", () => {
  test("rest.js and sqlite.js export identical function signatures", () => {
    const restPath = path.join(process.cwd(), "src", "data", "adapters", "rest.js")
    const sqlitePath = path.join(process.cwd(), "src", "data", "adapters", "sqlite.js")

    const restCode = fs.readFileSync(restPath, "utf-8")
    const sqliteCode = fs.readFileSync(sqlitePath, "utf-8")

    const getExports = (code) => {
      const matches = code.matchAll(/export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g)
      return new Set([...matches].map((m) => m[1]))
    }

    const restExports = getExports(restCode)
    const sqliteExports = getExports(sqliteCode)

    const requiredMethods = [
      "listBookings",
      "getBooking",
      "createBooking",
      "updateBooking",
      "deleteBooking",
      "restoreBooking",
      "updatePassenger",
      "togglePassengerCheckin",
      "togglePayment",
      "cancelBooking",
      "batchCheckin",
      "swapSeat",
      "listTours",
      "createTour",
      "updateTour",
      "deleteTour",
      "listPayments",
      "recordPayment",
      "voidPayment",
      "getCompanySettings",
      "updateCompanySettings",
      "login",
      "register",
      "logout",
      "updateProfile",
      "updateCompany",
      "getBackupStats",
      "exportDatabaseBackup",
      "restoreDatabaseBackup",
    ]

    for (const method of requiredMethods) {
      assert.ok(restExports.has(method), `rest.js missing method: ${method}`)
      assert.ok(sqliteExports.has(method), `sqlite.js missing method: ${method}`)
    }
  })

  test("pricing calculations produce identical exact results", () => {
    const result1 = businessLogic.calculatePricing({
      baseAmount: 10000,
      discountType: "fixed",
      discountValue: 1000,
      gstRate: 5,
      isTaxInclusive: false,
    })

    assert.strictEqual(result1.baseAmount, 10000)
    assert.strictEqual(result1.discountAmount, 1000)
    assert.strictEqual(result1.netBeforeTax, 9000)
    assert.strictEqual(result1.taxAmount, 450)
    assert.strictEqual(result1.cgstAmount, 225)
    assert.strictEqual(result1.sgstAmount, 225)
    assert.strictEqual(result1.finalTotal, 9450)

    const inclusive = businessLogic.calculatePricing({
      baseAmount: 10500,
      discountType: "fixed",
      discountValue: 0,
      gstRate: 5,
      isTaxInclusive: true,
    })

    assert.strictEqual(inclusive.netBeforeTax, 10000)
    assert.strictEqual(inclusive.taxAmount, 500)
    assert.strictEqual(inclusive.finalTotal, 10500)
  })

  test("cancellation refund logic matches contract", () => {
    const res = businessLogic.calculateCancellationRefund({
      totalPaid: 5000,
      cancellationCharge: 1500,
    })
    assert.strictEqual(res.totalPaid, 5000)
    assert.strictEqual(res.cancellationCharge, 1500)
    assert.strictEqual(res.refundAmount, 3500)
  })

  test("invoice and receipt sequential prefixing parity", () => {
    const invPrefix = businessLogic.buildInvoicePrefix("YHB", "Somnath Temple Tour", "2026-10-15")
    assert.ok(invPrefix.startsWith("YHB-STT-OCT-"))

    const nextInv = businessLogic.calculateNextInvoiceNo(
      [`${invPrefix}001`, `${invPrefix}002`],
      invPrefix
    )
    assert.strictEqual(nextInv, `${invPrefix}003`)

    const recPrefix = businessLogic.buildReceiptPrefix("REC", new Date("2026-10-15"))
    assert.strictEqual(recPrefix, "REC-2610-")

    const nextRec = businessLogic.calculateNextReceiptNo([`${recPrefix}001`], recPrefix)
    assert.strictEqual(nextRec, `${recPrefix}002`)
  })
})
