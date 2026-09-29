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

  test("businessLogic.js (ESM) and businessLogic.cjs (CJS) are 100% in sync and return identical outputs", async () => {
    const esmLogic = await import("../shared/businessLogic.js")
    const cjsLogic = require("../shared/businessLogic.cjs")

    // 1. Export key parity
    const esmKeys = Object.keys(esmLogic).sort()
    const cjsKeys = Object.keys(cjsLogic).sort()
    assert.deepStrictEqual(
      esmKeys,
      cjsKeys,
      "Exported function names between shared/businessLogic.js and shared/businessLogic.cjs must be identical"
    )

    // 2. round2
    const testNumbers = [10.555, 0, 100, 100.1234, -45.678, "99.999", "invalid"]
    for (const num of testNumbers) {
      assert.strictEqual(esmLogic.round2(num), cjsLogic.round2(num), `round2 divergence on ${num}`)
    }

    // 3. calculatePricing across scenarios
    const pricingScenarios = [
      { baseAmount: 10000, discountType: "fixed", discountValue: 500, gstRate: 5, isTaxInclusive: false },
      { baseAmount: 12500, discountType: "percentage", discountValue: 10, gstRate: 5, isTaxInclusive: true },
      { baseAmount: 8000, discountType: "fixed", discountValue: 0, gstRate: 0, isTaxInclusive: false },
      { baseAmount: 0, discountType: "fixed", discountValue: 100, gstRate: 18, isTaxInclusive: false },
    ]
    for (const scenario of pricingScenarios) {
      assert.deepStrictEqual(
        esmLogic.calculatePricing(scenario),
        cjsLogic.calculatePricing(scenario),
        "calculatePricing divergence"
      )
    }

    // 4. generateTourCode & getMonthCode
    const tours = ["Kedarnath Yatra", "Somnath", "Char Dham Express", "Goa", "", null]
    for (const t of tours) {
      assert.strictEqual(esmLogic.generateTourCode(t), cjsLogic.generateTourCode(t), `generateTourCode divergence on ${t}`)
    }
    const dates = ["2026-01-01", "2026-05-15", "2026-10-31", new Date()]
    for (const d of dates) {
      assert.strictEqual(esmLogic.getMonthCode(d), cjsLogic.getMonthCode(d), `getMonthCode divergence on ${d}`)
    }

    // 5. buildInvoicePrefix & calculateNextInvoiceNo
    for (const t of ["Kedarnath", "Dwarka"]) {
      for (const d of ["2026-06-01", "2026-11-20"]) {
        const esmPfx = esmLogic.buildInvoicePrefix("ABC", t, d)
        const cjsPfx = cjsLogic.buildInvoicePrefix("ABC", t, d)
        assert.strictEqual(esmPfx, cjsPfx)

        const list = [`${esmPfx}001`, `${esmPfx}005`, `${esmPfx}002`]
        assert.strictEqual(
          esmLogic.calculateNextInvoiceNo(list, esmPfx),
          cjsLogic.calculateNextInvoiceNo(list, cjsPfx)
        )
      }
    }

    // 6. buildReceiptPrefix & calculateNextReceiptNo
    const esmRecPfx = esmLogic.buildReceiptPrefix("REC", "2026-09-15")
    const cjsRecPfx = cjsLogic.buildReceiptPrefix("REC", "2026-09-15")
    assert.strictEqual(esmRecPfx, cjsRecPfx)
    assert.strictEqual(
      esmLogic.calculateNextReceiptNo([`${esmRecPfx}010`], esmRecPfx),
      cjsLogic.calculateNextReceiptNo([`${esmRecPfx}010`], cjsRecPfx)
    )

    // 7. validateIndianPhone & validateAadhaar
    const phones = ["9876543210", "+919876543210", "09876543210", "12345", "", null]
    for (const p of phones) {
      assert.strictEqual(esmLogic.validateIndianPhone(p), cjsLogic.validateIndianPhone(p))
    }
    const aadhars = ["123456789012", "1234 5678 9012", "123", "", null]
    for (const a of aadhars) {
      assert.strictEqual(esmLogic.validateAadhaar(a), cjsLogic.validateAadhaar(a))
    }

    // 8. calculateCancellationRefund
    const cancelCases = [
      { totalPaid: 10000, cancellationCharge: 2000 },
      { totalPaid: 5000, cancellationCharge: 0 },
      { totalPaid: 3000, cancellationCharge: 3000 },
    ]
    for (const c of cancelCases) {
      assert.deepStrictEqual(
        esmLogic.calculateCancellationRefund(c),
        cjsLogic.calculateCancellationRefund(c)
      )
    }

    // 9. computeLedgerTotals
    const payments = [
      { amount: 5000, type: "advance", isVoid: false },
      { amount: 2000, type: "partial", isVoid: false },
      { amount: 1000, type: "partial", isVoid: true },
      { amount: 500, type: "refund", isVoid: false },
    ]
    assert.deepStrictEqual(
      esmLogic.computeLedgerTotals(payments, 10000),
      cjsLogic.computeLedgerTotals(payments, 10000)
    )

    // 10. findSeatConflicts
    const passList = [{ seatId: "U1" }, { seatId: "U2" }]
    const occupiedMap = new Map([["U1", true]])
    assert.deepStrictEqual(
      esmLogic.findSeatConflicts({ passengers: passList, occupiedSeatMap: occupiedMap }),
      cjsLogic.findSeatConflicts({ passengers: passList, occupiedSeatMap: occupiedMap })
    )
  })
})

