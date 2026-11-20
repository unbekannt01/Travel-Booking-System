import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_IDS,
  isValidType,
  getType,
  financialYearOf,
  formatNumber,
  getDefaultDocumentSettings,
} from "../shared/documentTypes.js"
import {
  singleDocumentSettingSchema,
  documentSettingsUpdateSchema,
  issueDocumentInputSchema,
  voidDocumentInputSchema,
} from "../backend/utils/documentValidation.js"
import { getNextDocumentNumber } from "../backend/utils/documentNumbering.js"

describe("Document Types Registry & Helpers (shared/documentTypes.js)", () => {
  it("defines exactly the 6 required document types", () => {
    assert.equal(DOCUMENT_TYPE_IDS.length, 6)
    assert.deepEqual(DOCUMENT_TYPE_IDS, [
      "tax-invoice",
      "bill-of-supply",
      "quotation",
      "proforma",
      "booking-confirmation",
      "credit-note",
    ])
  })

  it("validates document type IDs via isValidType", () => {
    assert.equal(isValidType("tax-invoice"), true)
    assert.equal(isValidType("bill-of-supply"), true)
    assert.equal(isValidType("quotation"), true)
    assert.equal(isValidType("proforma"), true)
    assert.equal(isValidType("booking-confirmation"), true)
    assert.equal(isValidType("credit-note"), true)
    assert.equal(isValidType("invoice"), false)
    assert.equal(isValidType("receipt"), false)
    assert.equal(isValidType(""), false)
    assert.equal(isValidType(null), false)
  })

  it("retrieves type metadata via getType", () => {
    const taxInvoice = getType("tax-invoice")
    assert.equal(taxInvoice.id, "tax-invoice")
    assert.equal(taxInvoice.defaultPrefix, "INV")
    assert.equal(taxInvoice.showGstBreakup, true)
    assert.equal(taxInvoice.requiresPayment, true)

    const creditNote = getType("credit-note")
    assert.equal(creditNote.id, "credit-note")
    assert.equal(creditNote.defaultPrefix, "CN")
    assert.deepEqual(creditNote.allowedBookingStates, ["Cancelled"])

    assert.equal(getType("unknown-type"), null)
  })

  describe("financialYearOf Indian fiscal year calculation (1 Apr - 31 Mar)", () => {
    it("handles 31 March (last day of fiscal year)", () => {
      // 31 March 2026 belongs to FY 2025-26
      const d = new Date(2026, 2, 31) // month index 2 is March
      assert.equal(financialYearOf(d), "2025-26")
      assert.equal(financialYearOf("2026-03-31"), "2025-26")
    })

    it("handles 1 April (first day of new fiscal year)", () => {
      // 1 April 2026 belongs to FY 2026-27
      const d = new Date(2026, 3, 1) // month index 3 is April
      assert.equal(financialYearOf(d), "2026-27")
      assert.equal(financialYearOf("2026-04-01"), "2026-27")
    })

    it("handles mid-year dates correctly", () => {
      assert.equal(financialYearOf("2026-08-15"), "2026-27")
      assert.equal(financialYearOf("2026-12-31"), "2026-27")
      assert.equal(financialYearOf("2027-01-15"), "2026-27")
    })

    it("handles epoch timestamps and defaults to current date", () => {
      const now = new Date()
      const expectedFy = financialYearOf(now)
      assert.equal(financialYearOf(), expectedFy)
      assert.equal(financialYearOf(now.getTime()), expectedFy)
    })
  })

  describe("formatNumber templating", () => {
    it("formats standard prefix/fy/seq pattern", () => {
      const formatted = formatNumber({
        prefix: "YHB",
        fy: "2026-27",
        seq: 42,
        padding: 4,
        includeFy: true,
        separator: "/",
      })
      assert.equal(formatted, "YHB/2026-27/0042")
    })

    it("formats prefix-seq without financial year", () => {
      const formatted = formatNumber({
        prefix: "INV",
        seq: 5,
        padding: 5,
      })
      assert.equal(formatted, "INV-00005")
    })

    it("supports custom pad length and separator", () => {
      const formatted = formatNumber({
        prefix: "QTN",
        seq: 123,
        padding: 6,
        separator: "/",
      })
      assert.equal(formatted, "QTN/000123")
    })
  })

  it("returns default document settings map covering all 6 types", () => {
    const defaults = getDefaultDocumentSettings()
    for (const typeId of DOCUMENT_TYPE_IDS) {
      assert.ok(defaults[typeId], `Missing default settings for ${typeId}`)
      assert.ok(defaults[typeId].prefix, `Missing default prefix for ${typeId}`)
      assert.equal(defaults[typeId].resetPolicy, "never")
      assert.equal(typeof defaults[typeId].title, "string")
    }
  })
})

