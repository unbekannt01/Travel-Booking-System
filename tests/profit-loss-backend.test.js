import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  calculateProfitLoss,
  parseTourRef,
  isBookingCancelled,
} from "../shared/profitLoss.js"
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_MAP,
  EXPENSE_CATEGORY_IDS,
  round2,
} from "../shared/expenses.js"
import { tourPnlQuerySchema, getCurrentIndianFinancialYearRange } from "../backend/routes/reports.js"

describe("Shared Profit & Loss Engine (shared/profitLoss.js)", () => {
  it("classifies tourRef strings accurately via parseTourRef", () => {
    // 1. Departure key format
    const dep = parseTourRef("Somnath Yatra___2026-04-10___2x1 Sleeper Luxury")
    assert.equal(dep.isDeparture, true)
    assert.equal(dep.isGeneral, false)
    assert.equal(dep.tourName, "Somnath Yatra")
    assert.equal(dep.dateKey, "2026-04-10")
    assert.equal(dep.bus, "2x1 Sleeper Luxury")
    assert.equal(dep.departureKey, "Somnath Yatra___2026-04-10___2x1 Sleeper Luxury")

    // 2. Legacy Tour-name format
    const tour = parseTourRef("Dwarka Darshan")
    assert.equal(tour.isDeparture, false)
    assert.equal(tour.isGeneral, false)
    assert.equal(tour.tourName, "Dwarka Darshan")
    assert.equal(tour.departureKey, null)

    // 3. General unlinked
    const empty = parseTourRef("")
    assert.equal(empty.isGeneral, true)
    assert.equal(empty.tourName, null)
    assert.equal(empty.departureKey, null)

    const nullVal = parseTourRef(null)
    assert.equal(nullVal.isGeneral, true)

    const generalStr = parseTourRef("general")
    assert.equal(generalStr.isGeneral, true)
  })

  it("identifies cancelled bookings with case-sensitive and safe checks", () => {
    assert.equal(isBookingCancelled({ status: "Cancelled" }), true)
    assert.equal(isBookingCancelled({ status: "cancelled" }), true)
    assert.equal(isBookingCancelled({ status: "Canceled" }), true)
    assert.equal(isBookingCancelled({ status: "Confirmed" }), false)
    assert.equal(isBookingCancelled({ status: "confirmed" }), false)
    assert.equal(isBookingCancelled({}), false)
    assert.equal(isBookingCancelled(null), false)
  })

  it("exports additive expense categories bus_rent and staff_salary with translations and icons", () => {
    assert.ok(EXPENSE_CATEGORY_IDS.includes("bus_rent"))
    assert.ok(EXPENSE_CATEGORY_IDS.includes("staff_salary"))

    const busRent = EXPENSE_CATEGORY_MAP["bus_rent"]
    assert.ok(busRent)
    assert.equal(busRent.id, "bus_rent")
    assert.ok(busRent.label)
    assert.ok(busRent.labelHi)
    assert.ok(busRent.labelGu)
    assert.equal(busRent.icon, "Bus")

    const staffSal = EXPENSE_CATEGORY_MAP["staff_salary"]
    assert.ok(staffSal)
    assert.equal(staffSal.id, "staff_salary")
    assert.ok(staffSal.label)
    assert.ok(staffSal.labelHi)
    assert.ok(staffSal.labelGu)
    assert.equal(staffSal.icon, "Users")
  })

  it("calculates comprehensive Tour P&L metrics covering cancellations, fees, refunds and zero-drift sums", () => {
    const bookings = [
      // 1. Confirmed booking with full payment
      {
        _id: "b1",
        tourName: "Chardham Yatra",
        journeyDate: "2026-05-15",
        busType: "2x1 Sleeper Luxury",
        totalAmount: 15000,
        advanceReceived: 15000,
        status: "Confirmed",
        passengers: [{ name: "P1" }, { name: "P2" }],
      },
      // 2. Confirmed booking with partial payment
      {
        _id: "b2",
        tourName: "Chardham Yatra",
        journeyDate: "2026-05-15",
        busType: "2x1 Sleeper Luxury",
        totalAmount: 22500.5,
        advanceReceived: 10000.5,
        status: "Confirmed",
        passengers: [{ name: "P3" }, { name: "P4" }, { name: "P5" }],
      },
      // 3. Cancelled booking with retained fee and refund
      {
        _id: "b3",
        tourName: "Chardham Yatra",
        journeyDate: "2026-05-15",
        busType: "2x1 Sleeper Luxury",
        totalAmount: 7500,
        advanceReceived: 2000, // Operator retained ₹2,000 fee
        cancellationCharge: 2000,
        refundAmount: 5500,
        status: "Cancelled",
        passengers: [{ name: "P6" }],
      },
      // 4. Soft-deleted booking (must be completely ignored)
      {
        _id: "b4_deleted",
        tourName: "Chardham Yatra",
        journeyDate: "2026-05-15",
        totalAmount: 10000,
        status: "Confirmed",
        deletedAt: new Date(),
      },
    ]

    const expenses = [
      // Departure-specific expense (paid)
      {
        _id: "e1",
        date: "2026-05-14",
        amount: 8000.25,
        category: "fuel",
        departureKey: "Chardham Yatra___2026-05-15___2x1 Sleeper Luxury",
        status: "paid",
      },
      // Departure-specific expense (pending)
      {
        _id: "e2",
        date: "2026-05-15",
        amount: 3500.75,
        category: "toll",
        departureKey: "Chardham Yatra___2026-05-15___2x1 Sleeper Luxury",
        status: "pending",
      },
      // Tour-level unallocated expense (legacy tourRef)
      {
        _id: "e3",
        date: "2026-05-01",
        amount: 5000,
        category: "advertising",
        tourRef: "Chardham Yatra",
        status: "paid",
      },
      // General overhead expense (unlinked)
      {
        _id: "e4_gen",
        date: "2026-05-10",
        amount: 4500,
        category: "office",
        tourRef: null,
        status: "paid",
      },
      // Soft-deleted expense (must be ignored)
      {
        _id: "e5_deleted",
        date: "2026-05-12",
        amount: 10000,
        category: "salary",
        deletedAt: new Date(),
      },
    ]

    const report = calculateProfitLoss({ bookings, expenses })

    // Booked Revenue = 15000 + 22500.50 = 37500.50
    assert.equal(report.summary.bookedRevenue, 37500.5)

    // Cash Collected = 15000 + 10000.50 + 2000 (retained fee) = 27000.50
    assert.equal(report.summary.collected, 27000.5)

    // Outstanding = 37500.50 - 25000 (collected non-cancelled) = 12500
    assert.equal(report.summary.outstanding, 12500)

    // Cancellation fees retained = 2000
    assert.equal(report.summary.cancellationFeesRetained, 2000)

    // Tour expenses total = 8000.25 + 3500.75 + 5000 = 16501
    assert.equal(report.summary.tourExpensesTotal, 16501)
    assert.equal(report.summary.tourExpensesPaid, 13000.25)
    assert.equal(report.summary.tourExpensesPending, 3500.75)

    // General expenses = 4500
    assert.equal(report.summary.generalExpensesTotal, 4500)
    assert.equal(report.summary.generalExpensesPaid, 4500)

    // Tour Booked Profit = 37500.50 + 2000 - 16501 = 22999.50
    assert.equal(report.summary.tourProfitBooked, 22999.5)

    // Overall Business Profit = 22999.50 - 4500 = 18499.50
    assert.equal(report.summary.overallBusinessProfitBooked, 18499.5)

    // Non-cancelled passengers = 2 + 3 = 5 (cancelled P6 excluded)
    assert.equal(report.summary.passengers, 5)

    // Verify tour level breakdown
    assert.equal(report.tours.length, 1)
    const chardham = report.tours[0]
    assert.equal(chardham.tourName, "Chardham Yatra")
    assert.equal(chardham.passengers, 5)
    assert.equal(chardham.bookedRevenue, 37500.5)
    assert.equal(chardham.expensesTotal, 16501)
    assert.equal(chardham.avgTicketPrice, round2(37500.5 / 5)) // 7500.10
    assert.equal(chardham.costPerPassenger, round2(16501 / 5)) // 3300.20

    // Break-even seats = ceil(16501 / 7500.10) = ceil(2.20) = 3
    assert.equal(chardham.breakEvenSeats, 3)
    assert.equal(chardham.seatsToBreakEvenRemaining, 0) // Already sold 5 >= 3
  })

  it("handles zero revenue and zero passenger edge cases gracefully without NaN or Infinity", () => {
    const expenses = [
      {
        date: "2026-06-01",
        amount: 10000,
        category: "fuel",
        tourRef: "Empty Tour",
        status: "paid",
      },
    ]

    const report = calculateProfitLoss({ bookings: [], expenses })
    assert.equal(report.summary.bookedRevenue, 0)
    assert.equal(report.summary.allExpensesTotal, 10000)
    assert.equal(report.summary.tourMarginPercent, null)
    assert.equal(report.summary.overallBusinessMarginPercent, null)

    const tour = report.tours[0]
    assert.equal(tour.bookedRevenue, 0)
    assert.equal(tour.marginPercent, null)
    assert.equal(tour.avgTicketPrice, 0)
    assert.equal(tour.costPerPassenger, null)
    assert.equal(tour.breakEvenSeats, null)
    assert.equal(tour.seatsToBreakEvenRemaining, null)
  })

  it("respects Indian Financial Year boundary edge dates (31 Mar and 1 Apr)", () => {
    const bookings = [
      // FY 2025-26 ending on 31 March 2026
      {
        tourName: "Somnath",
        journeyDate: "2026-03-31",
        totalAmount: 10000,
        advanceReceived: 10000,
        status: "Confirmed",
        passengers: [{ name: "P1" }],
      },
      // FY 2026-27 starting on 01 April 2026
      {
        tourName: "Somnath",
        journeyDate: "2026-04-01",
        totalAmount: 20000,
        advanceReceived: 20000,
        status: "Confirmed",
        passengers: [{ name: "P2" }],
      },
    ]

    // Query strictly for FY 2025-26
    const fy2526 = calculateProfitLoss({
      bookings,
      filters: { from: "2025-04-01", to: "2026-03-31" },
    })
    assert.equal(fy2526.summary.bookedRevenue, 10000)
    assert.equal(fy2526.summary.passengers, 1)

    // Query strictly for FY 2026-27
    const fy2627 = calculateProfitLoss({
      bookings,
      filters: { from: "2026-04-01", to: "2027-03-31" },
    })
    assert.equal(fy2627.summary.bookedRevenue, 20000)
    assert.equal(fy2627.summary.passengers, 1)
  })
})

