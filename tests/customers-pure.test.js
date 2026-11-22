import test from "node:test"
import assert from "node:assert/strict"
import {
  normalizeIndianMobile,
  isValidEmail,
  pickDisplayName,
  CUSTOMER_TAGS,
  CUSTOMER_LANGUAGES,
  summarizeCustomer,
} from "../shared/customers.js"

test("normalizeIndianMobile: normalizes valid formats correctly", () => {
  const cases = [
    { input: "9876543210", expected: "9876543210" },
    { input: "09876543210", expected: "9876543210" },
    { input: "919876543210", expected: "9876543210" },
    { input: "+91 98765 43210", expected: "9876543210" },
    { input: "+91-98765-43210", expected: "9876543210" },
    { input: "  +91 9876543210  ", expected: "9876543210" },
    { input: 9876543210, expected: "9876543210" },
    { input: "6123456789", expected: "6123456789" },
    { input: "7123456789", expected: "7123456789" },
    { input: "8123456789", expected: "8123456789" },
  ]

  for (const { input, expected } of cases) {
    const res = normalizeIndianMobile(input)
    assert.equal(res.valid, true, `Expected valid for ${input}`)
    assert.equal(res.normalized, expected, `Expected normalized ${expected} for ${input}`)
    assert.equal(res.display, `+91 ${expected.slice(0, 5)} ${expected.slice(5)}`)
  }
})

test("normalizeIndianMobile: rejects invalid inputs", () => {
  const invalidInputs = [
    null,
    undefined,
    "",
    "   ",
    "12345",
    "5987654321", // starts with 5 (invalid in India)
    "98765432101", // 11 digits not starting with 0
    "009876543210", // double leading 0
    "abcd987654",
    "+1 415 555 2671", // US number
    "0000000000",
  ]

  for (const input of invalidInputs) {
    const res = normalizeIndianMobile(input)
    assert.equal(res.valid, false, `Expected invalid for ${input}`)
    assert.equal(res.normalized, null)
    assert.equal(res.display, null)
  }
})

test("isValidEmail: validates email formats correctly", () => {
  assert.equal(isValidEmail("patel@example.com"), true)
  assert.equal(isValidEmail("user.name+tag@sub.domain.co.in"), true)
  assert.equal(isValidEmail(""), false)
  assert.equal(isValidEmail(null), false)
  assert.equal(isValidEmail("not-an-email"), false)
  assert.equal(isValidEmail("@missing-user.com"), false)
  assert.equal(isValidEmail("user@.com"), false)
})

test("pickDisplayName: selects the longest clean candidate", () => {
  assert.equal(pickDisplayName(["Ramesh", "Ramesh Patel", "Ramesh K Patel"]), "Ramesh K Patel")
  assert.equal(pickDisplayName(["", "   ", "Suresh Bhai"]), "Suresh Bhai")
  assert.equal(pickDisplayName("Single Name"), "Single Name")
  assert.equal(pickDisplayName([]), "")
  assert.equal(pickDisplayName(null), "")
})

test("CUSTOMER_TAGS and CUSTOMER_LANGUAGES are frozen arrays", () => {
  assert.ok(Object.isFrozen(CUSTOMER_TAGS))
  assert.ok(Object.isFrozen(CUSTOMER_LANGUAGES))
  assert.deepEqual(CUSTOMER_TAGS, ["vip", "group-leader", "agent", "corporate", "pilgrim-group"])
  assert.deepEqual(CUSTOMER_LANGUAGES, ["en", "hi", "gu"])
})

test("summarizeCustomer: computes correct metrics with zero P&L divergence", () => {
  const mockBookings = [
    {
      _id: "b1",
      status: "Confirmed",
      totalAmount: 15000,
      advanceReceived: 10000,
      journeyDate: "2026-05-10",
      tourName: "Chardham Yatra",
      passengers: [{ name: "P1" }, { name: "P2" }],
      payments: [
        { amount: 10000, type: "cash", isVoid: false },
      ],
    },
    {
      _id: "b2",
      status: "Confirmed",
      totalAmount: 20000,
      advanceReceived: 20000,
      journeyDate: "2026-07-15",
      tourName: "Dwarka Somnath",
      passengers: [{ name: "P3" }, { name: "P4" }, { name: "P5" }],
      payments: [
        { amount: 20000, type: "upi", isVoid: false },
      ],
    },
    {
      _id: "b3",
      status: "Cancelled",
      totalAmount: 12000,
      advanceReceived: 5000,
      cancellationCharge: 1500,
      refundAmount: 3500,
      journeyDate: "2026-06-01",
      tourName: "Kashi Yatra",
      passengers: [{ name: "P6" }],
      payments: [
        { amount: 5000, type: "upi", isVoid: false },
      ],
    },
  ]

  const summary = summarizeCustomer(mockBookings)

  // 2 active bookings, 1 cancelled
  assert.equal(summary.totalBookings, 2)
  assert.equal(summary.totalCancelledBookings, 1)
  assert.equal(summary.isRepeat, true)

  // Passengers: 2 + 3 = 5 (cancelled passenger excluded)
  assert.equal(summary.totalPassengers, 5)

  // Revenue: 15000 + 20000 = 35000 (cancelled 12000 excluded)
  assert.equal(summary.totalBookedRevenue, 35000)

  // Collected: 10000 (b1) + 20000 (b2) + 1500 (retained fee from b3) = 31500
  assert.equal(summary.totalCollected, 31500)

  // Outstanding: 5000 (b1) + 0 (b2) = 5000 (b3 has zero balance due)
  assert.equal(summary.totalOutstanding, 5000)

  // Cancellation fees retained: 1500
  assert.equal(summary.totalCancellationFees, 1500)

  // Dates
  assert.equal(summary.firstBookingDate, "2026-05-10")
  assert.equal(summary.lastBookingDate, "2026-07-15")

  // Destinations: sorted unique active destinations
  assert.deepEqual(summary.destinations, ["Chardham Yatra", "Dwarka Somnath"])
})

test("summarizeCustomer: handles empty or invalid bookings gracefully", () => {
  const emptySummary = summarizeCustomer([])
  assert.equal(emptySummary.totalBookings, 0)
  assert.equal(emptySummary.totalBookedRevenue, 0)
  assert.equal(emptySummary.isRepeat, false)
  assert.deepEqual(emptySummary.destinations, [])
})
