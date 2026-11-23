import test from "node:test"
import assert from "node:assert/strict"
import { buildCustomerStatement } from "../shared/statements.js"
import { renderCustomerStatementHtml, STATEMENT_I18N } from "../shared/statementRenderer.js"
import { calculateReceivables } from "../shared/receivables.js"

test("Statements: buildCustomerStatement computes opening balance and same-day debits before credits", () => {
  const customer = {
    _id: "c1",
    name: "Ramesh Patel",
    phone: "9876543210",
    city: "Ahmedabad",
  }

  const bookings = [
    // Prior booking (before fromDate "2026-05-01")
    {
      _id: "b_old",
      invoiceNo: "INV-001",
      date: "2026-04-10",
      totalAmount: 15000,
      payments: [
        { amount: 5000, date: "2026-04-10", type: "upi", isVoid: false },
      ],
    },
    // In-period booking (on "2026-05-10")
    {
      _id: "b_new",
      invoiceNo: "INV-002",
      date: "2026-05-10",
      totalAmount: 20000,
      payments: [
        // Payment on the same day as booking
        { amount: 8000, date: "2026-05-10", type: "cash", isVoid: false },
        // Follow-up payment 2 days later
        { amount: 4000, date: "2026-05-12", type: "bank", isVoid: false },
      ],
    },
  ]

  const statement = buildCustomerStatement({
    customer,
    bookings,
    from: "2026-05-01",
    to: "2026-05-31",
  })

  // Opening balance before 2026-05-01: 15000 - 5000 = 10000
  assert.equal(statement.openingBalance, 10000)

  // In-period lines:
  // Line 1: 2026-05-10 Booking INV-002 (Debit 20,000, Running 30,000) - Debits first!
  // Line 2: 2026-05-10 Payment (Credit 8,000, Running 22,000) - Credits after!
  // Line 3: 2026-05-12 Payment (Credit 4,000, Running 18,000)
  assert.equal(statement.lines.length, 3)

  assert.equal(statement.lines[0].date, "2026-05-10")
  assert.equal(statement.lines[0].type, "booking")
  assert.equal(statement.lines[0].debit, 20000)
  assert.equal(statement.lines[0].credit, 0)
  assert.equal(statement.lines[0].runningBalance, 30000)

  assert.equal(statement.lines[1].date, "2026-05-10")
  assert.equal(statement.lines[1].type, "payment")
  assert.equal(statement.lines[1].debit, 0)
  assert.equal(statement.lines[1].credit, 8000)
  assert.equal(statement.lines[1].runningBalance, 22000)

  assert.equal(statement.lines[2].date, "2026-05-12")
  assert.equal(statement.lines[2].type, "payment")
  assert.equal(statement.lines[2].debit, 0)
  assert.equal(statement.lines[2].credit, 4000)
  assert.equal(statement.lines[2].runningBalance, 18000)

  // Closing balance: 18,000 (10,000 opening + 20,000 debit - 12,000 credit)
  assert.equal(statement.closingBalance, 18000)
  assert.equal(statement.totalDebits, 20000)
  assert.equal(statement.totalCredits, 12000)
})

test("Statements: handles cancelled booking with cancellation fee and refund", () => {
  const customer = { _id: "c2", name: "Suresh Shah" }
  const bookings = [
    {
      _id: "b_cancel",
      invoiceNo: "INV-003",
      date: "2026-05-01",
      totalAmount: 12000,
      status: "Cancelled",
      cancellationCharge: 2000,
      refundAmount: 3000,
      cancelledAt: "2026-05-05",
      payments: [
        { amount: 5000, date: "2026-05-01", isVoid: false },
      ],
    },
  ]

  const statement = buildCustomerStatement({
    customer,
    bookings,
    from: "2026-05-01",
    to: "2026-05-31",
  })

  // Net effect on closing balance must be 0 (no outstanding dues on cancelled booking)
  assert.equal(statement.openingBalance, 0)
  assert.equal(statement.closingBalance, 0)
  assert.equal(statement.summary.totalCancellationFees, 2000)
})

