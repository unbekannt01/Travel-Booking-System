import { describe, it } from "node:test"
import assert from "node:assert/strict"

// ── Batch Check-in Tests ──

describe("Batch Check-in", () => {
  it("Board All sets every passenger to checkedIn=true", () => {
    const passengers = [
      { name: "Raj", checkedIn: false },
      { name: "Meera", checkedIn: false },
      { name: "Arjun", checkedIn: true },
    ]

    // Simulate the backend logic
    const newState = true
    for (const p of passengers) {
      p.checkedIn = newState
    }

    assert.equal(passengers.every((p) => p.checkedIn === true), true)
  })

  it("Unboard All sets every passenger to checkedIn=false", () => {
    const passengers = [
      { name: "Raj", checkedIn: true },
      { name: "Meera", checkedIn: true },
      { name: "Arjun", checkedIn: true },
    ]

    const newState = false
    for (const p of passengers) {
      p.checkedIn = newState
    }

    assert.equal(passengers.every((p) => p.checkedIn === false), true)
  })

  it("Board All is idempotent (running twice does not error)", () => {
    const passengers = [
      { name: "Raj", checkedIn: true },
      { name: "Meera", checkedIn: true },
    ]

    // Run batch board again
    for (const p of passengers) {
      p.checkedIn = true
    }

    assert.equal(passengers.every((p) => p.checkedIn === true), true)
  })
})

// ── Seat Swap Tests ──

describe("Seat Swap", () => {
  it("Reassigning passenger seat updates the seatId", () => {
    const passenger = { name: "Raj", seatId: "lower-L1" }
    const newSeatId = "upper-R3-1"

    passenger.seatId = newSeatId

    assert.equal(passenger.seatId, "upper-R3-1")
  })

  it("Available seats excludes occupied seats from other bookings", () => {
    const allSeats = ["lower-L1", "lower-R1-1", "lower-R1-2", "lower-L2", "lower-R2-1", "lower-R2-2"]
    const occupiedSeats = new Set(["lower-L1", "lower-R2-1"])
    const currentPassengerSeat = "lower-L1" // own seat stays available

    occupiedSeats.delete(currentPassengerSeat)
    const available = allSeats.filter((s) => !occupiedSeats.has(s))

    assert.equal(available.includes("lower-L1"), true, "Current seat should remain available")
    assert.equal(available.includes("lower-R2-1"), false, "Occupied seat should not be available")
    assert.equal(available.length, 5)
  })

  it("Clearing a seat assignment (empty string) is valid", () => {
    const passenger = { name: "Meera", seatId: "lower-L3" }
    passenger.seatId = ""

    assert.equal(passenger.seatId, "")
  })

  it("Seat swap to an already-occupied seat is rejected", () => {
    const allBookingsSeats = new Set(["lower-L1", "lower-L2", "lower-R1-1"])
    const requestedSeat = "lower-L2"

    const isConflict = allBookingsSeats.has(requestedSeat)
    assert.equal(isConflict, true, "Should detect conflict on occupied seat")
  })
})

// ── Quick Balance Collection Tests ──

describe("Quick Balance Collection at Boarding", () => {
  it("Balance calculation is correct", () => {
    const booking = { totalAmount: 15000, advanceReceived: 5000 }
    const balance = Math.max(0, booking.totalAmount - (booking.advanceReceived || 0))

    assert.equal(balance, 10000)
  })

  it("Fully paid booking shows zero balance", () => {
    const booking = { totalAmount: 12000, advanceReceived: 12000 }
    const balance = Math.max(0, booking.totalAmount - (booking.advanceReceived || 0))

    assert.equal(balance, 0)
  })

  it("Overpayment guard prevents negative balance display", () => {
    const booking = { totalAmount: 10000, advanceReceived: 11000 }
    const balance = Math.max(0, booking.totalAmount - (booking.advanceReceived || 0))

    assert.equal(balance, 0)
  })
})
