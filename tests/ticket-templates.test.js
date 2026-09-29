import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  TICKET_TEMPLATES,
  getTicketTemplate,
  buildSingleTicketCardHTML,
  buildBatchPrintableTicketsHTML,
} from "../src/components/tickets/ticketRegistry.js"

describe("Ticket Templates Registry & Generator", () => {
  it("provides 6 distinct professional ticket templates", () => {
    assert.equal(TICKET_TEMPLATES.length, 6)
    const ids = TICKET_TEMPLATES.map((t) => t.id)
    assert.deepEqual(ids, ["classic", "modern", "heritage", "corporate", "thermal", "transit"])
  })

  it("retrieves template by ID or falls back to classic", () => {
    const modern = getTicketTemplate("modern")
    assert.equal(modern.id, "modern")
    assert.equal(modern.name, "Modern Minimalist")

    const fallback = getTicketTemplate("non-existent-template")
    assert.equal(fallback.id, "classic")
  })

  it("generates ticket HTML containing all essential booking & passenger information", () => {
    const booking = {
      invoiceNo: "YHB-2026-001",
      tourName: "Char Dham Yatra",
      journeyDate: "2026-10-15",
      contactName: "Ramesh Sharma",
      contactPhone: "9876543210",
      totalAmount: 25000,
      advanceReceived: 10000,
    }
    const pax = {
      name: "Aarav Sharma",
      age: 32,
      gender: "Male",
      city: "Ahmedabad",
      seatId: "lower-L1",
      aadhar: "123456789012",
    }

    TICKET_TEMPLATES.forEach((template) => {
      const html = buildSingleTicketCardHTML({
        templateId: template.id,
        booking,
        pax,
        idx: 0,
        qrUrl: "data:image/png;base64,sampleQR",
        user: { companyName: "Somnath Travels", invoiceColor: "#4f46e5" },
        lang: "en",
      })

      assert.ok(html.includes("YHB-2026-001"), `${template.id} missing invoiceNo`)
      assert.ok(html.includes("Char Dham Yatra"), `${template.id} missing tourName`)
      assert.ok(html.includes("Aarav Sharma"), `${template.id} missing passenger name`)
      assert.ok(html.toUpperCase().includes("SOMNATH TRAVELS"), `${template.id} missing companyName`)
    })
  })

  it("renders multi-lingual translations (hi, gu) into ticket HTML", () => {
    const booking = {
      invoiceNo: "YHB-HI-100",
      tourName: "Kashi Yatra",
      journeyDate: "2026-11-01",
      contactName: "Pooja Patel",
      contactPhone: "9898989898",
      totalAmount: 15000,
      advanceReceived: 15000,
    }
    const pax = { name: "Pooja Patel", seatId: "upper-R1-1" }

    // Hindi
    const hindiHTML = buildSingleTicketCardHTML({
      templateId: "classic",
      booking,
      pax,
      idx: 0,
      lang: "hi",
    })
    assert.ok(hindiHTML.includes("बोर्डिंग पास") || hindiHTML.includes("यात्रा का नाम") || hindiHTML.includes("सीट क्रमांक"))

    // Gujarati
    const gujHTML = buildSingleTicketCardHTML({
      templateId: "classic",
      booking,
      pax,
      idx: 0,
      lang: "gu",
    })
    assert.ok(gujHTML.includes("બોર્ડિંગ પાસ") || gujHTML.includes("પ્રવાસનું નામ") || gujHTML.includes("સીટ નંબર"))
  })

  it("generates batch printable tickets document with page break styling", () => {
    const booking = {
      invoiceNo: "YHB-BATCH-01",
      tourName: "Dwarka Darshan",
      journeyDate: "2026-12-05",
      contactName: "Vikram Mehta",
      contactPhone: "9123456780",
      totalAmount: 18000,
      advanceReceived: 18000,
    }
    const passengersWithQRs = [
      { pax: { name: "Vikram Mehta", seatId: "lower-L1" }, idx: 0, qrUrl: "data:qr1" },
      { pax: { name: "Ananya Mehta", seatId: "lower-L2" }, idx: 1, qrUrl: "data:qr2" },
    ]

    const fullHTML = buildBatchPrintableTicketsHTML({
      templateId: "modern",
      booking,
      passengersWithQRs,
      user: { companyName: "Girraj Travels" },
      lang: "en",
    })

    assert.ok(fullHTML.includes("Vikram Mehta"))
    assert.ok(fullHTML.includes("Ananya Mehta"))
    assert.ok(fullHTML.includes("page-break-after"))
    assert.ok(fullHTML.includes("@media print"))
  })
})