test("Statements: closing balance strictly matches receivables totalOutstanding for all-time", () => {
  const customer = { _id: "c3", name: "Mahesh Bhai", phone: "9876543210" }
  const bookings = [
    {
      _id: "b1",
      customerId: "c3",
      tourName: "Chardham",
      journeyDate: "2026-06-01",
      date: "2026-05-01",
      totalAmount: 25000,
      payments: [{ amount: 10000, date: "2026-05-02", isVoid: false }],
    },
    {
      _id: "b2",
      customerId: "c3",
      tourName: "Dwarka",
      journeyDate: "2026-07-01",
      date: "2026-05-10",
      totalAmount: 18000,
      payments: [{ amount: 6000, date: "2026-05-11", isVoid: false }],
    },
    {
      _id: "b3_cancel",
      customerId: "c3",
      tourName: "Somnath",
      status: "Cancelled",
      cancellationCharge: 1500,
      refundAmount: 3500,
      journeyDate: "2026-05-20",
      date: "2026-05-05",
      totalAmount: 10000,
      payments: [{ amount: 5000, date: "2026-05-05", isVoid: false }],
    },
  ]

  // Receivables engine outstanding for c3
  const receivables = calculateReceivables({
    bookings,
    asOfDate: "2026-05-15",
    basis: "journey",
  })
  const c3Group = receivables.customers.find((c) => c.customerId === "c3")
  assert.ok(c3Group)

  // Statement for c3 across all time up to 2026-05-15
  const statement = buildCustomerStatement({
    customer,
    bookings,
    from: "",
    to: "2026-05-15",
  })

  // Zero divergence: Statement closing balance must equal receivables outstanding!
  assert.equal(statement.closingBalance, c3Group.totalOutstanding)
  // b1: 15000 balance + b2: 12000 balance = 27000
  assert.equal(statement.closingBalance, 27000)
})

test("StatementRenderer: renders strict CSP, escapes XSS, and supports i18n", () => {
  const statement = buildCustomerStatement({
    customer: {
      name: "<script>alert('xss')</script> Patel",
      phone: "9876543210",
      city: "Surat",
    },
    bookings: [
      {
        _id: "b_xss",
        invoiceNo: 'INV-101" onclick="alert(1)',
        date: "2026-05-01",
        totalAmount: 10000,
        payments: [{ amount: 3000, notes: '<img src=x onerror=alert("hack")>' }],
      },
    ],
  })

  // English render
  const htmlEn = renderCustomerStatementHtml({
    statement,
    operatorSettings: { companyName: "Om Travels & Tours" },
    lang: "en",
  })

  // Strict CSP meta tag check
  assert.ok(
    htmlEn.includes(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">`),
    "Must include strict CSP meta tag",
  )

  // XSS attack payloads must be escaped
  assert.ok(!htmlEn.includes("<script>alert"), "Must escape <script>")
  assert.ok(htmlEn.includes("&lt;script&gt;alert"), "Must contain escaped script")
  assert.ok(!htmlEn.includes('<img src=x onerror=alert("hack")>'), "Must escape image tag")

  // Hindi render
  const htmlHi = renderCustomerStatementHtml({
    statement,
    operatorSettings: { companyName: "Om Travels" },
    lang: "hi",
  })
  assert.ok(htmlHi.includes(STATEMENT_I18N.hi.title))
  assert.ok(htmlHi.includes(STATEMENT_I18N.hi.openingBalance))

  // Gujarati render
  const htmlGu = renderCustomerStatementHtml({
    statement,
    operatorSettings: { companyName: "Om Travels" },
    lang: "gu",
  })
  assert.ok(htmlGu.includes(STATEMENT_I18N.gu.title))
  assert.ok(htmlGu.includes(STATEMENT_I18N.gu.openingBalance))
})