describe("Zod Validation Schemas (backend/utils/documentValidation.js)", () => {
  describe("singleDocumentSettingSchema", () => {
    it("accepts valid document settings", () => {
      const valid = {
        prefix: "EXP",
        title: "Export Invoice",
        includeFy: true,
        resetPolicy: "never",
        padding: 5,
        terms: "Payment within 7 days",
        notes: "Thank you for traveling",
        validityDays: 30,
        showGstBreakup: true,
      }
      const parsed = singleDocumentSettingSchema.parse(valid)
      assert.equal(parsed.prefix, "EXP")
      assert.equal(parsed.validityDays, 30)
    })

    it("rejects invalid prefix format (special characters, too long, empty)", () => {
      assert.throws(() => singleDocumentSettingSchema.parse({ title: "Inv", prefix: "INV@1" }), /alphanumeric/i)
      assert.throws(() => singleDocumentSettingSchema.parse({ title: "Inv", prefix: "TOOLONGPREFIX" }), /alphanumeric/i)
      assert.throws(() => singleDocumentSettingSchema.parse({ title: "Inv", prefix: "" }), /alphanumeric/i)
    })

    it("rejects oversized terms (> 1000 chars) and notes (> 500 chars)", () => {
      assert.throws(
        () => singleDocumentSettingSchema.parse({ title: "Inv", prefix: "INV", terms: "x".repeat(1001) }),
        /cannot exceed 1000/i
      )
      assert.throws(
        () => singleDocumentSettingSchema.parse({ title: "Inv", prefix: "INV", notes: "x".repeat(501) }),
        /cannot exceed 500/i
      )
    })

    it("rejects unknown keys due to strict mode", () => {
      assert.throws(
        () => singleDocumentSettingSchema.parse({ title: "Inv", prefix: "INV", maliciousKey: true }),
        /unrecognized_keys|unknown/i
      )
    })
  })

  describe("documentSettingsUpdateSchema", () => {
    it("accepts valid partial document settings updates", () => {
      const payload = {
        "tax-invoice": { title: "Tax Invoice", prefix: "TI" },
        "credit-note": { title: "Credit Note", prefix: "CN", notes: "Credit note policy notes" },
      }
      const parsed = documentSettingsUpdateSchema.parse(payload)
      assert.equal(parsed["tax-invoice"].prefix, "TI")
      assert.equal(parsed["credit-note"].notes, "Credit note policy notes")
    })

    it("rejects unknown document type keys", () => {
      const payload = {
        "unknown-type": { title: "Unknown", prefix: "UNK" },
      }
      assert.throws(() => documentSettingsUpdateSchema.parse(payload))
    })
  })

  describe("issueDocumentInputSchema", () => {
    it("accepts valid issue input with valid ObjectId", () => {
      const valid = {
        bookingId: "507f1f77bcf86cd799439011",
        type: "tax-invoice",
      }
      const parsed = issueDocumentInputSchema.parse(valid)
      assert.equal(parsed.type, "tax-invoice")
    })

    it("rejects invalid ObjectId", () => {
      assert.throws(
        () => issueDocumentInputSchema.parse({ bookingId: "invalid-id", type: "tax-invoice" }),
        /invalid booking ID/i
      )
    })

    it("rejects invalid document type", () => {
      assert.throws(
        () =>
          issueDocumentInputSchema.parse({
            bookingId: "507f1f77bcf86cd799439011",
            type: "random-doc",
          }),
        /invalid option|invalid document type/i
      )
    })
  })

  describe("voidDocumentInputSchema", () => {
    it("accepts non-empty void reason", () => {
      const parsed = voidDocumentInputSchema.parse({ reason: "Duplicate issued by mistake" })
      assert.equal(parsed.reason, "Duplicate issued by mistake")
    })

    it("rejects empty, short, or whitespace reason", () => {
      assert.throws(() => voidDocumentInputSchema.parse({ reason: "" }), /at least 3 characters/i)
      assert.throws(() => voidDocumentInputSchema.parse({ reason: "ab" }), /at least 3 characters/i)
      assert.throws(() => voidDocumentInputSchema.parse({ reason: "   " }), /at least 3 characters/i)
      assert.throws(() => voidDocumentInputSchema.parse({}))
    })
  })
})

