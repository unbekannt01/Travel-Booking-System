import test from "node:test"
import assert from "node:assert/strict"
import {
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  toDateString,
  calculateDayDiff,
  classifyAgingBucket,
  calculateReceivables,
} from "../shared/receivables.js"
import { calculateProfitLoss } from "../shared/profitLoss.js"

test("Receivables: AGING_BUCKETS and AGING_BUCKET_LABELS are frozen", () => {
  assert.ok(Object.isFrozen(AGING_BUCKETS))
  assert.ok(Object.isFrozen(AGING_BUCKET_LABELS))
  assert.deepEqual(AGING_BUCKETS, ["not-due", "0-30", "31-60", "61-90", "90-plus"])
})

test("Receivables: toDateString handles Date objects, timestamps and ISO strings", () => {
  assert.equal(toDateString("2026-05-15T12:00:00Z"), "2026-05-15")
  assert.equal(toDateString(new Date("2026-05-15T00:00:00Z")), "2026-05-15")
  assert.equal(toDateString("2026-05-15"), "2026-05-15")
})

test("Receivables: calculateDayDiff calculates integer day diff accurately using UTC midnight", () => {
  assert.equal(calculateDayDiff("2026-05-15", "2026-05-15"), 0)
  assert.equal(calculateDayDiff("2026-05-16", "2026-05-15"), 1)
  assert.equal(calculateDayDiff("2026-05-15", "2026-05-16"), -1)
  assert.equal(calculateDayDiff("2026-06-14", "2026-05-15"), 30)
  assert.equal(calculateDayDiff("2026-06-15", "2026-05-15"), 31)
  assert.equal(calculateDayDiff("2026-08-13", "2026-05-15"), 90)
  assert.equal(calculateDayDiff("2026-08-14", "2026-05-15"), 91)
})

test("Receivables: classifyAgingBucket maps day difference to 5 frozen buckets", () => {
  assert.equal(classifyAgingBucket(-5), "not-due")
  assert.equal(classifyAgingBucket(-1), "not-due")
  assert.equal(classifyAgingBucket(0), "0-30")
  assert.equal(classifyAgingBucket(15), "0-30")
  assert.equal(classifyAgingBucket(30), "0-30")
  assert.equal(classifyAgingBucket(31), "31-60")
  assert.equal(classifyAgingBucket(60), "31-60")
  assert.equal(classifyAgingBucket(61), "61-90")
  assert.equal(classifyAgingBucket(90), "61-90")
  assert.equal(classifyAgingBucket(91), "90-plus")
  assert.equal(classifyAgingBucket(180), "90-plus")
})

