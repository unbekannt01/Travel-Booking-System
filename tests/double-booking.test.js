import test from "node:test"
import assert from "node:assert/strict"

/**
 * Pure simulator of checkSeatConflicts logic from backend/routes/bookings.js
 */
function evaluateSeatConflicts({
  newPassengers,
  tourName,
  journeyDate,
  existingBookings = [],
  excludeBookingId = null,
}) {
  const seatIds = (newPassengers || []).map((p) => p.seatId).filter(Boolean)
  if (seatIds.length === 0) return null

  // 1. Check internal duplicates in current booking
  const seen = new Set()
  for (const s of seatIds) {
    if (seen.has(s)) {
      return {
        status: 400,
        message: `Seat ${s} is assigned to multiple passengers in this booking.`,
      }
    }
    seen.add(s)
  }

  // 2. Check against other active bookings for the same tour and journey date
  const targetDateStr = new Date(journeyDate).toISOString().slice(0, 10)

  const activeConflictingBookings = existingBookings.filter((b) => {
    if (excludeBookingId && b._id === excludeBookingId) return false
    if (b.status === "Cancelled" || b.status === "cancelled") return false
    if (b.tourName !== tourName) return false

    const bDateStr = new Date(b.journeyDate).toISOString().slice(0, 10)
    return bDateStr === targetDateStr
  })

  const bookedSeats = new Map()
  for (const b of activeConflictingBookings) {
    for (const p of b.passengers || []) {
      if (p.seatId) {
        bookedSeats.set(p.seatId, { passengerName: p.name, invoiceNo: b.invoiceNo })
      }
    }
  }

  const conflicts = seatIds.filter((s) => bookedSeats.has(s))
  if (conflicts.length > 0) {
    return {
      status: 409,
      message: `Seat(s) ${conflicts.join(", ")} already booked for ${tourName} on this date.`,
      conflictingSeats: conflicts,
    }
  }

  return null
}

test("Seat Conflict - Rejects internal seat duplication in same booking (400)", () => {
  const result = evaluateSeatConflicts({
    tourName: "Kedarnath Yatra",
    journeyDate: "2026-10-15",
    newPassengers: [
      { name: "Ramesh Sharma", seatId: "1A" },
      { name: "Suresh Sharma", seatId: "1A" }, // duplicate seat in same booking
    ],
  })

  assert.notEqual(result, null)
  assert.equal(result.status, 400)
  assert.match(result.message, /assigned to multiple passengers/)
})

test("Seat Conflict - Rejects double-booking same seat on same tour and date (409)", () => {
  const existingBookings = [
    {
      _id: "book-1",
      tourName: "Kedarnath Yatra",
      journeyDate: "2026-10-15T00:00:00.000Z",
      status: "Confirmed",
      passengers: [{ name: "Rajesh Kumar", seatId: "2B" }],
    },
  ]

  const result = evaluateSeatConflicts({
    tourName: "Kedarnath Yatra",
    journeyDate: "2026-10-15",
    newPassengers: [{ name: "Pooja Verma", seatId: "2B" }],
    existingBookings,
  })

  assert.notEqual(result, null)
  assert.equal(result.status, 409)
  assert.deepEqual(result.conflictingSeats, ["2B"])
  assert.match(result.message, /already booked/)
})

test("Seat Conflict - Allows same seat on different date or different tour", () => {
  const existingBookings = [
    {
      _id: "book-1",
      tourName: "Kedarnath Yatra",
      journeyDate: "2026-10-15T00:00:00.000Z",
      status: "Confirmed",
      passengers: [{ name: "Rajesh Kumar", seatId: "2B" }],
    },
  ]

  // Same seat, different date -> Allowed
  const resultDiffDate = evaluateSeatConflicts({
    tourName: "Kedarnath Yatra",
    journeyDate: "2026-10-16",
    newPassengers: [{ name: "Pooja Verma", seatId: "2B" }],
    existingBookings,
  })
  assert.equal(resultDiffDate, null)

  // Same seat, different tour -> Allowed
  const resultDiffTour = evaluateSeatConflicts({
    tourName: "Badrinath Yatra",
    journeyDate: "2026-10-15",
    newPassengers: [{ name: "Pooja Verma", seatId: "2B" }],
    existingBookings,
  })
  assert.equal(resultDiffTour, null)
})

test("Seat Conflict - Cancelled booking releases seats for new reservations", () => {
  const existingBookings = [
    {
      _id: "book-1",
      tourName: "Kedarnath Yatra",
      journeyDate: "2026-10-15T00:00:00.000Z",
      status: "Cancelled", // Cancelled booking
      passengers: [{ name: "Rajesh Kumar", seatId: "2B" }],
    },
  ]

  const result = evaluateSeatConflicts({
    tourName: "Kedarnath Yatra",
    journeyDate: "2026-10-15",
    newPassengers: [{ name: "Pooja Verma", seatId: "2B" }],
    existingBookings,
  })

  assert.equal(result, null, "Cancelled booking should not block seat 2B")
})