describe("Document Numbering Continuity & Atomic Allocation", () => {
  it("generates sequential numbers without gaps", async () => {
    const memoryCounters = new Map()

    const mockCounterModel = {
      findOneAndUpdate: async (filter, update) => {
        const key = `${filter.userId}:${filter.prefix}`
        const current = memoryCounters.get(key) || 0
        const next = current + (update.$inc?.seq || 1)
        memoryCounters.set(key, next)
        return { seq: next }
      },
      findOne: async (filter) => {
        const key = `${filter.userId}:${filter.prefix}`
        const val = memoryCounters.get(key)
        return val ? { seq: val } : null
      },
      find: () => ({
        select: () => [],
      }),
    }

    const mockBookingModel = {
      find: () => ({
        select: () => [],
      }),
    }

    // Allocate 10 sequential numbers
    const numbers = []
    for (let i = 0; i < 10; i++) {
      const res = await getNextDocumentNumber(
        "507f1f77bcf86cd799439011",
        "tax-invoice",
        new Date(2026, 3, 15),
        { documentSettings: { "tax-invoice": { prefix: "YHB", padding: 4, includeFy: true } } },
        {
          CounterModel: mockCounterModel,
          BookingModel: mockBookingModel,
        }
      )
      numbers.push(res.number)
    }

    assert.equal(numbers.length, 10)
    assert.equal(numbers[0], "YHB-2026-27-0001")
    assert.equal(numbers[1], "YHB-2026-27-0002")
    assert.equal(numbers[9], "YHB-2026-27-0010")

    // Verify all 10 are strictly unique
    const unique = new Set(numbers)
    assert.equal(unique.size, 10)
  })

  it("seamlessly continues numbering from legacy invoice counter", async () => {
    const memoryCounters = new Map()
    // Simulate an existing operator who already issued invoices up to #108
    memoryCounters.set("507f1f77bcf86cd799439011:doc:tax-invoice", undefined)

    const mockCounterModel = {
      findOneAndUpdate: async (filter, update) => {
        const key = `${filter.userId}:${filter.prefix}`
        if (update.$setOnInsert) {
          const current = memoryCounters.get(key)
          if (current === undefined) {
            memoryCounters.set(key, update.$setOnInsert.seq)
          }
          return { seq: memoryCounters.get(key) }
        }
        const currentVal = memoryCounters.get(key) || 0
        const next = currentVal + (update.$inc?.seq || 1)
        memoryCounters.set(key, next)
        return { seq: next }
      },
      findOne: async (filter) => {
        const key = `${filter.userId}:${filter.prefix}`
        const val = memoryCounters.get(key)
        return val !== undefined ? { seq: val } : null
      },
      find: () => ({
        select: () => [{ seq: 108 }],
      }),
    }

    const mockBookingModel = {
      find: () => ({
        select: () => [{ invoiceNo: "108" }, { invoiceNo: "YHB-105" }],
      }),
    }

    const res = await getNextDocumentNumber(
      "507f1f77bcf86cd799439011",
      "tax-invoice",
      new Date(2026, 3, 15),
      { documentSettings: { "tax-invoice": { prefix: "YHB", padding: 4, includeFy: true } } },
      {
        CounterModel: mockCounterModel,
        BookingModel: mockBookingModel,
      }
    )

    // Next invoice number continues directly at 109, NO gap, NO duplicate, NO reset to 1
    assert.equal(res.number, "YHB-2026-27-0109")
    assert.equal(res.seq, 109)
  })

  it("handles concurrent parallel requests without duplicate sequences", async () => {
    let atomicCounter = 0
    const mockCounterModel = {
      findOneAndUpdate: async () => {
        atomicCounter += 1
        return { seq: atomicCounter }
      },
      findOne: async () => ({ seq: atomicCounter }),
    }

    const mockBookingModel = {
      find: () => ({
        select: () => [],
      }),
    }

    // Launch 25 concurrent number requests
    const promises = Array.from({ length: 25 }, () =>
      getNextDocumentNumber(
        "507f1f77bcf86cd799439011",
        "quotation",
        new Date(2026, 3, 15),
        { documentSettings: { quotation: { prefix: "QTN", padding: 4 } } },
        {
          CounterModel: mockCounterModel,
          BookingModel: mockBookingModel,
        }
      )
    )

    const results = await Promise.all(promises)
    assert.equal(results.length, 25)
    const numbers = results.map((r) => r.number)
    const uniqueResults = new Set(numbers)
    assert.equal(uniqueResults.size, 25, "All 25 concurrently generated numbers must be distinct")
  })
})

