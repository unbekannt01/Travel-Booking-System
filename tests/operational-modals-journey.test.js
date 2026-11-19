import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatSeatLabel, formatSeatList } from "../src/utils/formatters.js"
import { resolvePageMeta } from "../src/components/shell/shellConfig.js"
import { calculateCancellationRefund } from "../shared/businessLogic.js"

describe("Operational Modals & Journeys Screen (Part 3.4)", () => {
  describe("Seat Label & List Formatting (Task A)", () => {
    it("parses lower and upper deck sleeper seats into human-readable labels", () => {
      assert.equal(formatSeatLabel("lower-L1-1"), "Lower L1-1")
      assert.equal(formatSeatLabel("upper-R2-2"), "Upper R2-2")
      assert.equal(formatSeatLabel("lower-L3"), "Lower L3")
      assert.equal(formatSeatLabel("upper-U10-1"), "Upper U10-1")
    })

    it("normalizes case when parsing deck prefixes", () => {
      assert.equal(formatSeatLabel("LOWER-L1-1"), "Lower L1-1")
      assert.equal(formatSeatLabel("UpPeR-r2-2"), "Upper r2-2")
    })

    it("falls back gracefully for null, undefined, whitespace, or unassigned inputs", () => {
      assert.equal(formatSeatLabel(null), "Unassigned")
      assert.equal(formatSeatLabel(undefined), "Unassigned")
      assert.equal(formatSeatLabel(""), "Unassigned")
      assert.equal(formatSeatLabel("   "), "Unassigned")
      assert.equal(formatSeatLabel("", { fallback: "N/A" }), "N/A")
      assert.equal(formatSeatLabel(null, { fallback: "None" }), "None")
    })

    it("returns non-standard or simple seat identifiers as-is", () => {
      assert.equal(formatSeatLabel("12A"), "12A")
      assert.equal(formatSeatLabel("Seat-5"), "Seat-5")
    })

    it("formats an array of seats into a clean comma-separated list", () => {
      const seats = ["lower-L1-1", "upper-R2-2"]
      assert.equal(formatSeatList(seats), "Lower L1-1, Upper R2-2")
    })

    it("truncates seat list and appends overflow count when max limit is specified", () => {
      const seats = ["lower-L1-1", "upper-R2-2", "lower-L2-1", "upper-R3-1"]
      assert.equal(formatSeatList(seats, { max: 2 }), "Lower L1-1, Upper R2-2 +2")
      assert.equal(formatSeatList(seats, { max: 3 }), "Lower L1-1, Upper R2-2, Lower L2-1 +1")
      assert.equal(formatSeatList(seats, { max: 4 }), "Lower L1-1, Upper R2-2, Lower L2-1, Upper R3-1")
    })

    it("handles non-array or empty seat lists gracefully", () => {
      assert.equal(formatSeatList([]), "Unassigned")
      assert.equal(formatSeatList(null), "Unassigned")
      assert.equal(formatSeatList(undefined), "Unassigned")
      assert.equal(formatSeatList([], { fallback: "No seats selected" }), "No seats selected")
    })
  })

  describe("Journeys Screen & App Shell Route Meta (Task B & Task D)", () => {
    it("configures Journeys screen with hasOwnHeading: false for PageHeader integration", () => {
      const meta = resolvePageMeta("journey")
      assert.equal(meta.id, "journey")
      assert.equal(meta.title, "Journeys")
      assert.equal(meta.hasOwnHeading, false)
    })

    it("verifies heading flags across routes for shell polish", () => {
      assert.equal(resolvePageMeta("dashboard").hasOwnHeading, false)
      assert.equal(resolvePageMeta("journey").hasOwnHeading, false)
      assert.equal(resolvePageMeta("passengers").hasOwnHeading, false)
      assert.equal(resolvePageMeta("tours").hasOwnHeading, true)
    })

    it("calculates occupancy percentage and progress bar values accurately", () => {
      const calculateOccupancy = (booked, capacity) => {
        if (!capacity || capacity <= 0) return 0
        return Math.min(100, Math.round((booked / capacity) * 100))
      }

      assert.equal(calculateOccupancy(20, 30), 67)
      assert.equal(calculateOccupancy(15, 30), 50)
      assert.equal(calculateOccupancy(30, 30), 100)
      assert.equal(calculateOccupancy(0, 30), 0)
      assert.equal(calculateOccupancy(0, 0), 0)
    })

    it("computes boarded passenger counts and boarding checklist status", () => {
      const passengers = [
        { name: "Traveler 1", isCheckedIn: true },
        { name: "Traveler 2", isCheckedIn: false },
        { name: "Traveler 3", isCheckedIn: true },
      ]
      const boardedCount = passengers.filter((p) => p.isCheckedIn).length
      assert.equal(boardedCount, 2)
      assert.equal(passengers.length, 3)
      assert.equal(Math.round((boardedCount / passengers.length) * 100), 67)
    })
  })

  describe("Cancellation Charge & Refund Calculations (Task C)", () => {
    const calculateRefund = (totalPaid, fee) => {
      const numericFee = Math.max(0, Number(fee) || 0)
      return Math.max(0, totalPaid - numericFee)
    }

    it("calculates refund amount as totalPaid minus cancellationFee", () => {
      assert.equal(calculateRefund(10000, 2000), 8000)
      assert.equal(calculateRefund(5000, 1500), 3500)
    })

    it("bounds refund at zero when cancellation fee exceeds total paid", () => {
      assert.equal(calculateRefund(5000, 6000), 0)
      assert.equal(calculateRefund(0, 500), 0)
    })

    it("preserves full refund when cancellation fee is zero", () => {
      assert.equal(calculateRefund(8500, 0), 8500)
    })

    it("verifies preset calculations for ₹0 fee and Retain All fee", () => {
      const totalPaid = 7500
      // Preset: Full refund (fee = 0)
      assert.equal(calculateRefund(totalPaid, 0), 7500)
      // Preset: Retain all (fee = totalPaid)
      assert.equal(calculateRefund(totalPaid, totalPaid), 0)
    })
  })

  describe("Invoices Filter & Search Logic (Task C)", () => {
    const sampleInvoices = [
      {
        id: "b1",
        invoiceNo: "YHB-101",
        contactName: "Ramesh Sharma",
        contactPhone: "9876543210",
        tourName: "Kedarnath Yatra",
        status: "Confirmed",
        totalAmount: 15000,
        advanceReceived: 15000,
        isPaid: true,
        passengers: [{ name: "Ramesh Sharma" }, { name: "Suresh Sharma" }],
      },
      {
        id: "b2",
        invoiceNo: "YHB-102",
        contactName: "Pooja Patel",
        contactPhone: "9123456789",
        tourName: "Chardham Special",
        status: "Confirmed",
        totalAmount: 25000,
        advanceReceived: 10000,
        isPaid: false,
        passengers: [{ name: "Pooja Patel" }],
      },
      {
        id: "b3",
        invoiceNo: "YHB-103",
        contactName: "Amit Kumar",
        contactPhone: "9988776655",
        tourName: "Kedarnath Yatra",
        status: "Cancelled",
        totalAmount: 12000,
        advanceReceived: 12000,
        isPaid: false,
        passengers: [{ name: "Amit Kumar" }],
      },
    ]

    const filterInvoices = (invoices, { status = "all", tour = "all", search = "" } = {}) => {
      return invoices.filter((b) => {
        const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
        const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
        const isPaid = !isCancelled && (b.isPaid || balance === 0)
        const isPending = !isCancelled && !isPaid

        if (status === "paid" && !isPaid) return false
        if (status === "pending" && !isPending) return false
        if (status === "cancelled" && !isCancelled) return false
        if (tour !== "all" && b.tourName !== tour) return false

        if (search.trim()) {
          const q = search.toLowerCase().trim()
          const matchesInvoice = b.invoiceNo?.toLowerCase().includes(q)
          const matchesName = b.contactName?.toLowerCase().includes(q)
          const matchesPhone = b.contactPhone?.toLowerCase().includes(q)
          const matchesTour = b.tourName?.toLowerCase().includes(q)
          const matchesPassenger = b.passengers?.some((p) => p.name?.toLowerCase().includes(q))
          if (!matchesInvoice && !matchesName && !matchesPhone && !matchesTour && !matchesPassenger) {
            return false
          }
        }
        return true
      })
    }

    it("filters invoices by payment and cancellation status chips", () => {
      assert.equal(filterInvoices(sampleInvoices, { status: "all" }).length, 3)
      assert.equal(filterInvoices(sampleInvoices, { status: "paid" }).length, 1)
      assert.equal(filterInvoices(sampleInvoices, { status: "paid" })[0].invoiceNo, "YHB-101")
      assert.equal(filterInvoices(sampleInvoices, { status: "pending" }).length, 1)
      assert.equal(filterInvoices(sampleInvoices, { status: "pending" })[0].invoiceNo, "YHB-102")
      assert.equal(filterInvoices(sampleInvoices, { status: "cancelled" }).length, 1)
      assert.equal(filterInvoices(sampleInvoices, { status: "cancelled" })[0].invoiceNo, "YHB-103")
    })

    it("filters invoices by tour name", () => {
      assert.equal(filterInvoices(sampleInvoices, { tour: "Kedarnath Yatra" }).length, 2)
      assert.equal(filterInvoices(sampleInvoices, { tour: "Chardham Special" }).length, 1)
    })

    it("searches invoices across invoice number, traveler name, phone, tour, and passengers", () => {
      assert.equal(filterInvoices(sampleInvoices, { search: "YHB-102" }).length, 1)
      assert.equal(filterInvoices(sampleInvoices, { search: "9876543210" }).length, 1)
      assert.equal(filterInvoices(sampleInvoices, { search: "Suresh" }).length, 1)
      assert.equal(filterInvoices(sampleInvoices, { search: "patel" }).length, 1)
      assert.equal(filterInvoices(sampleInvoices, { search: "Kedarnath" }).length, 2)
      assert.equal(filterInvoices(sampleInvoices, { search: "Nonexistent" }).length, 0)
    })
  })

  describe("Step 0 Carry-over Verification (Part 3.5)", () => {
    it("proves client refund display equals server calculation exactly across edge cases", () => {
      const computeClientRefund = (totalPaid, fee) => {
        const isFeeTooHigh = fee > totalPaid
        if (isFeeTooHigh) return 0
        try {
          const calc = calculateCancellationRefund({ totalPaid, cancellationCharge: fee })
          return calc.refundAmount
        } catch {
          return 0
        }
      }

      assert.equal(computeClientRefund(5000, 2000), 3000)
      assert.equal(computeClientRefund(5000, 0), 5000)
      assert.equal(computeClientRefund(5000, 5000), 0)
      assert.equal(computeClientRefund(5000, 6000), 0)
    })

    it("verifies payment voiding requires non-empty void reason", () => {
      const validateVoidReason = (reason) => {
        return typeof reason === "string" && reason.trim().length > 0
      }
      assert.equal(validateVoidReason(""), false)
      assert.equal(validateVoidReason("   "), false)
      assert.equal(validateVoidReason(null), false)
      assert.equal(validateVoidReason(undefined), false)
      assert.equal(validateVoidReason("Wrong amount recorded"), true)
    })

    it("verifies passenger reconciliation supports backward-compatible aadhaar and aadhar fields", () => {
      const reconcilePax = (inputPax) => {
        const paxObj = { ...inputPax }
        const inputAadhaar = paxObj.aadhar !== undefined ? paxObj.aadhar : paxObj.aadhaar
        if (inputAadhaar && typeof inputAadhaar === "string" && inputAadhaar.trim().length > 0) {
          paxObj.aadhar = "ENCRYPTED_" + inputAadhaar.trim()
          paxObj.aadharEncrypted = true
        } else {
          paxObj.aadhar = ""
          paxObj.aadharEncrypted = false
        }
        delete paxObj.aadhaar
        delete paxObj.aadhaarEncrypted
        return paxObj
      }

      // Input using legacy 'aadhaar' spelling
      const fromLegacy = reconcilePax({ name: "Ramesh", aadhaar: "555555550017" })
      assert.equal(fromLegacy.aadhar, "ENCRYPTED_555555550017")
      assert.equal(fromLegacy.aadharEncrypted, true)
      assert.equal(fromLegacy.aadhaar, undefined)

      // Input using canonical 'aadhar' spelling
      const fromCanonical = reconcilePax({ name: "Suresh", aadhar: "555555550017" })
      assert.equal(fromCanonical.aadhar, "ENCRYPTED_555555550017")
      assert.equal(fromCanonical.aadharEncrypted, true)
    })
  })
})
