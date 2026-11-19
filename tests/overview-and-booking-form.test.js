import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  getBusCapacity,
  getBookingPaymentStatus,
  calculateOccupancyPercent,
  computeOverviewMetrics,
  groupUpcomingDepartures,
  filterRecentBookings,
  getPaymentUrgencyMeta,
} from "../src/utils/dashboardOverview.js"
import {
  BOOKING_STEPS,
  validateBookingStep,
  validateAllBookingSteps,
  canNavigateToStep,
  buildBookingSummary,
  formatServerBookingError,
} from "../src/utils/bookingFormHelpers.js"
import { calculatePricing } from "../src/utils/pricing.js"
import { resolvePageMeta } from "../src/components/shell/shellConfig.js"

describe("Dashboard Overview Helpers (Part 3.3)", () => {
  it("computes coach berth capacity and clamped occupancy percentages", () => {
    assert.equal(getBusCapacity("2x1 Sleeper Luxury"), 36)
    assert.equal(getBusCapacity("2x2 Sleeper Luxury"), 40)
    assert.equal(getBusCapacity(""), 36)
    assert.equal(getBusCapacity(null), 36)

    assert.equal(calculateOccupancyPercent(18, 36), 50)
    assert.equal(calculateOccupancyPercent(28, 36), 78)
    assert.equal(calculateOccupancyPercent(50, 36), 100)
    assert.equal(calculateOccupancyPercent(5, 0), 0)
  })

  it("classifies booking payment status accurately", () => {
    assert.equal(getBookingPaymentStatus({ status: "Cancelled", totalAmount: 5000, advanceReceived: 0 }), "Cancelled")
    assert.equal(getBookingPaymentStatus({ status: "Confirmed", isPaid: true, totalAmount: 5000, advanceReceived: 5000 }), "Paid")
    assert.equal(getBookingPaymentStatus({ status: "Confirmed", totalAmount: 5000, advanceReceived: 5000 }), "Paid")
    assert.equal(getBookingPaymentStatus({ status: "Confirmed", totalAmount: 5000, advanceReceived: 2000 }), "Partial")
    assert.equal(getBookingPaymentStatus({ status: "Confirmed", totalAmount: 5000, advanceReceived: 0 }), "Pending")
  })

  it("computes KPI metrics, today's operations, and upcoming 7-day departures", () => {
    const fixedNow = new Date("2026-11-18T10:00:00Z")
    const tours = [
      { name: "Dwarka Yatra", busType: "2x1 Sleeper Luxury" },
      { name: "Char Dham", busType: "2x2 Sleeper Luxury" },
    ]
    const bookings = [
      {
        id: "b1",
        invoiceNo: "YHB-001",
        tourName: "Dwarka Yatra",
        journeyDate: "2026-11-18",
        busType: "2x1 Sleeper Luxury",
        totalAmount: 10000,
        advanceReceived: 4000,
        status: "Confirmed",
        passengers: [
          { name: "Ramesh", seatId: "lower-L1", checkedIn: true },
          { name: "Sita", seatId: "lower-L2", checkedIn: false },
        ],
      },
      {
        id: "b2",
        invoiceNo: "YHB-002",
        tourName: "Char Dham",
        journeyDate: "2026-11-21",
        busType: "2x2 Sleeper Luxury",
        totalAmount: 20000,
        advanceReceived: 20000,
        isPaid: true,
        status: "Confirmed",
        passengers: [
          { name: "Amit", seatId: "", checkedIn: false },
        ],
      },
      {
        id: "b3",
        invoiceNo: "YHB-003",
        tourName: "Dwarka Yatra",
        journeyDate: "2026-11-18",
        totalAmount: 5000,
        advanceReceived: 0,
        status: "Cancelled",
        passengers: [{ name: "Cancelled Pax", seatId: "lower-R1-1" }],
      },
      {
        id: "b4",
        invoiceNo: "YHB-004",
        tourName: "Dwarka Yatra",
        journeyDate: "2026-12-10",
        totalAmount: 8000,
        advanceReceived: 0,
        status: "Confirmed",
        passengers: [{ name: "Future Pax", seatId: "upper-L1" }],
      },
    ]

    const metrics = computeOverviewMetrics(bookings, tours, fixedNow)
    assert.equal(metrics.todayDeparturesCount, 1)
    assert.deepEqual(metrics.todayTours, ["Dwarka Yatra"])
    assert.equal(metrics.todayPax, 2)
    assert.equal(metrics.todayCheckedIn, 1)
    assert.equal(metrics.todayDue, 6000)
    assert.equal(metrics.activeBookingsCount, 3)
    assert.equal(metrics.activeRevenue, 38000)
    assert.equal(metrics.totalTravelers, 4)
    assert.equal(metrics.pendingDuesCount, 2)
    assert.equal(metrics.pendingDuesAmount, 14000)
    assert.equal(metrics.unassignedSeatBookings.length, 1)
    assert.equal(metrics.unassignedPaxTotal, 1)

    const departures = groupUpcomingDepartures(bookings, tours, fixedNow, 7)
    assert.equal(departures.length, 2)
    assert.equal(departures[0].tourName, "Dwarka Yatra")
    assert.equal(departures[0].capacity, 36)
    assert.equal(departures[0].pax, 2)
    assert.equal(departures[0].boardedCount, 1)
    assert.equal(departures[0].pendingDue, 6000)
    assert.equal(departures[0].occupancyPct, 6)

    assert.equal(departures[1].tourName, "Char Dham")
    assert.equal(departures[1].capacity, 40)
    assert.equal(departures[1].pax, 1)
    assert.equal(departures[1].pendingDue, 0)
  })

  it("filters recent bookings by status chip and local search text", () => {
    const sample = [
      { invoiceNo: "YHB-101", contactName: "Patel Ji", contactPhone: "9876543210", tourName: "Dwarka", totalAmount: 5000, advanceReceived: 5000, isPaid: true, status: "Confirmed" },
      { invoiceNo: "YHB-102", contactName: "Meera Shah", contactPhone: "9822211100", tourName: "Somnath", totalAmount: 6000, advanceReceived: 1000, isPaid: false, status: "Confirmed" },
      { invoiceNo: "YHB-103", contactName: "Kiran Joshi", contactPhone: "9811122233", tourName: "Dwarka", totalAmount: 4000, advanceReceived: 0, status: "Cancelled" },
    ]

    assert.equal(filterRecentBookings(sample, { statusFilter: "all" }).length, 3)
    assert.equal(filterRecentBookings(sample, { statusFilter: "paid" }).length, 1)
    assert.equal(filterRecentBookings(sample, { statusFilter: "pending" }).length, 1)
    assert.equal(filterRecentBookings(sample, { statusFilter: "cancelled" }).length, 1)
    assert.equal(filterRecentBookings(sample, { statusFilter: "all", localSearch: "meera" }).length, 1)
    assert.equal(filterRecentBookings(sample, { statusFilter: "pending", localSearch: "dwarka" }).length, 0)
  })

  it("maps payment urgency buckets to accessible labels and semantic tones", () => {
    const overdue = getPaymentUrgencyMeta(-2)
    assert.equal(overdue.bucket, "red")
    assert.equal(overdue.label, "Overdue")
    assert.equal(overdue.countdownLabel, "2 days overdue")

    const today = getPaymentUrgencyMeta(0)
    assert.equal(today.bucket, "red")
    assert.equal(today.label, "Due on boarding")
    assert.equal(today.countdownLabel, "Departing today")

    const soon = getPaymentUrgencyMeta(5)
    assert.equal(soon.bucket, "yellow")
    assert.equal(soon.label, "Due soon")

    const future = getPaymentUrgencyMeta(14)
    assert.equal(future.bucket, "green")
    assert.equal(future.label, "Scheduled")
  })
})