test("Receivables: calculateReceivables groups active bookings across buckets (Journey Basis)", () => {
  const asOf = "2026-05-15"
  const mockBookings = [
    // Future journey: not-due
    {
      _id: "b1",
      customerId: "c1",
      customerName: "Ramesh Patel",
      tourName: "Chardham",
      journeyDate: "2026-05-20", // 5 days in future
      date: "2026-04-01",
      totalAmount: 10000,
      payments: [{ amount: 2000, isVoid: false }],
    },
    // Journey 10 days ago: 0-30 bucket
    {
      _id: "b2",
      customerId: "c1",
      customerName: "Ramesh Patel",
      tourName: "Chardham",
      journeyDate: "2026-05-05", // 10 days overdue
      date: "2026-04-01",
      totalAmount: 15000,
      payments: [{ amount: 5000, isVoid: false }],
    },
    // Journey 45 days ago: 31-60 bucket
    {
      _id: "b3",
      customerId: "c2",
      customerName: "Suresh Shah",
      tourName: "Dwarka",
      journeyDate: "2026-03-31", // 45 days overdue
      date: "2026-03-01",
      totalAmount: 25000,
      payments: [{ amount: 10000, isVoid: false }],
    },
    // Journey 75 days ago: 61-90 bucket
    {
      _id: "b4",
      customerId: "c3",
      customerName: "Mahesh Bhai",
      tourName: "Kashi",
      journeyDate: "2026-03-01", // 75 days overdue
      date: "2026-02-01",
      totalAmount: 8000,
      payments: [{ amount: 2000, isVoid: false }],
    },
    // Journey 100 days ago: 90-plus bucket
    {
      _id: "b5",
      customerId: "c3",
      customerName: "Mahesh Bhai",
      tourName: "Kashi",
      journeyDate: "2026-02-04", // 100 days overdue
      date: "2026-01-01",
      totalAmount: 12000,
      payments: [{ amount: 2000, isVoid: false }],
    },
    // Fully paid booking: excluded from receivables
    {
      _id: "b6_paid",
      customerId: "c1",
      customerName: "Ramesh Patel",
      tourName: "Chardham",
      journeyDate: "2026-05-01",
      totalAmount: 5000,
      payments: [{ amount: 5000, isVoid: false }],
    },
    // Cancelled booking: excluded from receivables (balance due is 0)
    {
      _id: "b7_cancel",
      customerId: "c2",
      customerName: "Suresh Shah",
      tourName: "Dwarka",
      status: "Cancelled",
      cancellationCharge: 1000,
      journeyDate: "2026-05-01",
      totalAmount: 10000,
      payments: [{ amount: 3000, isVoid: false }],
    },
    // Unlinked booking without customerId: groups under "No customer record"
    {
      _id: "b8_unlinked",
      contactName: "Walk-in Guest",
      contactPhone: "9876500000",
      tourName: "Somnath",
      journeyDate: "2026-05-10", // 5 days overdue (0-30 bucket)
      date: "2026-05-01",
      totalAmount: 6000,
      payments: [{ amount: 1000, isVoid: false }],
    },
  ]

  const report = calculateReceivables({
    bookings: mockBookings,
    asOfDate: asOf,
    basis: "journey",
  })

  // Check bucket totals
  // b1: 8000 (not-due)
  // b2: 10000 (0-30)
  // b8: 5000 (0-30)
  // b3: 15000 (31-60)
  // b4: 6000 (61-90)
  // b5: 10000 (90-plus)
  assert.equal(report.bucketTotals["not-due"], 8000)
  assert.equal(report.bucketTotals["0-30"], 15000) // 10000 (b2) + 5000 (b8)
  assert.equal(report.bucketTotals["31-60"], 15000)
  assert.equal(report.bucketTotals["61-90"], 6000)
  assert.equal(report.bucketTotals["90-plus"], 10000)

  // Total outstanding: 8000 + 15000 + 15000 + 6000 + 10000 = 54000
  assert.equal(report.totalOutstanding, 54000)

  // Overdue total (excluding not-due): 15000 + 15000 + 6000 + 10000 = 46000
  assert.equal(report.totalOverdue, 46000)
  assert.equal(report.notDueAmount, 8000)

  // Max overdue days: 100 (from b5)
  assert.equal(report.oldestOverdueDays, 100)

  // Customer groupings: c1, c2, c3, unlinked
  assert.equal(report.customersOwingCount, 4)

  // Customer c1 rollup: b1 (8000 not due) + b2 (10000 in 0-30) = 18000 total
  const c1Group = report.customers.find((c) => c.customerId === "c1")
  assert.ok(c1Group)
  assert.equal(c1Group.totalOutstanding, 18000)
  assert.equal(c1Group.overdueAmount, 10000)
  assert.equal(c1Group.notDueAmount, 8000)
  assert.equal(c1Group.bookingsCount, 2)

  // Unlinked group
  const unlinkedGroup = report.customers.find((c) => c.isUnlinked)
  assert.ok(unlinkedGroup)
  assert.equal(unlinkedGroup.totalOutstanding, 5000)
  assert.equal(unlinkedGroup.bookingsCount, 1)

  // Zero P&L divergence check
  const pnl = calculateProfitLoss({ bookings: mockBookings, expenses: [] })
  assert.equal(report.totalOutstanding, pnl.summary.outstanding)
})

test("Receivables: calculateReceivables supports booking date basis", () => {
  const asOf = "2026-05-15"
  const mockBookings = [
    {
      _id: "b1",
      customerId: "c1",
      customerName: "Ramesh Patel",
      tourName: "Chardham",
      journeyDate: "2026-06-15", // Future journey date
      date: "2026-05-01", // Booked 14 days ago
      totalAmount: 10000,
      payments: [{ amount: 2000, isVoid: false }],
    },
  ]

  // On journey basis, b1 is not-due
  const journeyReport = calculateReceivables({
    bookings: mockBookings,
    asOfDate: asOf,
    basis: "journey",
  })
  assert.equal(journeyReport.bucketTotals["not-due"], 8000)
  assert.equal(journeyReport.bucketTotals["0-30"], 0)

  // On booking basis, b1 was booked 14 days ago, so it is in 0-30 bucket!
  const bookingReport = calculateReceivables({
    bookings: mockBookings,
    asOfDate: asOf,
    basis: "booking",
  })
  assert.equal(bookingReport.bucketTotals["not-due"], 0)
  assert.equal(bookingReport.bucketTotals["0-30"], 8000)
})
