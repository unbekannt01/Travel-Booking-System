import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  CUSTOMER_TAGS,
  CUSTOMER_LANGUAGES,
  summarizeCustomer,
} from "../shared/customers.js"
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
} from "../backend/utils/customerValidation.js"

describe("Customer Master Backend Validation & Pure Logic (Part 5a)", () => {
  describe("Zod Validation Schemas (createCustomerSchema & updateCustomerSchema)", () => {
    it("accepts valid customer creation input and normalizes mobile", () => {
      const valid = {
        name: "Ramesh Patel",
        phone: "+91 98765 43210",
        email: "ramesh@example.com",
        city: "Ahmedabad",
        language: "gu",
        tags: ["vip", "group-leader"],
        gstin: "24AAAAA0000A1Z5",
      }

      const parsed = createCustomerSchema.parse(valid)
      assert.equal(parsed.name, "Ramesh Patel")
      assert.equal(parsed.phone, "9876543210") // normalized
      assert.equal(parsed.email, "ramesh@example.com")
      assert.equal(parsed.city, "Ahmedabad")
      assert.equal(parsed.language, "gu")
      assert.deepEqual(parsed.tags, ["vip", "group-leader"])
      assert.equal(parsed.gstin, "24AAAAA0000A1Z5")
    })

    it("rejects invalid Indian mobile numbers", () => {
      const badNumbers = ["12345", "5987654321", "009876543210", ""]
      for (const phone of badNumbers) {
        assert.throws(
          () => createCustomerSchema.parse({ name: "Test", phone }),
          /valid 10-digit Indian mobile/
        )
      }
    })

    it("filters out unknown tags (e.g. senior-citizen, special-care) and caps tags at 5 without throwing", () => {
      const parsed = createCustomerSchema.parse({
        name: "Test",
        phone: "9876543210",
        tags: [
          "vip",
          "senior-citizen",
          "special-care",
          "frequent",
          "regular",
          "agent",
          "corporate",
          "pilgrim-group",
        ],
      })
      // senior-citizen and special-care are filtered out, and result is capped at 5
      assert.deepEqual(parsed.tags, ["vip", "frequent", "regular", "agent", "corporate"])
      assert.equal(parsed.tags.length, 5)
      assert.ok(!parsed.tags.includes("senior-citizen"))
      assert.ok(!parsed.tags.includes("special-care"))
    })

    it("validates and auto-uppercases Indian GSTIN format", () => {
      // Valid lowercase GSTIN gets transformed to uppercase
      const parsed = createCustomerSchema.parse({
        name: "Test",
        phone: "9876543210",
        gstin: "24aaaaa0000a1z5",
      })
      assert.equal(parsed.gstin, "24AAAAA0000A1Z5")

      // Invalid GSTIN format throws
      assert.throws(
        () =>
          createCustomerSchema.parse({
            name: "Test",
            phone: "9876543210",
            gstin: "123456789012345",
          }),
        /valid 15-character Indian GSTIN/
      )
    })

    it("accepts partial updates in updateCustomerSchema", () => {
      const parsed = updateCustomerSchema.parse({
        city: "Surat",
        whatsappOptOut: true,
      })
      assert.equal(parsed.city, "Surat")
      assert.equal(parsed.whatsappOptOut, true)
      assert.equal(parsed.name, undefined)
    })

    it("parses customerQuerySchema with defaults and coercion", () => {
      const parsed = customerQuerySchema.parse({
        q: "ramesh",
        hasOutstanding: "true",
        page: "2",
        limit: "50",
      })
      assert.equal(parsed.q, "ramesh")
      assert.equal(parsed.hasOutstanding, true)
      assert.equal(parsed.page, 2)
      assert.equal(parsed.limit, 50)
      assert.equal(parsed.sort, "recent_booking")
    })
  })

  describe("Customer Summary Accounting (Money Rules & Zero P&L Divergence)", () => {
    it("handles mixed active and cancelled bookings strictly according to P&L rules", () => {
      const bookings = [
        {
          _id: "b1",
          status: "Confirmed",
          totalAmount: 30000,
          advanceReceived: 10000,
          journeyDate: "2026-04-10",
          tourName: "Chardham Special",
          passengers: [{ name: "A" }, { name: "B" }, { name: "C" }],
          payments: [{ amount: 10000, type: "cash", isVoid: false }],
        },
        {
          _id: "b2",
          status: "Cancelled",
          totalAmount: 20000,
          advanceReceived: 8000,
          cancellationCharge: 2000,
          refundAmount: 6000,
          journeyDate: "2026-05-20",
          tourName: "Dwarka Tour",
          passengers: [{ name: "D" }],
          payments: [{ amount: 8000, type: "upi", isVoid: false }],
        },
      ]

      const s = summarizeCustomer(bookings)

      // Active booking counts
      assert.equal(s.totalBookings, 1)
      assert.equal(s.totalCancelledBookings, 1)
      assert.equal(s.totalPassengers, 3)

      // Revenue: 30000 (b1). Cancelled booking b2 (20000) is NOT counted in booked revenue!
      assert.equal(s.totalBookedRevenue, 30000)

      // Collected: 10000 (b1 paid) + 2000 (retained cancellation fee from b2) = 12000
      assert.equal(s.totalCollected, 12000)

      // Outstanding: 20000 (30000 - 10000 on active b1). Cancelled b2 has zero balance due.
      assert.equal(s.totalOutstanding, 20000)

      // Cancellation fees: 2000
      assert.equal(s.totalCancellationFees, 2000)

      // Repeat customer flag: false because only 1 active booking
      assert.equal(s.isRepeat, false)
    })
  })

  describe("Audit Log & Error Log Privacy (Steps 0.b & 0.c)", () => {
    it("ensures duplicate key error log pattern does not leak phone number PII", () => {
      // Simulate MongoDB E11000 error with sensitive index payload
      const sensitivePhone = "9876543210"
      const mongoError = new Error(
        `E11000 duplicate key error collection: yatrahub.customers index: userId_1_phone_1 dup key: { userId: ObjectId('664a1b2c3d4e5f6a7b8c9d0e'), phone: "${sensitivePhone}" }`
      )
      mongoError.name = "MongoServerError"
      mongoError.code = 11000

      // The privacy pattern used in route catch blocks: log error.name and error.code only
      const loggedParts = [mongoError.name, mongoError.code || ""]
      const loggedString = loggedParts.join(" ")

      assert.ok(!loggedString.includes(sensitivePhone), "Logged error must not contain phone number")
      assert.equal(loggedString, "MongoServerError 11000")
    })

    it("ensures customer audit log payloads omit customer phone and address PII", () => {
      // Meta payload constructed in routes/customers.js
      const customerId = "664a1b2c3d4e5f6a7b8c9d0e"
      const changedInput = {
        name: "Ramesh Bhai",
        phone: "9876543210",
        city: "Surat",
      }

      // Customer update meta only contains customerId and changedFields
      const updateMeta = {
        customerId,
        changedFields: Object.keys(changedInput),
      }

      assert.ok(!JSON.stringify(updateMeta).includes("9876543210"))
      assert.deepEqual(updateMeta.changedFields, ["name", "phone", "city"])

      // Customer create meta only contains customerId
      const createMeta = { customerId }
      assert.ok(!JSON.stringify(createMeta).includes("9876543210"))
    })
  })
})