describe("Stepped Booking Form Helpers (Part 3.3)", () => {
  const validForm = {
    tourName: "Dwarka Special",
    journeyDate: "2026-12-01",
    busType: "2x1 Sleeper Luxury",
    contactName: "Rameshbhai Patel",
    contactPhone: "9876543210",
    paymentMode: "UPI",
    baseAmount: 10000,
    totalAmount: 10000,
    discount: 1000,
    discountType: "fixed",
    gstRate: 5,
    isTaxInclusive: false,
    advanceReceived: 3000,
    passengers: [
      { name: "Rameshbhai", city: "Surat", age: "45", gender: "Male", aadhar: "234567890123", seatId: "lower-L1" },
      { name: "Sita", city: "Surat", age: "42", gender: "Female", aadhar: "", seatId: "lower-L2" },
    ],
  }

  it("exposes 4 canonical steps and delegates PageHeader ownership for dashboard and form", () => {
    assert.equal(BOOKING_STEPS.length, 4)
    assert.deepEqual(
      BOOKING_STEPS.map((s) => s.key),
      ["tour", "passengers", "pricing", "review"],
    )
    assert.equal(resolvePageMeta("dashboard").hasOwnHeading, false)
    assert.equal(resolvePageMeta("form").hasOwnHeading, false)
    assert.equal(resolvePageMeta("passengers").hasOwnHeading, false)
  })

  it("validates Step 0 (Tour, Date, Bus & Primary Contact) strictly", () => {
    const invalid = validateBookingStep(0, {
      tourName: "",
      journeyDate: "",
      busType: "",
      contactName: "",
      contactPhone: "12345",
    })
    assert.equal(invalid.valid, false)
    assert.equal(invalid.summary.length, 5)
    assert.ok(invalid.errors.tourName)
    assert.ok(invalid.errors.journeyDate)
    assert.ok(invalid.errors.busType)
    assert.ok(invalid.errors.contactName)
    assert.ok(invalid.errors.contactPhone)

    const valid = validateBookingStep(0, validForm)
    assert.equal(valid.valid, true)
    assert.equal(valid.summary.length, 0)
  })

  it("validates Step 1 (Passengers, Aadhaar, duplicate seats & booked conflicts)", () => {
    const badPax = {
      ...validForm,
      passengers: [
        { name: "", city: "", age: "0", aadhar: "12345", seatId: "lower-L1" },
        { name: "Second", city: "Surat", age: "30", aadhar: "", seatId: "lower-L1" },
      ],
    }
    const res = validateBookingStep(1, badPax, {
      bookedSeats: [{ seatId: "lower-L1" }],
    })
    assert.equal(res.valid, false)
    assert.ok(res.errors["passenger-0-name"])
    assert.ok(res.errors["passenger-0-city"])
    assert.ok(res.errors["passenger-0-age"])
    assert.ok(res.errors["passenger-0-aadhar"])
    assert.ok(res.errors["passenger-0-seat"])
    assert.ok(res.errors["passenger-1-seat"])

    const clean = validateBookingStep(1, validForm, {
      bookedSeats: [{ seatId: "upper-R1-1" }],
    })
    assert.equal(clean.valid, true)
  })

  it("validates Step 2 (Pricing, discount bounds & advance <= total) and full validation", () => {
    const pricing = calculatePricing({
      baseAmount: 10000,
      discountType: "fixed",
      discountValue: 1000,
      gstRate: 5,
      isTaxInclusive: false,
    })

    const overAdvance = validateBookingStep(
      2,
      { ...validForm, advanceReceived: pricing.finalTotal + 500 },
      { pricingBreakdown: pricing },
    )
    assert.equal(overAdvance.valid, false)
    assert.ok(overAdvance.errors.advanceReceived)

    const badPct = validateBookingStep(
      2,
      { ...validForm, discountType: "percentage", discount: 150 },
      { pricingBreakdown: pricing },
    )
    assert.equal(badPct.valid, false)
    assert.ok(badPct.errors.discount)

    const allOk = validateAllBookingSteps(validForm, {
      pricingBreakdown: pricing,
      bookedSeats: [],
    })
    assert.equal(allOk.valid, true)
    assert.equal(allOk.firstInvalidStep, -1)

    const allFail = validateAllBookingSteps(
      { ...validForm, advanceReceived: 99999 },
      { pricingBreakdown: pricing, bookedSeats: [] },
    )
    assert.equal(allFail.valid, false)
    assert.equal(allFail.firstInvalidStep, 2)
  })

  it("enforces step click navigation rules, builds summary, and formats server errors", () => {
    assert.equal(canNavigateToStep(0, { currentStep: 2, maxVisitedStep: 2, isEditMode: false }), true)
    assert.equal(canNavigateToStep(3, { currentStep: 1, maxVisitedStep: 1, isEditMode: false }), false)
    assert.equal(canNavigateToStep(3, { currentStep: 0, maxVisitedStep: 0, isEditMode: true }), true)

    const pricing = calculatePricing({
      baseAmount: 10000,
      discountType: "fixed",
      discountValue: 1000,
      gstRate: 5,
      isTaxInclusive: false,
    })
    const summary = buildBookingSummary(validForm, pricing)
    assert.equal(summary.finalTotal, 9450)
    assert.equal(summary.advanceReceived, 3000)
    assert.equal(summary.balanceDue, 6450)
    assert.equal(summary.passengerCount, 2)
    assert.deepEqual(summary.assignedSeats, ["lower-L1", "lower-L2"])

    assert.match(
      formatServerBookingError({
        error: "Seat conflict detected",
        data: { conflictingSeats: ["lower-L1", "lower-L2"] },
      }),
      /Seat conflict detected \(Conflicting seats: lower-L1, lower-L2\)/,
    )
    assert.equal(
      formatServerBookingError({ error: "Total amount mismatch" }),
      "Total amount mismatch",
    )
  })
})