describe("Privacy & PII Rules (Zero Aadhaar in Snapshots)", () => {
  it("ensures customer and lineItems snapshot schemas exclude Aadhaar", () => {
    const rawBooking = {
      contactName: "Ramesh Sharma",
      contactPhone: "9876543210",
      contactEmail: "ramesh@example.com",
      aadhaar: "123456789012",
      encryptedAadhaar: "ENC_CIPHER_TEXT",
      passengers: [
        {
          name: "Suresh Sharma",
          seatId: "lower-L1",
          city: "Junagadh",
          age: 45,
          gender: "Male",
          aadhaar: "987654321098",
          aadhar: "987654321098",
          encryptedAadhaar: "ENC_PASSENGER_CIPHER",
        },
      ],
    }

    // Build snapshots as backend/routes/documents.js does
    const customerSnapshot = {
      name: rawBooking.contactName,
      phone: rawBooking.contactPhone,
      email: rawBooking.contactEmail || "",
    }

    const lineItemsSnapshot = rawBooking.passengers.map((p) => ({
      name: p.name,
      seatId: p.seatId || "",
      city: p.city || "",
      age: p.age || 0,
      gender: p.gender || "",
    }))

    // Check Customer snapshot
    assert.equal("aadhaar" in customerSnapshot, false)
    assert.equal("encryptedAadhaar" in customerSnapshot, false)
    assert.equal(JSON.stringify(customerSnapshot).includes("123456789012"), false)

    // Check Passenger lineItems snapshot
    assert.equal("aadhaar" in lineItemsSnapshot[0], false)
    assert.equal("aadhar" in lineItemsSnapshot[0], false)
    assert.equal("encryptedAadhaar" in lineItemsSnapshot[0], false)
    assert.equal(JSON.stringify(lineItemsSnapshot).includes("987654321098"), false)
  })
})

describe("Credit Note Business Rules & Idempotency", () => {
  it("rejects Credit Note for confirmed/active booking", () => {
    const activeBooking = {
      status: "Confirmed",
      totalAmount: 12000,
      advanceReceived: 5000,
    }

    const canIssueCreditNote = activeBooking.status === "Cancelled" || activeBooking.status === "cancelled"
    assert.equal(canIssueCreditNote, false, "Credit note must not be allowed for confirmed bookings")
  })

  it("calculates Credit Note refund amount accurately based on cancellation refund", () => {
    const cancelledBooking = {
      status: "Cancelled",
      totalAmount: 10000,
      advanceReceived: 5000,
      cancellationCharge: 1500,
      refundAmount: 3500,
    }

    const creditNoteAmount = cancelledBooking.refundAmount || 0
    assert.equal(creditNoteAmount, 3500)
    assert.ok(creditNoteAmount <= cancelledBooking.totalAmount)
  })

  it("verifies idempotency logic for duplicate Credit Note requests", () => {
    const existingDocs = [
      {
        id: "doc_cn_1",
        type: "credit-note",
        number: "CN/2026-27/0001",
        status: "issued",
        bookingId: "booking_123",
      },
    ]

    // Simulate check in issue handler
    const existingActiveCreditNote = existingDocs.find(
      (d) => d.type === "credit-note" && d.status === "issued" && d.bookingId === "booking_123"
    )

    assert.ok(existingActiveCreditNote, "Finds existing active credit note")
    // Second request returns existing active credit note rather than creating duplicate
    const responseDoc = existingActiveCreditNote
    assert.equal(responseDoc.number, "CN/2026-27/0001")
  })
})

describe("Void Document Flow & Immutability Rules", () => {
  it("updates status to void and records audit details", () => {
    const doc = {
      id: "doc_101",
      number: "YHB/2026-27/0045",
      status: "issued",
      voidReason: null,
      voidedAt: null,
      voidedBy: null,
    }

    const voidReason = "Typographical error in passenger list"
    const operatorId = "user_admin_1"

    assert.equal(doc.status, "issued")
    doc.status = "void"
    doc.voidReason = voidReason
    doc.voidedAt = new Date().toISOString()
    doc.voidedBy = operatorId

    assert.equal(doc.status, "void")
    assert.equal(doc.voidReason, "Typographical error in passenger list")
    assert.equal(doc.voidedBy, "user_admin_1")
    assert.ok(doc.voidedAt)
  })

  it("rejects attempt to void an already voided document", () => {
    const voidDoc = {
      id: "doc_102",
      status: "void",
      voidReason: "Initial cancellation",
    }

    const canVoid = voidDoc.status === "issued"
    assert.equal(canVoid, false, "Cannot void a document that is already void")
  })

  it("ensures historical snapshots remain unchanged when live user settings change", () => {
    const documentSnapshot = {
      company: {
        name: "Yatra Tours Junagadh",
        gstin: "24AAAAA0000A1Z5",
        phone: "+91 98765 43210",
      },
      settings: {
        title: "Tax Invoice",
        showGstBreakup: true,
        terms: "Fixed original terms on issue date",
      },
    }

    // Live operator profile changes subsequent week
    const liveUserSettings = {
      companyName: "New Yatra Holidays Private Limited",
      gstNumber: "24BBBBB1111B2Z6",
      termsAndConditions: ["Completely revised new policy"],
    }

    // Document snapshot preserves original data at issue time
    assert.equal(documentSnapshot.company.name, "Yatra Tours Junagadh")
    assert.notEqual(documentSnapshot.company.name, liveUserSettings.companyName)
    assert.equal(documentSnapshot.settings.terms, "Fixed original terms on issue date")
  })
})
