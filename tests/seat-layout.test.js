import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  getDeckPhysicalSeats,
  mapCoachSeatManifest,
  buildSeatLayoutPrintHTML,
} from "../src/utils/seatLayout.js"

describe("Coach Seat Layout & Conductor Manifest", () => {
  it("generates correct physical berth list for 2x1 sleeper (18 berths per deck, 36 total)", () => {
    const lower = getDeckPhysicalSeats("lower", "2x1")
    const upper = getDeckPhysicalSeats("upper", "2x1")

    assert.equal(lower.length, 18)
    assert.equal(upper.length, 18)

    // Left column has 6 seats (L1..L6)
    const leftSeats = lower.filter((s) => s.side === "left")
    assert.equal(leftSeats.length, 6)
    assert.equal(leftSeats[0].id, "lower-L1")
    assert.equal(leftSeats[5].id, "lower-L6")

    // Right column has 12 seats (2 per row: R1-1, R1-2 .. R6-2)
    const rightSeats = lower.filter((s) => s.side === "right")
    assert.equal(rightSeats.length, 12)
    assert.equal(rightSeats[0].id, "lower-R1-1")
    assert.equal(rightSeats[1].id, "lower-R1-2")
  })

  it("generates correct physical berth list for 2x2 sleeper (20 berths per deck, 40 total)", () => {
    const lower = getDeckPhysicalSeats("lower", "2x2")
    const upper = getDeckPhysicalSeats("upper", "2x2")

    assert.equal(lower.length, 20)
    assert.equal(upper.length, 20)

    const leftSeats = lower.filter((s) => s.side === "left")
    const rightSeats = lower.filter((s) => s.side === "right")
    assert.equal(leftSeats.length, 10)
    assert.equal(rightSeats.length, 10)
  })

  it("maps booked passengers to seats and marks unbooked berths as Available", () => {
    const departure = {
      tourName: "Rann Utsav Special",
      journeyDate: "2026-11-20",
      busNumber: "GJ-01-AB-1234",
      busType: "2x1 Luxury AC Sleeper",
    }

    const bookings = [
      {
        _id: "b1",
        invoiceNo: "YHB-101",
        tourName: "Rann Utsav Special",
        journeyDate: "2026-11-20",
        contactName: "Sanjay Dave",
        contactPhone: "9825012345",
        totalAmount: 12000,
        advanceReceived: 12000,
        passengers: [
          { name: "Sanjay Dave", age: 45, gender: "Male", seatId: "lower-L1" },
          { name: "Geeta Dave", age: 42, gender: "Female", seatId: "lower-R1-1" },
        ],
      },
      {
        _id: "b2",
        invoiceNo: "YHB-102",
        tourName: "Rann Utsav Special",
        journeyDate: "2026-11-20",
        contactName: "Kunal Shah",
        contactPhone: "9988776655",
        totalAmount: 6000,
        advanceReceived: 3000,
        passengers: [
          { name: "Kunal Shah", age: 28, gender: "Male", seatId: "upper-L1" },
        ],
      },
    ]

    const manifest = mapCoachSeatManifest({ departure, bookings, layoutType: "2x1" })

    assert.equal(manifest.totalCapacity, 36)
    assert.equal(manifest.totalBooked, 3)
    assert.equal(manifest.totalAvailable, 33)
    assert.equal(manifest.occupancyPercentage, 8) // 3 / 36 = 8.33% -> 8%

    // Lower deck check
    const lowerL1 = manifest.lowerDeck.seats.find((s) => s.id === "lower-L1")
    assert.equal(lowerL1.status, "booked")
    assert.equal(lowerL1.passenger.name, "Sanjay Dave")
    assert.equal(lowerL1.passenger.invoiceNo, "YHB-101")
    assert.equal(lowerL1.passenger.isPaid, true)

    const lowerL2 = manifest.lowerDeck.seats.find((s) => s.id === "lower-L2")
    assert.equal(lowerL2.status, "available")
    assert.equal(lowerL2.passenger, null)

    // Upper deck check
    const upperL1 = manifest.upperDeck.seats.find((s) => s.id === "upper-L1")
    assert.equal(upperL1.status, "booked")
    assert.equal(upperL1.passenger.name, "Kunal Shah")
    assert.equal(upperL1.passenger.isPaid, false)
    assert.equal(upperL1.passenger.balanceDue, 3000)
  })

  it("excludes soft-deleted and cancelled bookings from occupying seats", () => {
    const departure = {
      tourName: "Somnath Pilgrimage",
      journeyDate: "2026-12-01",
    }

    const bookings = [
      {
        _id: "b_active",
        invoiceNo: "YHB-201",
        tourName: "Somnath Pilgrimage",
        journeyDate: "2026-12-01",
        passengers: [{ name: "Active Pax", seatId: "lower-L1" }],
      },
      {
        _id: "b_deleted",
        deletedAt: new Date(),
        invoiceNo: "YHB-DEL",
        tourName: "Somnath Pilgrimage",
        journeyDate: "2026-12-01",
        passengers: [{ name: "Deleted Pax", seatId: "lower-L2" }],
      },
      {
        _id: "b_cancelled",
        status: "cancelled",
        invoiceNo: "YHB-CAN",
        tourName: "Somnath Pilgrimage",
        journeyDate: "2026-12-01",
        passengers: [{ name: "Cancelled Pax", seatId: "lower-L3" }],
      },
    ]

    const manifest = mapCoachSeatManifest({ departure, bookings, layoutType: "2x1" })

    assert.equal(manifest.totalBooked, 1)
    const lowerL1 = manifest.lowerDeck.seats.find((s) => s.id === "lower-L1")
    assert.equal(lowerL1.status, "booked")

    const lowerL2 = manifest.lowerDeck.seats.find((s) => s.id === "lower-L2")
    assert.equal(lowerL2.status, "available") // Deleted released

    const lowerL3 = manifest.lowerDeck.seats.find((s) => s.id === "lower-L3")
    assert.equal(lowerL3.status, "available") // Cancelled released
  })

  it("generates separate printable pages for Upper and Lower Decks", () => {
    const departure = {
      tourName: "Haridwar Express",
      journeyDate: "2026-10-10",
      busNumber: "DL-01-9999",
      busType: "2x1 Sleeper",
    }
    const manifest = mapCoachSeatManifest({ departure, bookings: [], layoutType: "2x1" })

    const fullPrintHTML = buildSeatLayoutPrintHTML({
      manifestData: manifest,
      departure,
      user: { companyName: "Jai Mata Di Travels" },
      deckFilter: "both",
    })

    assert.ok(fullPrintHTML.includes("LOWER DECK SEAT LAYOUT"))
    assert.ok(fullPrintHTML.includes("UPPER DECK SEAT LAYOUT"))
    assert.ok(fullPrintHTML.includes("page-break-after: always"))
    assert.ok(fullPrintHTML.includes("DRIVER CABIN / FRONT"))
    assert.ok(fullPrintHTML.includes("PASSENGER MANIFEST & BOARDING CHECKLIST"))

    // Single deck filter test
    const lowerOnlyHTML = buildSeatLayoutPrintHTML({
      manifestData: manifest,
      departure,
      user: { companyName: "Jai Mata Di Travels" },
      deckFilter: "lower",
    })
    assert.ok(lowerOnlyHTML.includes("LOWER DECK SEAT LAYOUT"))
    assert.ok(!lowerOnlyHTML.includes("UPPER DECK SEAT LAYOUT"))
  })
})
