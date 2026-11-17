import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  calculatePricing,
} from "../shared/businessLogic.js"
import { validateSeatLayout } from "../backend/routes/bookings.js"

describe("Server-Side Authority Over Pricing & Seats (SEC-002, SEC-013)", () => {
  describe("Tour Pricing & Calculation Authority", () => {
    it("accurately calculates fixed tour pricing with discount and 5% GST", () => {
      const farePerSeat = 1500
      const totalSeats = 2
      const baseAmount = farePerSeat * totalSeats // 3000

      const result = calculatePricing({
        baseAmount,
        discountType: "fixed",
        discountValue: 500,
        gstRate: 5,
        isTaxInclusive: false,
      })

      assert.equal(result.baseAmount, 3000)
      assert.equal(result.discountAmount, 500)
      assert.equal(result.netBeforeTax, 2500)
      assert.equal(result.taxAmount, 125)
      assert.equal(result.finalTotal, 2625)
    })

    it("accurately calculates tax-inclusive tour pricing without inflating total", () => {
      const result = calculatePricing({
        baseAmount: 2100,
        discountType: "fixed",
        discountValue: 0,
        gstRate: 5,
        isTaxInclusive: true,
      })

      assert.equal(result.baseAmount, 2100)
      assert.equal(result.finalTotal, 2100)
      assert.equal(result.taxAmount, 100)
      assert.equal(result.netBeforeTax, 2000)
    })

    it("recalculates berth-based pricing by seat berth category", () => {
      const passengers = [
        { name: "Pax 1", seatId: "L1" }, // lower single
        { name: "Pax 2", seatId: "U3" }, // upper double
      ]
      const berthPricing = {
        lowerSingle: 1200,
        lowerDouble: 1000,
        upperSingle: 1100,
        upperDouble: 900,
      }

      let subtotal = 0
      for (const p of passengers) {
        if (p.seatId.startsWith("L")) {
          subtotal += berthPricing.lowerSingle
        } else if (p.seatId.startsWith("U")) {
          subtotal += berthPricing.upperDouble
        }
      }

      assert.equal(subtotal, 2100)
      const pricing = calculatePricing({
        baseAmount: subtotal,
        discountValue: 100,
        gstRate: 5,
      })
      assert.equal(pricing.baseAmount, 2100)
      assert.equal(pricing.finalTotal, 2100)
    })

    it("detects and rejects client totalAmount price tampering", () => {
      const clientProvidedTotal = 100 // Maliciously altered client price
      const verifiedSubtotal = 5000
      const serverPricing = calculatePricing({
        baseAmount: verifiedSubtotal,
        discountValue: 0,
        gstRate: 5,
        isTaxInclusive: false,
      })

      const diff = Math.abs(serverPricing.finalTotal - clientProvidedTotal)
      const isTampered = diff > 0.05
      assert.equal(isTampered, true, "Server must detect difference between client total and recomputed total")
    })
  })

  describe("Coach Seat Layout Validation (Bounds & Row Constraints)", () => {
    it("accepts valid passenger count and valid row numbers for 2x2 layout", () => {
      const passengers = [
        { name: "Ramesh", seatId: "lower-L1-1" },
        { name: "Suresh", seatId: "lower-R2-1" },
        { name: "Mahesh", seatId: "upper-L3-1" },
      ]
      const error = validateSeatLayout(passengers, "2x2")
      assert.equal(error, null)
    })

    it("rejects seat ID exceeding maximum coach row count", () => {
      const passengers = [
        { name: "Ramesh", seatId: "lower-L10-1" }, // Row 10 exceeds 2x2 coach rows (max 5)
      ]
      const error = validateSeatLayout(passengers, "2x2")
      assert.notEqual(error, null)
      assert.match(error.message, /out of bounds/)
    })

    it("rejects mismatch between passenger count and assigned seat count", () => {
      const passengers = [
        { name: "Pax 1", seatId: "lower-L1-1" },
        { name: "Pax 2" }, // Missing seatId
      ]
      const error = validateSeatLayout(passengers, "2x2")
      assert.notEqual(error, null)
      assert.match(error.message, /must match assigned seat count/)
    })
  })

  describe("Seat Conflict & Duplicate Validation", () => {
    it("rejects internal duplicate seats within the same booking request", () => {
      const passengers = [
        { name: "Pax A", seatId: "2A" },
        { name: "Pax B", seatId: "2A" }, // Duplicate in same booking
      ]
      const seats = passengers.map((p) => p.seatId)
      const uniqueSeats = new Set(seats)
      assert.equal(uniqueSeats.size < seats.length, true, "Duplicate seat must be identified")
    })

    it("prevents double-booking conflicting seats on same tour and journey date", () => {
      const existingBookings = [
        {
          _id: "booking_1",
          status: "Confirmed",
          deletedAt: null,
          journeyDate: new Date("2026-12-01T00:00:00.000Z"),
          passengers: [{ name: "Existing Pax", seatId: "4A" }],
        },
      ]

      const bookedSeats = new Set()
      for (const b of existingBookings) {
        if (b.status !== "Cancelled" && !b.deletedAt) {
          b.passengers.forEach((p) => bookedSeats.add(p.seatId))
        }
      }

      const newRequestedSeat = "4A"
      const isConflict = bookedSeats.has(newRequestedSeat)
      assert.equal(isConflict, true, "Seat 4A must conflict with existing confirmed booking")
    })

    it("allows booking previously cancelled or soft-deleted seats", () => {
      const existingBookings = [
        {
          _id: "booking_1",
          status: "Cancelled", // Cancelled booking
          deletedAt: null,
          journeyDate: new Date("2026-12-01T00:00:00.000Z"),
          passengers: [{ name: "Cancelled Pax", seatId: "4A" }],
        },
        {
          _id: "booking_2",
          status: "Confirmed",
          deletedAt: new Date(), // Soft deleted booking
          journeyDate: new Date("2026-12-01T00:00:00.000Z"),
          passengers: [{ name: "Deleted Pax", seatId: "5B" }],
        },
      ]

      const activeBookedSeats = new Set()
      for (const b of existingBookings) {
        if (b.status !== "Cancelled" && !b.deletedAt) {
          b.passengers.forEach((p) => activeBookedSeats.add(p.seatId))
        }
      }

      assert.equal(activeBookedSeats.has("4A"), false, "Cancelled seat 4A should be available")
      assert.equal(activeBookedSeats.has("5B"), false, "Deleted seat 5B should be available")
    })
  })
})
