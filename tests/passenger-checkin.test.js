import test from "node:test"
import assert from "node:assert/strict"

/**
 * Pure simulator of passenger check-in toggle from backend/routes/bookings.js
 */
function togglePassengerCheckin(booking, passengerIdentifier) {
  const passengers = [...(booking.passengers || [])]

  // Identify passenger by _id or fallback to numeric index
  let targetIndex = -1
  if (typeof passengerIdentifier === "number") {
    targetIndex = passengerIdentifier
  } else if (typeof passengerIdentifier === "string") {
    targetIndex = passengers.findIndex((p) => p._id === passengerIdentifier || p.id === passengerIdentifier)
  }

  if (targetIndex === -1 || targetIndex >= passengers.length) {
    throw new Error("Passenger not found")
  }

  const currentPassenger = passengers[targetIndex]
  passengers[targetIndex] = {
    ...currentPassenger,
    checkedIn: !currentPassenger.checkedIn,
  }

  return {
    ...booking,
    passengers,
  }
}

/**
 * Calculates manifest stats for JourneyManager
 */
function calculateManifestStats(bookingsForTrip) {
  const activeBookings = bookingsForTrip.filter(
    (b) => b.status !== "Cancelled" && b.status !== "cancelled"
  )

  let totalPax = 0
  let checkedInPax = 0

  for (const b of activeBookings) {
    for (const p of b.passengers || []) {
      totalPax += 1
      if (p.checkedIn) {
        checkedInPax += 1
      }
    }
  }

  const checkinPercentage = totalPax > 0 ? Math.round((checkedInPax / totalPax) * 100) : 0

  return { totalPax, checkedInPax, checkinPercentage }
}

test("Passenger check-in - Toggle changes checkedIn boolean state and persists", () => {
  const initialBooking = {
    _id: "book-1",
    passengers: [
      { _id: "p-1", name: "Sunita Sharma", seatId: "1A", checkedIn: false },
      { _id: "p-2", name: "Anil Sharma", seatId: "1B", checkedIn: false },
    ],
  }

  // Check in passenger 1
  const afterFirstCheckin = togglePassengerCheckin(initialBooking, "p-1")
  assert.equal(afterFirstCheckin.passengers[0].checkedIn, true)
  assert.equal(afterFirstCheckin.passengers[1].checkedIn, false, "Passenger 2 should remain unchecked")

  // Uncheck passenger 1
  const afterUndo = togglePassengerCheckin(afterFirstCheckin, "p-1")
  assert.equal(afterUndo.passengers[0].checkedIn, false)
})

test("Passenger check-in - Fallback to index when _id not present", () => {
  const booking = {
    _id: "book-2",
    passengers: [
      { name: "Traveler A", seatId: "3A", checkedIn: false },
      { name: "Traveler B", seatId: "3B", checkedIn: true },
    ],
  }

  const updated = togglePassengerCheckin(booking, 0)
  assert.equal(updated.passengers[0].checkedIn, true)
})

test("Passenger check-in - Manifest summary calculation for coach", () => {
  const tripBookings = [
    {
      _id: "b-1",
      status: "Confirmed",
      passengers: [
        { _id: "p1", name: "Ravi", seatId: "1A", checkedIn: true },
        { _id: "p2", name: "Meena", seatId: "1B", checkedIn: true },
      ],
    },
    {
      _id: "b-2",
      status: "Confirmed",
      passengers: [
        { _id: "p3", name: "Kiran", seatId: "2A", checkedIn: false },
        { _id: "p4", name: "Vijay", seatId: "2B", checkedIn: false },
      ],
    },
    {
      _id: "b-3",
      status: "Cancelled", // Cancelled booking should be excluded from manifest count
      passengers: [
        { _id: "p5", name: "Cancelled Pax", seatId: "5A", checkedIn: true },
      ],
    },
  ]

  const stats = calculateManifestStats(tripBookings)
  assert.equal(stats.totalPax, 4)
  assert.equal(stats.checkedInPax, 2)
  assert.equal(stats.checkinPercentage, 50)
})
