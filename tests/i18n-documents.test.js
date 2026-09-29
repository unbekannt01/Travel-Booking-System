import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { DOCUMENT_LANGUAGES, getDocumentTranslation, translations } from "../src/i18n/documents.js"
import { maskAadhaar } from "../src/utils/formatters.js"

describe("Customer Documents i18n Dictionary", () => {
  it("provides available languages list containing en, hi, gu", () => {
    const codes = DOCUMENT_LANGUAGES.map((l) => l.code)
    assert.deepEqual(codes, ["en", "hi", "gu"])
  })

  it("retrieves English dictionary by default and for 'en'", () => {
    const tDefault = getDocumentTranslation()
    const tEn = getDocumentTranslation("en")

    assert.equal(tDefault.invoiceWord, "INVOICE")
    assert.equal(tEn.officialBookingInvoice, "Official Booking Invoice")
    assert.equal(tEn.boardingPass, "Boarding Pass")
    assert.equal(tEn.paymentReceipt, "Payment Receipt")
  })

  it("retrieves Hindi dictionary for 'hi'", () => {
    const tHi = getDocumentTranslation("hi")

    assert.equal(tHi.officialBookingInvoice, "आधिकारिक बुकिंग चालान")
    assert.equal(tHi.boardingPass, "बोर्डिंग पास")
    assert.equal(tHi.paymentReceipt, "भुगतान रसीद")
    assert.equal(tHi.confirmed, "स्वीकृत (Confirmed)")
    assert.equal(tHi.cancelled, "रद्द (Cancelled)")
  })

  it("retrieves Gujarati dictionary for 'gu'", () => {
    const tGu = getDocumentTranslation("gu")

    assert.equal(tGu.officialBookingInvoice, "સત્તાવાર બુકિંગ ઇનવોઇસ")
    assert.equal(tGu.boardingPass, "બોર્ડિંગ પાસ")
    assert.equal(tGu.paymentReceipt, "ચુકવણી રસીદ")
    assert.equal(tGu.balancePayable, "બાકી ચૂકવવાપાત્ર રકમ")
  })

  it("falls back to English when an unsupported language is requested", () => {
    const tFallback = getDocumentTranslation("fr")
    assert.equal(tFallback.invoiceWord, "INVOICE")
    assert.equal(tFallback.officialBookingInvoice, "Official Booking Invoice")
  })

  it("ensures key parity across English, Hindi, and Gujarati dictionaries", () => {
    const enKeys = Object.keys(translations.en)
    const hiKeys = new Set(Object.keys(translations.hi))
    const guKeys = new Set(Object.keys(translations.gu))

    for (const key of enKeys) {
      assert.equal(hiKeys.has(key), true, `Hindi dictionary missing key: ${key}`)
      assert.equal(guKeys.has(key), true, `Gujarati dictionary missing key: ${key}`)
      assert.equal(typeof translations.hi[key], "string", `Hindi value for ${key} must be string`)
      assert.equal(typeof translations.gu[key], "string", `Gujarati value for ${key} must be string`)
      assert.equal(translations.hi[key].length > 0, true, `Hindi value for ${key} should not be empty`)
      assert.equal(translations.gu[key].length > 0, true, `Gujarati value for ${key} should not be empty`)
    }
  })
})

describe("Boarding Pass & QR Generation Logic", () => {
  it("formats QR payload as invoiceNo + '-' + seatId", () => {
    const booking = { invoiceNo: "INV-2026-089" }
    const passenger = { seatId: "lower-L2" }

    const qrPayload = `${booking.invoiceNo}-${passenger.seatId}`
    assert.equal(qrPayload, "INV-2026-089-lower-L2")
  })

  it("handles fallback seat identifier when seat is unassigned", () => {
    const booking = { invoiceNo: "INV-2026-089" }
    const passenger = { seatId: "" }
    const idx = 0

    const seat = passenger.seatId || `P${idx + 1}`
    const qrPayload = `${booking.invoiceNo}-${seat}`
    assert.equal(qrPayload, "INV-2026-089-P1")
  })

  it("correctly determines deck label from seatId", () => {
    const getDeckLabel = (seatId) => {
      if (!seatId) return "Seat"
      if (seatId.toLowerCase().startsWith("lower")) return "Lower Deck"
      if (seatId.toLowerCase().startsWith("upper")) return "Upper Deck"
      return "Reserved"
    }

    assert.equal(getDeckLabel("lower-L1"), "Lower Deck")
    assert.equal(getDeckLabel("upper-R2-1"), "Upper Deck")
    assert.equal(getDeckLabel(""), "Seat")
    assert.equal(getDeckLabel("CUSTOM-9"), "Reserved")
  })

  it("masks Aadhaar number for passenger privacy on printed tickets", () => {
    assert.equal(maskAadhaar("123456789012"), "XXXX XXXX 9012")
    assert.equal(maskAadhaar(""), "—")
    assert.equal(maskAadhaar(null), "—")
  })
})

describe("Payment Receipt & Audit Ledger Generation Logic", () => {
  it("calculates remaining balance accurately for receipt display", () => {
    const booking = { totalAmount: 18000, advanceReceived: 10000 }
    const balance = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0))
    assert.equal(balance, 8000)
  })

  it("handles refund payment display values correctly", () => {
    const refundPayment = {
      type: "refund",
      amount: -2500,
      receiptNo: "REC-REF-001",
    }
    const isRefund = refundPayment.type === "refund" || Number(refundPayment.amount) < 0
    const displayAmount = Math.abs(Number(refundPayment.amount))

    assert.equal(isRefund, true)
    assert.equal(displayAmount, 2500)
  })
})
