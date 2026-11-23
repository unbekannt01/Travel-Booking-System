import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  ACCOUNTS,
  ENTRY_TYPES,
  MANUAL_ENTRY_TYPES,
  TYPE_SORT_ORDER,
  CASHBOOK_LABELS,
  round2,
  toPaise,
  fromPaise,
  modeToAccount,
  toDateString,
  validateManualEntry,
  buildDayBook,
  computeClosePreview,
  renderDayBookHtml,
} from "../shared/cashbook.js"

describe("Cash Book Pure Engine (Part 6a)", () => {
  test("Constants, conversion helpers, and catalogs are correct", () => {
    assert.ok(Object.isFrozen(ACCOUNTS))
    assert.deepEqual([...ACCOUNTS], ["cash", "bank"])

    assert.ok(Object.isFrozen(ENTRY_TYPES))

    assert.equal(toPaise(100.5), 10050)
    assert.equal(fromPaise(10050), 100.5)
    assert.equal(round2(10.555), 10.56)
    assert.equal(toDateString("2026-11-23T12:00:00Z"), "2026-11-23")
    assert.ok(ENTRY_TYPES.includes("receipt"))
    assert.ok(ENTRY_TYPES.includes("refund"))
    assert.ok(ENTRY_TYPES.includes("expense"))
    assert.ok(ENTRY_TYPES.includes("transfer-to-bank"))
    assert.ok(ENTRY_TYPES.includes("transfer-to-cash"))
    assert.ok(ENTRY_TYPES.includes("owner-in"))
    assert.ok(ENTRY_TYPES.includes("owner-out"))
    assert.ok(ENTRY_TYPES.includes("adjustment"))
    assert.ok(ENTRY_TYPES.includes("opening"))

    assert.ok(Object.isFrozen(MANUAL_ENTRY_TYPES))
    assert.ok(Object.isFrozen(TYPE_SORT_ORDER))
    assert.ok(Object.isFrozen(CASHBOOK_LABELS))
  })

  test("modeToAccount maps payment modes correctly and handles unknown modes", () => {
    assert.deepEqual(modeToAccount("Cash"), { account: "cash", isFallback: false })
    assert.deepEqual(modeToAccount("cash"), { account: "cash", isFallback: false })
    assert.deepEqual(modeToAccount("rokar"), { account: "cash", isFallback: false })
    assert.deepEqual(modeToAccount("nakad"), { account: "cash", isFallback: false })

    assert.deepEqual(modeToAccount("UPI"), { account: "bank", isFallback: false })
    assert.deepEqual(modeToAccount("bank"), { account: "bank", isFallback: false })
    assert.deepEqual(modeToAccount("Net Banking"), { account: "bank", isFallback: false })
    assert.deepEqual(modeToAccount("Card"), { account: "bank", isFallback: false })
    assert.deepEqual(modeToAccount("Cheque"), { account: "bank", isFallback: false })
    assert.deepEqual(modeToAccount("NEFT"), { account: "bank", isFallback: false })
    assert.deepEqual(modeToAccount("RTGS"), { account: "bank", isFallback: false })
    assert.deepEqual(modeToAccount("IMPS"), { account: "bank", isFallback: false })

    // Unknown mode defaults to bank with fallback flag
    assert.deepEqual(modeToAccount("Bitcoin"), { account: "bank", isFallback: true })
    assert.deepEqual(modeToAccount(""), { account: "cash", isFallback: false })
    assert.deepEqual(modeToAccount(null), { account: "cash", isFallback: false })
  })

  test("validateManualEntry validates manual cash and bank entries", () => {
    // Valid transfer
    const v1 = validateManualEntry({
      type: "transfer-to-bank",
      amount: 5000,
      account: "cash",
      date: "2026-11-23",
      notes: "Cash deposit to bank",
    })
    assert.equal(v1.valid, true)
    assert.equal(v1.errors.length, 0)

    // Missing notes on adjustment
    const v2 = validateManualEntry({
      type: "adjustment",
      amount: 100,
      account: "cash",
      date: "2026-11-23",
      notes: "",
    })
    assert.equal(v2.valid, false)
    assert.ok(v2.errors.includes("ADJUSTMENT_REQUIRES_NOTES"))

    // Invalid amount
    const v3 = validateManualEntry({
      type: "owner-in",
      amount: -500,
      account: "bank",
      date: "2026-11-23",
    })
    assert.equal(v3.valid, false)
    assert.ok(v3.errors.includes("INVALID_AMOUNT"))

    // Invalid type
    const v4 = validateManualEntry({
      type: "receipt", // receipts are automated, not manual
      amount: 500,
      account: "cash",
      date: "2026-11-23",
    })
    assert.equal(v4.valid, false)
    assert.ok(v4.errors.some((e) => e.startsWith("INVALID_TYPE")))
  })

  test("buildDayBook calculates opening, closing, running balances and same-day ordering", () => {
    const setup = {
      cashOpening: 10000,
      bankOpening: 50000,
      asOfDate: "2026-11-01",
    }

    const bookings = [
      {
        _id: "b1",
        invoiceNo: "INV-001",
        date: "2026-11-20",
        tourName: "Dwarka Somnath",
        contactName: "Ramesh Patel",
        advanceReceived: 5000,
        paymentMode: "Cash",
        status: "Confirmed",
      },
    ]

    const payments = [
      {
        _id: "p1",
        bookingId: "b1",
        receiptNo: "REC-001",
        amount: 5000,
        paymentMode: "Cash",
        paymentDate: "2026-11-20",
        type: "advance",
        isVoid: false,
      },
      {
        _id: "p2",
        receiptNo: "REC-002",
        amount: 8000,
        paymentMode: "UPI",
        paymentDate: "2026-11-23",
        type: "balance",
        isVoid: false,
        bookingId: {
          _id: "b2",
          invoiceNo: "INV-002",
          tourName: "Statue of Unity",
          contactName: "Jignesh Shah",
        },
      },
    ]

    const expenses = [
      {
        _id: "e1",
        category: "fuel",
        amount: 3000,
        paymentMode: "cash",
        status: "paid",
        paidOn: "2026-11-23",
        vendor: "Bharat Petroleum",
      },
      {
        _id: "e2",
        category: "toll",
        amount: 800,
        paymentMode: "upi",
        status: "paid",
        paidOn: "2026-11-23",
        vendor: "Fastag NHAI",
      },
      {
        _id: "e3",
        category: "hotel",
        amount: 15000,
        paymentMode: "bank",
        status: "pending", // Pending should NOT affect cash book
        date: "2026-11-23",
      },
    ]

    const manualEntries = [
      {
        _id: "m1",
        type: "transfer-to-bank",
        amount: 2000,
        account: "cash",
        date: "2026-11-23",
        notes: "Bank cash deposit",
      },
    ]

    // Build day book for 2026-11-23 (Single day)
    const dayBook = buildDayBook({
      startDate: "2026-11-23",
      endDate: "2026-11-23",
      setup,
      bookings,
      payments,
      expenses,
      manualEntries,
    })

    // Opening balances on 2026-11-23:
    // Started at 10000 cash, 50000 bank on 2026-11-01.
    // On 2026-11-20: p1 added 5000 cash.
    // So on 2026-11-23 morning: cash opening = 15000, bank opening = 50000
    assert.equal(dayBook.opening.cash, 15000)
    assert.equal(dayBook.opening.bank, 50000)
    assert.equal(dayBook.opening.total, 65000)

    // In-scope entries on 2026-11-23:
    // 1. Receipt p2: +8000 bank
    // 2. Transfer m1: -2000 cash, +2000 bank
    // 3. Expense e1: -3000 cash
    // 4. Expense e2: -800 bank
    // (e3 excluded because pending)
    assert.equal(dayBook.entries.length, 4)

    // Check same-day ordering:
    // Type order: receipt (1) -> transfer (2) -> expense (4)
    assert.equal(dayBook.entries[0].type, "receipt")
    assert.equal(dayBook.entries[1].type, "transfer-to-bank")
    assert.equal(dayBook.entries[2].type, "expense")
    assert.equal(dayBook.entries[3].type, "expense")

    // Running balances check:
    // Start: Cash 15000, Bank 50000
    // After receipt p2 (+8000 bank): Cash 15000, Bank 58000
    assert.equal(dayBook.entries[0].cashBalance, 15000)
    assert.equal(dayBook.entries[0].bankBalance, 58000)

    // After transfer m1 (-2000 cash, +2000 bank): Cash 13000, Bank 60000
    assert.equal(dayBook.entries[1].cashBalance, 13000)
    assert.equal(dayBook.entries[1].bankBalance, 60000)

    // After fuel e1 (-3000 cash): Cash 10000, Bank 60000
    assert.equal(dayBook.entries[2].cashBalance, 10000)
    assert.equal(dayBook.entries[2].bankBalance, 60000)

    // After toll e2 (-800 bank): Cash 10000, Bank 59200
    assert.equal(dayBook.entries[3].cashBalance, 10000)
    assert.equal(dayBook.entries[3].bankBalance, 59200)

    // Closing totals
    assert.equal(dayBook.closing.cash, 10000)
    assert.equal(dayBook.closing.bank, 59200)
    assert.equal(dayBook.closing.total, 69200)

    // Totals summary
    assert.equal(dayBook.totals.receipts.bank, 8000)
    assert.equal(dayBook.totals.expenses.cash, 3000)
    assert.equal(dayBook.totals.expenses.bank, 800)
    assert.equal(dayBook.totals.transfers.cash, 2000)
    assert.equal(dayBook.totals.transfers.bank, 2000)
    assert.equal(dayBook.totals.netCashChange, -5000)
    assert.equal(dayBook.totals.netBankChange, 9200)
  })

  test("buildDayBook prevents double counting between Payment collection and Booking embedded advance", () => {
    const setup = { cashOpening: 0, bankOpening: 0, asOfDate: "2026-11-01" }

    // Booking b1 has advanceReceived = 5000 AND also has a record in payments array
    const bookings = [
      {
        _id: "b1",
        invoiceNo: "INV-001",
        date: "2026-11-23",
        advanceReceived: 5000,
        paymentMode: "Cash",
        status: "Confirmed",
      },
    ]

    const payments = [
      {
        _id: "p1",
        bookingId: "b1",
        receiptNo: "REC-001",
        amount: 5000,
        paymentMode: "Cash",
        paymentDate: "2026-11-23",
        type: "advance",
        isVoid: false,
      },
    ]

    const dayBook = buildDayBook({
      startDate: "2026-11-23",
      endDate: "2026-11-23",
      setup,
      bookings,
      payments,
    })

    // Should contain exactly 1 receipt, NOT 2
    assert.equal(dayBook.entries.length, 1)
    assert.equal(dayBook.closing.cash, 5000)
  })

  test("computeClosePreview calculates cash differences and suggested adjustments", () => {
    const dayBook = {
      closing: { cash: 10000, bank: 50000, total: 60000 },
    }

    // Exact match: balanced
    const p1 = computeClosePreview({
      asOfDate: "2026-11-23",
      countedCash: 10000,
      dayBook,
    })
    assert.equal(p1.status, "balanced")
    assert.equal(p1.difference, 0)
    assert.equal(p1.isBalanced, true)
    assert.equal(p1.suggestedAdjustment, null)

    // Shortage: counted 9800 vs 10000 system -> -200 shortage
    const p2 = computeClosePreview({
      asOfDate: "2026-11-23",
      countedCash: 9800,
      dayBook,
    })
    assert.equal(p2.status, "short")
    assert.equal(p2.difference, -200)
    assert.equal(p2.isBalanced, false)
    assert.ok(p2.suggestedAdjustment)
    assert.equal(p2.suggestedAdjustment.amount, 200)
    assert.equal(p2.suggestedAdjustment.direction, "debit")

    // Excess: counted 10150 vs 10000 system -> +150 excess
    const p3 = computeClosePreview({
      asOfDate: "2026-11-23",
      countedCash: 10150,
      dayBook,
    })
    assert.equal(p3.status, "excess")
    assert.equal(p3.difference, 150)
    assert.equal(p3.isBalanced, false)
    assert.ok(p3.suggestedAdjustment)
    assert.equal(p3.suggestedAdjustment.amount, 150)
    assert.equal(p3.suggestedAdjustment.direction, "credit")
  })

  test("renderDayBookHtml outputs valid standalone HTML with CSP meta tag", () => {
    const dayBook = {
      startDate: "2026-11-23",
      endDate: "2026-11-23",
      opening: { cash: 10000, bank: 50000, total: 60000 },
      totals: {
        receipts: { cash: 5000, bank: 8000, total: 13000 },
        refunds: { cash: 0, bank: 0, total: 0 },
        expenses: { cash: 2000, bank: 500, total: 2500 },
        transfers: { cash: 1000, bank: 1000 },
        owner: { cash: 0, bank: 0 },
        adjustments: { cash: 0, bank: 0 },
        netCashChange: 2000,
        netBankChange: 8500,
      },
      closing: { cash: 12000, bank: 58500, total: 70500 },
      entries: [
        {
          id: "tx-1",
          date: "2026-11-23",
          type: "receipt",
          account: "cash",
          amount: 5000,
          voucherNo: "REC-101",
          partyName: "Jayesh Patel",
          description: "Advance for #INV-101",
          cashDelta: 5000,
          bankDelta: 0,
          cashBalance: 15000,
          bankBalance: 50000,
        },
      ],
    }

    const html = renderDayBookHtml({
      dayBook,
      company: { companyName: "Somnath Travels", companyPhone: "9825012345" },
      language: "en",
    })

    assert.ok(html.includes("<!DOCTYPE html>"))
    assert.ok(html.includes("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline';\">"))
    assert.ok(html.includes("Somnath Travels"))
    assert.ok(html.includes("9825012345"))
    assert.ok(html.includes("REC-101"))
    assert.ok(html.includes("Jayesh Patel"))
    assert.ok(html.includes("Customer Receipt"))
    assert.ok(!html.includes("<script"))
  })

  test("IST date handling at midnight and ISO strings normalization", () => {
    assert.equal(toDateString("2026-11-23"), "2026-11-23")
    assert.equal(toDateString("2026-11-23T00:00:00.000Z"), "2026-11-23")
    assert.equal(toDateString("2026-11-23T23:59:59.999Z"), "2026-11-23")
    assert.equal(toDateString(""), "")
    assert.equal(toDateString(null), "")
    assert.equal(toDateString(undefined), "")
  })

  test("Same-day entry ordering adheres strictly to TYPE_SORT_ORDER", () => {
    const rawEntries = [
      { id: "e1", date: "2026-11-23", type: "adjustment", amount: 100, account: "cash" },
      { id: "e2", date: "2026-11-23", type: "receipt", amount: 500, account: "cash" },
      { id: "e3", date: "2026-11-23", type: "expense", amount: 200, account: "cash" },
      { id: "e4", date: "2026-11-23", type: "transfer-to-bank", amount: 300, account: "cash" },
      { id: "e5", date: "2026-11-23", type: "refund", amount: 50, account: "cash" },
      { id: "e6", date: "2026-11-23", type: "owner-in", amount: 1000, account: "cash" },
    ]

    const dayBook = buildDayBook({
      startDate: "2026-11-23",
      endDate: "2026-11-23",
      opening: { cash: 1000, bank: 2000, total: 3000 },
      manualEntries: rawEntries.filter((e) => MANUAL_ENTRY_TYPES.includes(e.type)),
      payments: [
        { _id: "p1", paymentDate: "2026-11-23", amount: 500, paymentMode: "cash", receiptNo: "R-1", type: "advance" },
        { _id: "p2", paymentDate: "2026-11-23", amount: 50, paymentMode: "cash", receiptNo: "REF-1", type: "refund" },
      ],
      expenses: [{ _id: "x1", paidOn: "2026-11-23", amount: 200, paymentMode: "cash", status: "paid" }],
    })

    const types = dayBook.entries.map((e) => e.type || e.sourceType)
    // Receipts (1) -> Transfer (2) -> Refund (3) -> Expense (4) -> Owner-in (5) -> Adjustment (6)
    assert.deepEqual(types, [
      "receipt",
      "transfer-to-bank",
      "refund",
      "expense",
      "owner-in",
      "adjustment",
    ])
  })

  test("Integer paise rounding and precision eliminates floating point drift", () => {
    // 0.1 + 0.2 floating point anomaly
    assert.equal(0.1 + 0.2 === 0.3, false)
    assert.equal(toPaise(0.1) + toPaise(0.2), 30)
    assert.equal(fromPaise(30), 0.3)

    assert.equal(toPaise("1500.75"), 150075)
    assert.equal(toPaise(1500.75), 150075)
    assert.equal(toPaise(0), 0)
    assert.equal(fromPaise(150075), 1500.75)
    assert.equal(fromPaise(0), 0)

    assert.equal(round2(1.005), 1.01)
    assert.equal(round2(1.004), 1)
  })

  test("Label sets completeness for en, hi, and gu", () => {
    const enKeys = Object.keys(CASHBOOK_LABELS.en)
    const hiKeys = Object.keys(CASHBOOK_LABELS.hi)
    const guKeys = Object.keys(CASHBOOK_LABELS.gu)

    assert.deepEqual(hiKeys.sort(), enKeys.sort())
    assert.deepEqual(guKeys.sort(), enKeys.sort())

    // Check all manual entry types are present
    for (const type of MANUAL_ENTRY_TYPES) {
      assert.ok(CASHBOOK_LABELS.en[type], `Missing EN label for ${type}`)
      assert.ok(CASHBOOK_LABELS.hi[type], `Missing HI label for ${type}`)
      assert.ok(CASHBOOK_LABELS.gu[type], `Missing GU label for ${type}`)
    }
  })

  test("renderDayBookHtml strictly escapes hostile strings and prevents XSS", () => {
    const dayBook = {
      startDate: "2026-11-23",
      endDate: "2026-11-23",
      opening: { cash: 1000, bank: 2000, total: 3000 },
      totals: {
        receipts: { cash: 500, bank: 0, total: 500 },
        refunds: { cash: 0, bank: 0, total: 0 },
        expenses: { cash: 0, bank: 0, total: 0 },
        transfers: { cash: 0, bank: 0 },
        owner: { cash: 0, bank: 0 },
        adjustments: { cash: 0, bank: 0 },
        netCashChange: 500,
        netBankChange: 0,
      },
      closing: { cash: 1500, bank: 2000, total: 3500 },
      entries: [
        {
          id: "hostile-1",
          date: "2026-11-23",
          type: "receipt",
          account: "cash",
          amount: 500,
          voucherNo: '<script>alert("xss-voucher")</script>',
          partyName: '<img src=x onerror="alert(\'xss-party\')">',
          description: '<svg/onload=alert("xss-desc")>',
          cashDelta: 500,
          bankDelta: 0,
          cashBalance: 1500,
          bankBalance: 2000,
        },
      ],
    }

    const html = renderDayBookHtml({
      dayBook,
      company: {
        companyName: '<b onmouseover=alert("xss-co")>Hacked Co</b>',
        companyPhone: '9825012345"><script>alert(1)</script>',
      },
      language: "en",
    })

    assert.ok(!html.includes("<script>"))
    assert.ok(!html.includes("<img src=x"))
    assert.ok(!html.includes("<svg/onload"))
    assert.ok(!html.includes("<b onmouseover="))
    assert.ok(html.includes("&lt;b onmouseover=&quot;alert(&apos;xss-co&apos;)&quot;&gt;Hacked Co&lt;/b&gt;") || html.includes("&lt;b onmouseover=alert(&quot;xss-co&quot;)&gt;Hacked Co&lt;/b&gt;"))
    assert.ok(html.includes("&lt;script&gt;alert(&quot;xss-voucher&quot;)&lt;/script&gt;"))
    assert.ok(html.includes("&lt;img src=x"))
    assert.ok(html.includes("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline';\">"))
  })
})
