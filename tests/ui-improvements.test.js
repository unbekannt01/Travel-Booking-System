import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { autoAssignSeats } from "../src/utils/seatAssignment.js"

// ── Auto-Assign Seats Tests ──

describe("Auto-Assign Seats Utility", () => {
  it("assigns lower deck seats first when deckPreference is 'lower'", () => {
    const passengers = [
      { name: "Aarav Sharma", seatId: "" },
      { name: "Priya Sharma", seatId: "" },
    ]
    const bookedSeats = []

    const result = autoAssignSeats({
      passengers,
      bookedSeats,
      deckPreference: "lower",
      layout: "2x1",
    })

    assert.equal(result.assignments.length, 2)
    assert.equal(result.unassignedCount, 0)
    assert.equal(result.assignments[0].proposedSeatId.startsWith("lower-"), true)
    assert.equal(result.assignments[1].proposedSeatId.startsWith("lower-"), true)
  })

  it("assigns upper deck seats first when deckPreference is 'upper'", () => {
    const passengers = [
      { name: "Vikram Singh", seatId: "" },
      { name: "Rohit Verma", seatId: "" },
    ]
    const bookedSeats = []

    const result = autoAssignSeats({
      passengers,
      bookedSeats,
      deckPreference: "upper",
      layout: "2x1",
    })

    assert.equal(result.assignments.length, 2)
    assert.equal(result.assignments[0].proposedSeatId.startsWith("upper-"), true)
    assert.equal(result.assignments[1].proposedSeatId.startsWith("upper-"), true)
  })

  it("skips already booked or occupied seats", () => {
    const passengers = [{ name: "Ananya", seatId: "" }]
    // Suppose lower-R1-1 and lower-R1-2 are booked
    const bookedSeats = [{ seatId: "lower-R1-1" }, { seatId: "lower-R1-2" }]

    const result = autoAssignSeats({
      passengers,
      bookedSeats,
      deckPreference: "lower",
      layout: "2x1",
    })

    assert.equal(result.assignments.length, 1)
    // The next available in 2x1 lower deck is lower-L1
    assert.equal(result.assignments[0].proposedSeatId, "lower-L1")
    assert.equal(result.allAvailable.includes("lower-R1-1"), false)
    assert.equal(result.allAvailable.includes("lower-R1-2"), false)
  })

  it("does not reassign passengers who already have seats", () => {
    const passengers = [
      { name: "Suresh", seatId: "lower-L3" },
      { name: "Ramesh", seatId: "" },
    ]
    const bookedSeats = []

    const result = autoAssignSeats({
      passengers,
      bookedSeats,
      deckPreference: "lower",
      layout: "2x1",
    })

    assert.equal(result.assignments.length, 1)
    assert.equal(result.assignments[0].passengerName, "Ramesh")
    // Suresh's seat should not be offered to Ramesh
    assert.notEqual(result.assignments[0].proposedSeatId, "lower-L3")
  })

  it("handles 2x2 layout correctly with 4 seats per row", () => {
    const passengers = [
      { name: "P1", seatId: "" },
      { name: "P2", seatId: "" },
      { name: "P3", seatId: "" },
      { name: "P4", seatId: "" },
    ]
    const bookedSeats = []

    const result = autoAssignSeats({
      passengers,
      bookedSeats,
      deckPreference: "lower",
      layout: "2x2",
    })

    assert.equal(result.assignments.length, 4)
    assert.equal(result.assignments[0].proposedSeatId, "lower-L1-1")
    assert.equal(result.assignments[1].proposedSeatId, "lower-L1-2")
    assert.equal(result.assignments[2].proposedSeatId, "lower-R1-1")
    assert.equal(result.assignments[3].proposedSeatId, "lower-R1-2")
  })

  it("reports unassignedCount when coach capacity is exceeded", () => {
    // Generate bookings filling up all 36 seats in a 2x1 layout (6 rows * 3 seats * 2 decks = 36)
    const bookedSeats = []
    for (let r = 1; r <= 6; r++) {
      bookedSeats.push({ seatId: `lower-R${r}-1` })
      bookedSeats.push({ seatId: `lower-R${r}-2` })
      bookedSeats.push({ seatId: `lower-L${r}` })
      bookedSeats.push({ seatId: `upper-R${r}-1` })
      bookedSeats.push({ seatId: `upper-R${r}-2` })
      bookedSeats.push({ seatId: `upper-L${r}` })
    }

    const passengers = [{ name: "Extra Pax", seatId: "" }]
    const result = autoAssignSeats({
      passengers,
      bookedSeats,
      deckPreference: "any",
      layout: "2x1",
    })

    assert.equal(result.assignments.length, 0)
    assert.equal(result.unassignedCount, 1)
  })
})

// ── Soft Delete & Restore Tests ──

