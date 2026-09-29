import { describe, it } from "node:test"
import assert from "node:assert/strict"

// Normalizes customer phone numbers for matching across bookings
const normalizePhone = (phone) => {
  if (!phone) return ""
  const digits = String(phone).replace(/\D/g, "")
  // If 12 digits starting with 91, extract 10 digits
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.substring(2)
  }
  // If 11 digits starting with 0, extract 10 digits
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.substring(1)
  }
  return digits
}

const findCustomerHistory = (bookings, searchPhone) => {
  const target = normalizePhone(searchPhone)
  if (!target || target.length < 10) return []

  return bookings.filter((b) => {
    if (b.deletedAt) return false
    const leadPhone = normalizePhone(b.contactPhone)
    if (leadPhone === target) return true

    // Also match any passenger's contact number
    const paxMatch = (b.passengers || []).some(
      (p) => normalizePhone(p.contact) === target
    )
    return paxMatch
  })
}

describe("Customer History Lookup by Phone", () => {
  const sampleBookings = [
    {
      invoiceNo: "YHB-001",
      contactName: "Ramesh Bhai",
      contactPhone: "+91 98250 11111",
      tourName: "Somnath Dwarka",
      passengers: [{ name: "Ramesh Bhai", contact: "9825011111" }],
    },
    {
      invoiceNo: "YHB-002",
      contactName: "Ramesh Bhai",
      contactPhone: "09825011111",
      tourName: "Statue of Unity",
      passengers: [{ name: "Ramesh Bhai" }],
    },
    {
      invoiceNo: "YHB-003",
      contactName: "Pooja Patel",
      contactPhone: "9898022222",
      tourName: "Gir Forest Safari",
      passengers: [{ name: "Pooja Patel" }],
    },
    {
      invoiceNo: "YHB-DEL",
      contactName: "Ramesh Bhai",
      contactPhone: "9825011111",
      tourName: "Old Tour",
      deletedAt: new Date(),
    },
  ]

  it("normalizes diverse Indian phone formats (+91, 0, spaces, dashes)", () => {
    assert.equal(normalizePhone("+91 98250-11111"), "9825011111")
    assert.equal(normalizePhone("09825011111"), "9825011111")
    assert.equal(normalizePhone("9825011111"), "9825011111")
  })

  it("matches customer past bookings accurately across different phone formats", () => {
    const history = findCustomerHistory(sampleBookings, "9825011111")
    assert.equal(history.length, 2)
    assert.equal(history[0].invoiceNo, "YHB-001")
    assert.equal(history[1].invoiceNo, "YHB-002")
  })

  it("excludes soft-deleted bookings from customer history", () => {
    const history = findCustomerHistory(sampleBookings, "+91 98250 11111")
    const deletedFound = history.some((b) => b.invoiceNo === "YHB-DEL")
    assert.equal(deletedFound, false)
  })

  it("returns empty array for invalid or short phone queries", () => {
    assert.deepEqual(findCustomerHistory(sampleBookings, "123"), [])
    assert.deepEqual(findCustomerHistory(sampleBookings, ""), [])
  })
})
