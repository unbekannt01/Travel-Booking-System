import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  evaluateBookingLinkability,
  UNLINKED_REASON_CODES,
  UNLINKED_REASON_DESCRIPTIONS,
} from "../backend/utils/customerLinker.js"

describe("Customer Linker Pure Unit Tests", () => {
  describe("evaluateBookingLinkability", () => {
    it("returns linkable: true with normalized 10-digit phone", () => {
      const res = evaluateBookingLinkability({
        contactPhone: "9876543210",
        contactName: "Ramesh Patel",
      })
      assert.equal(res.linkable, true)
      assert.equal(res.normalizedPhone, "9876543210")
      assert.equal(res.reasonCode, null)
      assert.equal(res.reasonDescription, null)
    })

    it("normalizes phone with +91 and spaces", () => {
      const res = evaluateBookingLinkability({
        contactPhone: "+91 98765 43210",
        contactName: "Suresh Shah",
      })
      assert.equal(res.linkable, true)
      assert.equal(res.normalizedPhone, "9876543210")
    })

    it("detects missing phone", () => {
      const res = evaluateBookingLinkability({
        contactPhone: "",
        contactName: "No Phone Customer",
      })
      assert.equal(res.linkable, false)
      assert.equal(res.reasonCode, UNLINKED_REASON_CODES.MISSING_PHONE)
      assert.equal(res.reasonDescription, UNLINKED_REASON_DESCRIPTIONS[UNLINKED_REASON_CODES.MISSING_PHONE])
    })

    it("detects missing phone when undefined or null", () => {
      const res = evaluateBookingLinkability({})
      assert.equal(res.linkable, false)
      assert.equal(res.reasonCode, UNLINKED_REASON_CODES.MISSING_PHONE)
    })

    it("detects invalid phone (too short or invalid prefix)", () => {
      const res1 = evaluateBookingLinkability({ contactPhone: "12345" })
      assert.equal(res1.linkable, false)
      assert.equal(res1.reasonCode, UNLINKED_REASON_CODES.INVALID_PHONE)

      const res2 = evaluateBookingLinkability({ contactPhone: "5555555555" })
      assert.equal(res2.linkable, false)
      assert.equal(res2.reasonCode, UNLINKED_REASON_CODES.INVALID_PHONE)
    })
  })
})
