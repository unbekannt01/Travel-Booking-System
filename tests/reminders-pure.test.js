import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  REMINDER_TONES,
  REMINDER_LANGUAGES,
  REMINDER_PLACEHOLDERS,
  DEFAULT_REMINDER_TEMPLATES,
  validateTemplate,
  sanitizeValue,
  formatRupees,
  formatDisplayDate,
  renderReminder,
  buildWhatsAppUrl,
  suggestTone,
} from "../shared/reminders.js"

describe("Reminder Pure Logic & Template Engine (Part 5c)", () => {
  test("REMINDER_TONES, REMINDER_LANGUAGES, REMINDER_PLACEHOLDERS are frozen arrays", () => {
    assert.ok(Object.isFrozen(REMINDER_TONES))
    assert.deepEqual([...REMINDER_TONES], ["friendly", "due-soon", "overdue"])

    assert.ok(Object.isFrozen(REMINDER_LANGUAGES))
    assert.deepEqual([...REMINDER_LANGUAGES], ["en", "hi", "gu"])

    assert.ok(Object.isFrozen(REMINDER_PLACEHOLDERS))
    assert.ok(REMINDER_PLACEHOLDERS.includes("customerName"))
    assert.ok(REMINDER_PLACEHOLDERS.includes("balance"))
    assert.ok(REMINDER_PLACEHOLDERS.includes("upiId"))
  })

  test("DEFAULT_REMINDER_TEMPLATES contains 9 valid templates under 600 characters", () => {
    let count = 0
    for (const lang of REMINDER_LANGUAGES) {
      assert.ok(DEFAULT_REMINDER_TEMPLATES[lang], `Missing templates for ${lang}`)
      for (const tone of REMINDER_TONES) {
        const tmpl = DEFAULT_REMINDER_TEMPLATES[lang][tone]
        assert.ok(tmpl, `Missing template for ${lang} - ${tone}`)
        assert.ok(tmpl.length <= 600, `Template ${lang}-${tone} exceeds 600 characters (${tmpl.length})`)
        const validation = validateTemplate(tmpl)
        assert.equal(validation.valid, true, `Validation failed for ${lang}-${tone}: ${validation.errors.join(", ")}`)
        count++
      }
    }
    assert.equal(count, 9)
  })

  test("validateTemplate detects errors and returns machine-readable error codes", () => {
    // Empty template
    assert.deepEqual(validateTemplate(""), { valid: false, errors: ["EMPTY_TEMPLATE"] })
    assert.deepEqual(validateTemplate("   "), { valid: false, errors: ["EMPTY_TEMPLATE"] })
    assert.deepEqual(validateTemplate(null), { valid: false, errors: ["EMPTY_TEMPLATE"] })

    // Too long (> 600 chars)
    const longText = "a".repeat(601)
    const longRes = validateTemplate(longText)
    assert.equal(longRes.valid, false)
    assert.ok(longRes.errors.includes("TEMPLATE_TOO_LONG"))

    // Control characters
    const ctrlRes = validateTemplate("Hello\x00World {customerName}")
    assert.equal(ctrlRes.valid, false)
    assert.ok(ctrlRes.errors.includes("CONTROL_CHARACTERS"))

    // Unbalanced braces
    assert.ok(validateTemplate("Dear {customerName, your balance").errors.includes("UNBALANCED_BRACES"))
    assert.ok(validateTemplate("Dear customerName}, your balance").errors.includes("UNBALANCED_BRACES"))
    assert.ok(validateTemplate("Dear {{customerName}}").errors.includes("UNBALANCED_BRACES"))

    // Unknown placeholders
    const unknownRes = validateTemplate("Dear {customerName}, your {discount} is {amount}")
    assert.equal(unknownRes.valid, false)
    assert.ok(unknownRes.errors.includes("UNKNOWN_PLACEHOLDER:discount"))
    assert.ok(unknownRes.errors.includes("UNKNOWN_PLACEHOLDER:amount"))

    // Valid template
    const validRes = validateTemplate("Hello {customerName}, payment of {balance} is due.")
    assert.equal(validRes.valid, true)
    assert.equal(validRes.errors.length, 0)
  })

  test("sanitizeValue strips control, bidi overrides, zero-width chars and truncates to 120 chars", () => {
    assert.equal(sanitizeValue(null), "")
    assert.equal(sanitizeValue(undefined), "")
    assert.equal(sanitizeValue(12345), "12345")

    // Control characters stripped
    assert.equal(sanitizeValue("Hello\x07\x00World\x1F!"), "HelloWorld!")

    // Bidirectional override characters (U+202A to U+202E, U+2066 to U+2069) stripped
    const bidiText = "Ramesh \u202A\u202BPatel\u202C\u202E \u2066Tours\u2069"
    assert.equal(sanitizeValue(bidiText), "Ramesh Patel Tours")

    // Zero-width characters (U+200B, U+200C, U+200D, U+FEFF) stripped
    const zeroWidthText = "Surat\u200B \uFEFFGujarat\u200C"
    assert.equal(sanitizeValue(zeroWidthText), "Surat Gujarat")

    // Whitespace collapsed and trimmed
    assert.equal(sanitizeValue("   Lots    of    spaces   "), "Lots of spaces")

    // Truncates to 120 chars
    const overlyLong = "X".repeat(200)
    const sanitizedLong = sanitizeValue(overlyLong)
    assert.equal(sanitizedLong.length, 120)
  })

  test("formatRupees formats amounts with Indian digit grouping and currency symbol", () => {
    assert.equal(formatRupees(0), "₹0")
    assert.equal(formatRupees(500), "₹500")
    assert.equal(formatRupees(1200), "₹1,200")
    assert.equal(formatRupees(12000), "₹12,000")
    assert.equal(formatRupees(123456), "₹1,23,456")
    assert.equal(formatRupees(10000000), "₹1,00,00,000")
    assert.equal(formatRupees(-5000), "-₹5,000")
    assert.equal(formatRupees(null), "₹0")
    assert.equal(formatRupees("invalid"), "₹0")
  })

  test("formatDisplayDate formats ISO dates to DD-MM-YYYY", () => {
    assert.equal(formatDisplayDate("2026-05-15"), "15-05-2026")
    assert.equal(formatDisplayDate("2026-11-23T12:00:00Z"), "23-11-2026")
    assert.equal(formatDisplayDate("15-05-2026"), "15-05-2026")
    assert.equal(formatDisplayDate(null), "")
    assert.equal(formatDisplayDate(""), "")
  })

  test("renderReminder substitutes placeholders, formats currency & dates, and omits empty UPI line", () => {
    const fullValues = {
      customerName: "Ramesh Patel",
      companyName: "Shiv Kripa Travels",
      companyPhone: "9876543210",
      tourName: "Chardham Special",
      journeyDate: "2026-05-15",
      invoiceNo: "INV-2026-001",
      balance: 15000,
      totalAmount: 25000,
      paidAmount: 10000,
      daysOverdue: 12,
      upiId: "operator@okhdfcbank",
    }

    // Render English friendly with UPI
    const enFriendlyWithUpi = renderReminder({
      template: DEFAULT_REMINDER_TEMPLATES.en.friendly,
      values: fullValues,
    })
    assert.ok(enFriendlyWithUpi.includes("Ramesh Patel"))
    assert.ok(enFriendlyWithUpi.includes("Shiv Kripa Travels"))
    assert.ok(enFriendlyWithUpi.includes("Chardham Special"))
    assert.ok(enFriendlyWithUpi.includes("15-05-2026"))
    assert.ok(enFriendlyWithUpi.includes("#INV-2026-001"))
    assert.ok(enFriendlyWithUpi.includes("₹15,000"))
    assert.ok(enFriendlyWithUpi.includes("₹25,000"))
    assert.ok(enFriendlyWithUpi.includes("₹10,000"))
    assert.ok(enFriendlyWithUpi.includes("operator@okhdfcbank"))
    assert.ok(!enFriendlyWithUpi.includes("{"))
    assert.ok(!enFriendlyWithUpi.includes("undefined"))

    // Render English friendly WITHOUT UPI
    const enFriendlyNoUpi = renderReminder({
      template: DEFAULT_REMINDER_TEMPLATES.en.friendly,
      values: { ...fullValues, upiId: "" },
    })
    assert.ok(!enFriendlyNoUpi.includes("UPI ID"))
    assert.ok(!enFriendlyNoUpi.includes("For UPI payments"))
    assert.ok(!enFriendlyNoUpi.includes("{"))
    assert.ok(enFriendlyNoUpi.includes("For assistance, contact 9876543210"))

    // Render Hindi friendly without UPI
    const hiFriendlyNoUpi = renderReminder({
      template: DEFAULT_REMINDER_TEMPLATES.hi.friendly,
      values: { ...fullValues, upiId: "" },
    })
    assert.ok(!hiFriendlyNoUpi.includes("UPI ID"))
    assert.ok(!hiFriendlyNoUpi.includes("UPI भुगतान"))
    assert.ok(!hiFriendlyNoUpi.includes("{"))
    assert.ok(hiFriendlyNoUpi.includes("₹15,000"))

    // Render Gujarati friendly without UPI
    const guFriendlyNoUpi = renderReminder({
      template: DEFAULT_REMINDER_TEMPLATES.gu.friendly,
      values: { ...fullValues, upiId: "" },
    })
    assert.ok(!guFriendlyNoUpi.includes("UPI ID"))
    assert.ok(!guFriendlyNoUpi.includes("UPI ચુકવણી"))
    assert.ok(!guFriendlyNoUpi.includes("{"))
    assert.ok(guFriendlyNoUpi.includes("₹15,000"))
  })

  test("renderReminder renders all 9 default templates with zero left-over braces, undefined or NaN", () => {
    const testValues = {
      customerName: "Jayesh Mehta",
      companyName: "Somnath Yatra",
      companyPhone: "9825012345",
      tourName: "Dwarka Darshan",
      journeyDate: "2026-06-10",
      invoiceNo: "DWA-102",
      balance: 8500,
      totalAmount: 18500,
      paidAmount: 10000,
      daysOverdue: 5,
      upiId: "somnath@upi",
    }

    for (const lang of REMINDER_LANGUAGES) {
      for (const tone of REMINDER_TONES) {
        // With UPI
        const renderedWithUpi = renderReminder({
          template: DEFAULT_REMINDER_TEMPLATES[lang][tone],
          values: testValues,
        })
        assert.ok(!renderedWithUpi.includes("{"), `Found { in ${lang}-${tone}`)
        assert.ok(!renderedWithUpi.includes("}"), `Found } in ${lang}-${tone}`)
        assert.ok(!renderedWithUpi.includes("undefined"), `Found undefined in ${lang}-${tone}`)
        assert.ok(!renderedWithUpi.includes("NaN"), `Found NaN in ${lang}-${tone}`)
        assert.ok(renderedWithUpi.length <= 900, `Rendered ${lang}-${tone} exceeded 900 chars`)

        // Without UPI
        const renderedNoUpi = renderReminder({
          template: DEFAULT_REMINDER_TEMPLATES[lang][tone],
          values: { ...testValues, upiId: "" },
        })
        assert.ok(!renderedNoUpi.includes("{"), `Found { in ${lang}-${tone} (no UPI)`)
        assert.ok(!renderedNoUpi.includes("}"), `Found } in ${lang}-${tone} (no UPI)`)
        assert.ok(!renderedNoUpi.includes("undefined"), `Found undefined in ${lang}-${tone} (no UPI)`)
        assert.ok(!renderedNoUpi.includes("NaN"), `Found NaN in ${lang}-${tone} (no UPI)`)
        assert.ok(renderedNoUpi.length <= 900, `Rendered ${lang}-${tone} (no UPI) exceeded 900 chars`)
      }
    }
  })

  test("buildWhatsAppUrl generates valid wa.me URL and rejects invalid phone or empty text", () => {
    const validText = "Hello from YatraHub! 🙏 Total is ₹12,000"

    // Raw 10 digits
    const url1 = buildWhatsAppUrl("9876543210", validText)
    assert.equal(url1, `https://wa.me/919876543210?text=${encodeURIComponent(validText)}`)

    // With +91 prefix and spaces
    const url2 = buildWhatsAppUrl("+91 98765 43210", validText)
    assert.equal(url2, `https://wa.me/919876543210?text=${encodeURIComponent(validText)}`)

    // With 0 prefix
    const url3 = buildWhatsAppUrl("09876543210", validText)
    assert.equal(url3, `https://wa.me/919876543210?text=${encodeURIComponent(validText)}`)

    // Invalid phone numbers return null
    assert.equal(buildWhatsAppUrl("12345", validText), null)
    assert.equal(buildWhatsAppUrl("5555555555", validText), null) // Doesn't start with 6-9
    assert.equal(buildWhatsAppUrl("invalid", validText), null)
    assert.equal(buildWhatsAppUrl(null, validText), null)

    // Empty text returns null
    assert.equal(buildWhatsAppUrl("9876543210", ""), null)
    assert.equal(buildWhatsAppUrl("9876543210", "   "), null)
    assert.equal(buildWhatsAppUrl("9876543210", null), null)

    // Properly encodes newlines, Hindi, Gujarati, ₹, and emoji
    const multilingualText = "Line 1\nLine 2\nनमस्ते\nનમસ્તે\n₹15,000\n🙏"
    const mlUrl = buildWhatsAppUrl("9876543210", multilingualText)
    assert.ok(mlUrl.includes("919876543210"))
    assert.ok(mlUrl.includes("%0A")) // newline encoded
    assert.ok(mlUrl.includes(encodeURIComponent("नमस्ते")))
    assert.ok(mlUrl.includes(encodeURIComponent("નમસ્તે")))
    assert.ok(mlUrl.includes(encodeURIComponent("₹15,000")))
    assert.ok(mlUrl.includes(encodeURIComponent("🙏")))
  })

  test("suggestTone picks overdue, due-soon, or friendly accurately", () => {
    // Overdue takes precedence
    assert.equal(suggestTone({ daysOverdue: 5, daysToJourney: 2 }), "overdue")
    assert.equal(suggestTone({ daysOverdue: 1 }), "overdue")

    // Due-soon when daysToJourney is between 0 and 7
    assert.equal(suggestTone({ daysOverdue: 0, daysToJourney: 0 }), "due-soon")
    assert.equal(suggestTone({ daysOverdue: 0, daysToJourney: 3 }), "due-soon")
    assert.equal(suggestTone({ daysOverdue: 0, daysToJourney: 7 }), "due-soon")

    // Friendly when journey is far away or null
    assert.equal(suggestTone({ daysOverdue: 0, daysToJourney: 8 }), "friendly")
    assert.equal(suggestTone({ daysOverdue: 0, daysToJourney: 30 }), "friendly")
    assert.equal(suggestTone({ daysOverdue: 0, daysToJourney: null }), "friendly")
    assert.equal(suggestTone({}), "friendly")
  })
})