describe("Soft Delete & Restore Logic", () => {
  it("excludes soft-deleted bookings from active list", () => {
    const bookings = [
      { id: "b1", customerName: "Raj", deletedAt: null },
      { id: "b2", customerName: "Anita", deletedAt: new Date().toISOString() },
      { id: "b3", customerName: "Kunal" }, // no deletedAt field
    ]

    const activeBookings = bookings.filter((b) => !b.deletedAt)
    assert.equal(activeBookings.length, 2)
    assert.deepEqual(
      activeBookings.map((b) => b.id),
      ["b1", "b3"]
    )
  })

  it("releases seats when booking is soft-deleted", () => {
    const activeBookings = [
      {
        id: "b1",
        tourId: "t1",
        travelDate: "2026-10-01",
        deletedAt: new Date().toISOString(),
        passengers: [{ seatId: "lower-L1" }],
      },
      {
        id: "b2",
        tourId: "t1",
        travelDate: "2026-10-01",
        deletedAt: null,
        passengers: [{ seatId: "lower-L2" }],
      },
    ]

    // Seat conflict check should ignore soft-deleted bookings
    const requestedSeat = "lower-L1"
    const occupiedSeats = new Set()
    activeBookings
      .filter((b) => !b.deletedAt)
      .forEach((b) => {
        b.passengers.forEach((p) => occupiedSeats.add(p.seatId))
      })

    assert.equal(occupiedSeats.has(requestedSeat), false, "Soft-deleted seat should be freed")
    assert.equal(occupiedSeats.has("lower-L2"), true, "Active booking seat should remain occupied")
  })

  it("restoring a soft-deleted booking clears deletedAt", () => {
    const booking = {
      id: "b1",
      customerName: "Raj",
      deletedAt: new Date().toISOString(),
    }

    // Simulate restore operation
    booking.deletedAt = null

    assert.equal(booking.deletedAt, null)
    const activeBookings = [booking].filter((b) => !b.deletedAt)
    assert.equal(activeBookings.length, 1)
  })
})

// ── Search & Filter Chips Tests ──

describe("Search and Filter Chips Logic", () => {
  const sampleBookings = [
    {
      invoiceNumber: "INV-2026-001",
      customerName: "Rajesh Kumar",
      customerPhone: "9876543210",
      tourName: "Varanasi Ayodhya Yatra",
      status: "Confirmed",
      totalAmount: 10000,
      advanceReceived: 10000,
      passengers: [{ name: "Rajesh Kumar", seatId: "lower-L1" }],
    },
    {
      invoiceNumber: "INV-2026-002",
      customerName: "Pooja Sharma",
      customerPhone: "9123456780",
      tourName: "Chardham Yatra",
      status: "Confirmed",
      totalAmount: 15000,
      advanceReceived: 5000,
      passengers: [{ name: "Pooja Sharma", seatId: "upper-R1-1" }],
    },
    {
      invoiceNumber: "INV-2026-003",
      customerName: "Amitabh Sen",
      customerPhone: "9898989898",
      tourName: "Tirupati Balaji Darshan",
      status: "Cancelled",
      totalAmount: 8000,
      advanceReceived: 2000,
      passengers: [{ name: "Amitabh Sen", seatId: "lower-R2-1" }],
    },
  ]

  const matchesSearch = (b, term) => {
    const q = term.toLowerCase().trim()
    if (!q) return true
    const invMatch = (b.invoiceNumber || "").toLowerCase().includes(q)
    const nameMatch = (b.customerName || "").toLowerCase().includes(q)
    const phoneMatch = (b.customerPhone || "").includes(q)
    const tourMatch = (b.tourName || "").toLowerCase().includes(q)
    const paxMatch = (b.passengers || []).some(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.phone || "").includes(q) ||
        (p.seatId || "").toLowerCase().includes(q)
    )
    return invMatch || nameMatch || phoneMatch || tourMatch || paxMatch
  }

  const matchesChip = (b, chip) => {
    if (chip === "all") return true
    if (chip === "cancelled") return b.status === "Cancelled"
    if (b.status === "Cancelled") return false
    const due = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
    if (chip === "paid") return due <= 0
    if (chip === "pending") return due > 0
    return true
  }

  it("filters by status chip accurately", () => {
    const paid = sampleBookings.filter((b) => matchesChip(b, "paid"))
    const pending = sampleBookings.filter((b) => matchesChip(b, "pending"))
    const cancelled = sampleBookings.filter((b) => matchesChip(b, "cancelled"))

    assert.equal(paid.length, 1)
    assert.equal(paid[0].invoiceNumber, "INV-2026-001")

    assert.equal(pending.length, 1)
    assert.equal(pending[0].invoiceNumber, "INV-2026-002")

    assert.equal(cancelled.length, 1)
    assert.equal(cancelled[0].invoiceNumber, "INV-2026-003")
  })

  it("matches search term across invoice, name, phone, tour, and seat", () => {
    assert.equal(sampleBookings.filter((b) => matchesSearch(b, "ayodhya")).length, 1)
    assert.equal(sampleBookings.filter((b) => matchesSearch(b, "9123456780")).length, 1)
    assert.equal(sampleBookings.filter((b) => matchesSearch(b, "upper-r1-1")).length, 1)
    assert.equal(sampleBookings.filter((b) => matchesSearch(b, "INV-2026-003")).length, 1)
  })

  it("combines search and chip filter seamlessly", () => {
    const filtered = sampleBookings
      .filter((b) => matchesChip(b, "pending"))
      .filter((b) => matchesSearch(b, "chardham"))

    assert.equal(filtered.length, 1)
    assert.equal(filtered[0].customerName, "Pooja Sharma")

    const empty = sampleBookings
      .filter((b) => matchesChip(b, "paid"))
      .filter((b) => matchesSearch(b, "chardham"))

    assert.equal(empty.length, 0)
  })
})