describe("Backend Tour P&L Validation & Sanitization (tourPnlQuerySchema)", () => {
  it("accepts valid query parameters and applies defaults", () => {
    const valid = tourPnlQuerySchema.parse({
      from: "2026-04-01",
      to: "2027-03-31",
      groupBy: "departure",
    })
    assert.equal(valid.from, "2026-04-01")
    assert.equal(valid.to, "2027-03-31")
    assert.equal(valid.groupBy, "departure")
    assert.equal(valid.includeGeneral, true)
  })

  it("strictly rejects unknown query parameters (SEC-015)", () => {
    assert.throws(
      () => {
        tourPnlQuerySchema.parse({
          from: "2026-04-01",
          unauthorizedField: "hacker",
        })
      },
      (err) => {
        const issues = err.issues || err.errors || []
        const msg = issues[0]?.message || err.message || ""
        assert.ok(msg.toLowerCase().includes("unknown") || msg.toLowerCase().includes("unrecognized"))
        return true
      },
    )
  })

  it("rejects invalid date formats", () => {
    assert.throws(() => {
      tourPnlQuerySchema.parse({ from: "01-04-2026" })
    })
  })

  it("calculates current Indian Financial Year range correctly", () => {
    // In May 2026 (month 4 in 0-indexed)
    const may2026 = new Date("2026-05-15")
    const fy = getCurrentIndianFinancialYearRange(may2026)
    assert.equal(fy.from, "2026-04-01")
    assert.equal(fy.to, "2027-03-31")

    // In February 2026 (month 1 in 0-indexed)
    const feb2026 = new Date("2026-02-10")
    const prevFy = getCurrentIndianFinancialYearRange(feb2026)
    assert.equal(prevFy.from, "2025-04-01")
    assert.equal(prevFy.to, "2026-03-31")
  })
})

