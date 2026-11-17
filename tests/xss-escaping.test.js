import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { escapeHtml, sanitizeHexColor, sanitizeImageUrl } from "../src/utils/escapeHtml.js"
import {
  TICKET_TEMPLATES,
  buildSingleTicketCardHTML,
  buildBatchPrintableTicketsHTML,
} from "../src/components/tickets/ticketRegistry.js"

describe("XSS Output Encoding & Sanitization Helpers", () => {
  it("escapes special HTML characters (&, <, >, \", ')", () => {
    const raw = '<script>alert("XSS & \'attack\'")</script>'
    const escaped = escapeHtml(raw)
    assert.equal(
      escaped,
      "&lt;script&gt;alert(&quot;XSS &amp; &#39;attack&#39;&quot;)&lt;/script&gt;"
    )
    assert.ok(!escaped.includes("<script>"))
  })

  it("safely handles null, undefined, numbers, and booleans", () => {
    assert.equal(escapeHtml(null), "")
    assert.equal(escapeHtml(undefined), "")
    assert.equal(escapeHtml(42), "42")
    assert.equal(escapeHtml(0), "0")
    assert.equal(escapeHtml(true), "true")
    assert.equal(escapeHtml(false), "false")
  })

  it("validates and sanitizes CSS hex colors", () => {
    assert.equal(sanitizeHexColor("#4f46e5"), "#4f46e5")
    assert.equal(sanitizeHexColor("#fff"), "#fff")
    assert.equal(sanitizeHexColor("#12345678"), "#12345678")
    // Hostile or invalid values revert to fallback
    assert.equal(sanitizeHexColor("red; background: url(javascript:alert(1))"), "#4f46e5")
    assert.equal(sanitizeHexColor("<script>"), "#4f46e5")
    assert.equal(sanitizeHexColor("blue", "#000000"), "#000000")
  })

  it("validates and sanitizes image URLs and data URIs", () => {
    const validPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    assert.equal(sanitizeImageUrl(validPng), validPng)
    assert.equal(sanitizeImageUrl("/logo.png"), "/logo.png")
    assert.equal(sanitizeImageUrl("/assets/bus-icon.svg"), "/assets/bus-icon.svg")

    // Hostile URLs return empty string
    assert.equal(sanitizeImageUrl("javascript:alert(1)"), "")
    assert.equal(sanitizeImageUrl("data:text/html,<script>alert(1)</script>"), "")
    assert.equal(sanitizeImageUrl("https://malicious-cdn.com/evil.js"), "")
  })

  it("strictly neutralizes hostile HTML payloads across all 6 ticket templates", () => {
    const hostileBooking = {
      invoiceNo: '<b onmouseover="alert(1)">INV-999</b>',
      tourName: 'Kashi Yatra <script>alert("tour")</script>',
      journeyDate: "2026-11-20",
      contactName: 'Lead " onclick="alert(1)',
      contactPhone: "9876543210",
      totalAmount: 15000,
      advanceReceived: 5000,
    }

    const hostilePax = {
      name: '<img src=x onerror="alert(\'pax\')">',
      age: 28,
      gender: "Male",
      city: '<script>alert("city")</script>',
      seatId: 'L1" onfocus="alert(1)',
      aadhar: "123456789012",
    }

    const hostileUser = {
      companyName: '<script>alert("corp")</script>',
      companyTagline: '<div style="color:red">Tag</div>',
      companyHeadquarters: 'Delhi <script>',
      companyPhone: '9999999999" onmouseover="alert(1)',
      invoiceColor: 'expression(alert(1))',
      gstNumber: 'GST<script>',
    }

    TICKET_TEMPLATES.forEach((template) => {
      const html = buildSingleTicketCardHTML({
        templateId: template.id,
        booking: hostileBooking,
        pax: hostilePax,
        idx: 0,
        qrUrl: "javascript:alert('evil-qr')",
        user: hostileUser,
        lang: "en",
      })

      // Must NOT contain unescaped hostile HTML tags or javascript URIs
      assert.ok(!html.includes("<script>"), `${template.id} leaked <script>`)
      assert.ok(!html.includes("<img src=x"), `${template.id} leaked <img src=x`)
      assert.ok(!html.includes("<b onmouseover"), `${template.id} leaked <b onmouseover`)
      assert.ok(!html.includes('<div style="color:red">'), `${template.id} leaked unescaped div style`)
      assert.ok(!html.includes("javascript:alert"), `${template.id} leaked javascript: URL`)

      // Must contain escaped versions
      assert.ok(html.includes("&lt;script&gt;"), `${template.id} missing escaped script tag`)
      assert.ok(html.includes("&lt;img"), `${template.id} missing escaped img tag`)
      assert.ok(html.includes("&quot;"), `${template.id} missing escaped quotes`)
    })
  })

  it("embeds strict Content-Security-Policy meta tag in batch ticket document", () => {
    const batchHTML = buildBatchPrintableTicketsHTML({
      booking: { invoiceNo: "INV-100", tourName: "Kedarnath Tour" },
      passengersWithQRs: [
        {
          pax: { name: "Rohan", seatId: "U1" },
          idx: 0,
          qrUrl: "data:image/png;base64,sample",
        },
      ],
      user: { companyName: "Yatra Tours" },
    })

    assert.ok(
      batchHTML.includes('<meta http-equiv="Content-Security-Policy"'),
      "Batch print HTML missing CSP meta tag"
    )
    assert.ok(
      batchHTML.includes("script-src 'none'"),
      "Batch print CSP does not disallow script execution"
    )
  })
})