describe("P&L Cancellation Fee & Authoritative Accounting (Part 4c Task C Rules a-e)", () => {
  it("verifies fixture cases (a)-(c): cancelled booking, multi-payment active booking, and departure profit", () => {
    // (a) Total 10k, advance 4k, cancelled with fee 1k, refund 3k
    const bookingA = {
      _id: "bk-a",
      tourName: "Kashi Yatra",
      journeyDate: "2026-06-10",
      busType: "2x1 Sleeper Luxury",
      totalAmount: 10000,
      advanceReceived: 4000,
      cancellationCharge: 1000,
      refundAmount: 3000,
      status: "Cancelled",
      passengers: [{ name: "Cancelled Pax" }],
    }

    // Verify booking A standalone
    const reportA = calculateProfitLoss({ bookings: [bookingA], expenses: [] })
    assert.equal(reportA.summary.bookedRevenue, 0, "(a) Booked revenue must be 0 for cancelled booking")
    assert.equal(reportA.summary.collected, 1000, "(a) Cash collected net of refunds must equal retained fee 1,000")
    assert.equal(reportA.summary.cancellationFeesRetained, 1000, "(a) Fee retained is 1,000")
    assert.equal(reportA.summary.refundsPaid, 3000, "(a) Refunds paid is 3,000")
    assert.equal(reportA.summary.outstanding, 0, "(a) Cancelled booking has 0 outstanding balance")
    assert.equal(reportA.summary.passengers, 0, "(a) Cancelled passengers do not count")

    // (b) Same tour active booking total 20k with payments array [5k, 3k]
    const bookingB = {
      _id: "bk-b",
      tourName: "Kashi Yatra",
      journeyDate: "2026-06-10",
      busType: "2x1 Sleeper Luxury",
      totalAmount: 20000,
      advanceReceived: 0, // Should be overridden by payments ledger
      payments: [
        { amount: 5000, type: "advance", isVoid: false },
        { amount: 3000, type: "installment", isVoid: false },
        { amount: 9999, type: "advance", isVoid: true }, // Void payment must be ignored
      ],
      status: "Confirmed",
      passengers: [{ name: "P1" }, { name: "P2" }],
    }

    // (c) Direct expenses 6k paid + 2k pending
    const expensesC = [
      {
        _id: "exp-c1",
        date: "2026-06-09",
        amount: 6000,
        category: "fuel",
        departureKey: "Kashi Yatra___2026-06-10___2x1 Sleeper Luxury",
        status: "paid",
      },
      {
        _id: "exp-c2",
        date: "2026-06-10",
        amount: 2000,
        category: "toll",
        departureKey: "Kashi Yatra___2026-06-10___2x1 Sleeper Luxury",
        status: "pending",
      },
    ]

    const reportCombined = calculateProfitLoss({
      bookings: [bookingA, bookingB],
      expenses: expensesC,
    })

    const dep = reportCombined.departures[0]
    assert.ok(dep, "Departure must exist")
    assert.equal(dep.bookedRevenue, 20000, "Booked revenue is 20,000 (from booking B)")
    assert.equal(dep.collected, 9000, "Collected cash is 8,000 (B) + 1,000 (A retained fee) = 9,000")
    assert.equal(dep.outstanding, 12000, "Outstanding is 20,000 - 8,000 = 12,000 (B only)")
    assert.equal(dep.cancellationFeesRetained, 1000, "Cancellation fee retained is 1,000")
    assert.equal(dep.refundsPaid, 3000, "Refunds paid is 3,000")
    assert.equal(dep.expensesPaid, 6000, "Expenses paid is 6,000")
    assert.equal(dep.expensesPending, 2000, "Expenses pending is 2,000")
    assert.equal(dep.expensesTotal, 8000, "Expenses total is 8,000")

    // profitBooked = 20,000 + 1,000 - 8,000 = 13,000
    assert.equal(dep.profitBooked, 13000, "profitBooked = 20k + 1k - 8k = 13,000")
    // profitCash = (8,000 + 1,000) - 6,000 = 3,000
    assert.equal(dep.profitCash, 3000, "profitCash = (8k + 1k) - 6k = 3,000")
  })

  it("verifies fixture case (d): attributes legacy tourRef rows to tour-level unallocated expenses", () => {
    const booking = {
      _id: "bk-d",
      tourName: "Rameshwaram Yatra",
      journeyDate: "2026-07-01",
      busType: "2x1 Sleeper Luxury",
      totalAmount: 30000,
      advanceReceived: 30000,
      status: "Confirmed",
      passengers: [{ name: "P1" }, { name: "P2" }, { name: "P3" }],
    }

    const expenses = [
      // Departure specific
      {
        _id: "exp-d1",
        date: "2026-07-01",
        amount: 10000,
        category: "fuel",
        departureKey: "Rameshwaram Yatra___2026-07-01___2x1 Sleeper Luxury",
        status: "paid",
      },
      // Legacy tourRef unallocated expense
      {
        _id: "exp-d2",
        date: "2026-06-25",
        amount: 4000,
        category: "advertising",
        tourRef: "Rameshwaram Yatra",
        status: "paid",
      },
    ]

    const report = calculateProfitLoss({ bookings: [booking], expenses })
    const tour = report.tours[0]
    assert.equal(tour.tourName, "Rameshwaram Yatra")
    assert.equal(tour.unallocatedExpenses.length, 1)
    assert.equal(tour.unallocatedExpenses[0].category, "advertising")
    assert.equal(tour.expensesTotal, 14000, "Total tour expenses include unallocated tourRef (10k + 4k = 14k)")
    assert.equal(tour.profitBooked, 16000, "Tour profitBooked = 30k - 14k = 16k")
    assert.equal(tour.profitCash, 16000, "Tour profitCash = 30k - 14k = 16k")
  })

  it("verifies fixture case (e): ensures zero double counting between tour view and overall business summary", () => {
    const bookings = [
      {
        _id: "b-e1",
        tourName: "Tour Alpha",
        journeyDate: "2026-08-01",
        totalAmount: 15000,
        advanceReceived: 10000,
        status: "Confirmed",
        passengers: [{ name: "PA1" }],
      },
      {
        _id: "b-e2",
        tourName: "Tour Beta",
        journeyDate: "2026-08-05",
        totalAmount: 25000,
        advanceReceived: 15000,
        cancellationCharge: 3000,
        refundAmount: 12000,
        status: "Cancelled",
        passengers: [{ name: "PB1" }],
      },
    ]

    const expenses = [
      {
        _id: "exp-e1",
        date: "2026-08-01",
        amount: 5000,
        category: "fuel",
        departureKey: "Tour Alpha___2026-08-01___2x1 Sleeper Luxury",
        status: "paid",
      },
      {
        _id: "exp-e2",
        date: "2026-08-05",
        amount: 3000,
        category: "bus_rent",
        departureKey: "Tour Beta___2026-08-05___2x1 Sleeper Luxury",
        status: "paid",
      },
      // General overhead (unlinked)
      {
        _id: "exp-e-gen",
        date: "2026-08-10",
        amount: 2500,
        category: "office",
        tourRef: null,
        status: "paid",
      },
    ]

    const report = calculateProfitLoss({ bookings, expenses })

    // Verify sum of tour metrics matches totalTour metrics exactly
    const sumTourBookedRevenue = report.tours.reduce((acc, t) => acc + t.bookedRevenue, 0)
    const sumTourCollected = report.tours.reduce((acc, t) => acc + t.collected, 0)
    const sumTourOutstanding = report.tours.reduce((acc, t) => acc + t.outstanding, 0)
    const sumTourCancellationFees = report.tours.reduce((acc, t) => acc + t.cancellationFeesRetained, 0)
    const sumTourExpensesTotal = report.tours.reduce((acc, t) => acc + t.expensesTotal, 0)

    assert.equal(report.summary.bookedRevenue, sumTourBookedRevenue)
    assert.equal(report.summary.collected, sumTourCollected)
    assert.equal(report.summary.outstanding, sumTourOutstanding)
    assert.equal(report.summary.cancellationFeesRetained, sumTourCancellationFees)
    assert.equal(report.summary.tourExpensesTotal, sumTourExpensesTotal)

    // General expenses must be strictly isolated from tour metrics
    assert.equal(report.summary.generalExpensesTotal, 2500)
    assert.equal(report.summary.allExpensesTotal, sumTourExpensesTotal + 2500)
    assert.equal(
      report.summary.overallBusinessProfitBooked,
      round2(report.summary.tourProfitBooked - report.summary.generalExpensesTotal),
    )
    assert.equal(
      report.summary.overallBusinessProfitCash,
      round2(report.summary.tourProfitCash - report.summary.generalExpensesPaid),
    )
  })
})
