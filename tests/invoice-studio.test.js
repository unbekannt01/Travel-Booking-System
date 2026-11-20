import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  INVOICE_LAYOUTS,
  PAPER_SIZES,
  COPIES_OPTIONS,
  COLOR_PRESETS,
  TEMPLATE_PRESETS,
  DEFAULT_TEMPLATE_CONFIG,
  calculateContrastRatio,
  isWcagAccessible,
  validateTemplateConfig,
  normalizeTemplateConfig,
  buildUpiPaymentUri,
} from "../shared/invoiceTemplate.js"
import { renderDocumentHtml } from "../shared/documentRenderer.js"
import { validateUploadedAsset } from "../backend/utils/assetValidation.js"

describe("Invoice Studio — Configuration & Validation (shared/invoiceTemplate.js)", () => {
  it("defines standard layout styles, paper sizes, and copy options", () => {
    assert.deepEqual(INVOICE_LAYOUTS, ["legacy", "modern", "classic", "minimal", "corporate"])
    assert.deepEqual(PAPER_SIZES, ["a4", "a5", "thermal80", "thermal58"])
    assert.deepEqual(COPIES_OPTIONS, ["single", "original-duplicate", "original-duplicate-triplicate"])
  })

  it("validates all 6 built-in template presets successfully", () => {
    const presetKeys = Object.keys(TEMPLATE_PRESETS)
    assert.equal(presetKeys.length, 6)
    assert.deepEqual(presetKeys, [
      "classic-bus",
      "modern-minimal",
      "gujarat-heritage",
      "pilgrim-simple",
      "thermal-compact",
      "corporate-blue",
    ])

    for (const [key, preset] of Object.entries(TEMPLATE_PRESETS)) {
      const v = validateTemplateConfig(preset.config)
      assert.equal(v.valid, true, `Preset ${key} configuration must be valid: ${v.errors.join(", ")}`)
    }
  })

  it("rejects invalid layouts, paper sizes, or corrupt hex colors", () => {
    const invalidConfig = {
      layout: "non-existent-layout",
      paper: { size: "billboard-xxl" },
      colors: { primary: "not-a-color-at-all" },
    }
    const res = validateTemplateConfig(invalidConfig)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes("Invalid layout")))
    assert.ok(res.errors.some((e) => e.includes("Invalid paper size")))
    assert.ok(res.errors.some((e) => e.includes("Invalid hex color")))
  })

  it("normalizes partial or malformed configurations to safe defaults", () => {
    const normalized = normalizeTemplateConfig({
      layout: "invalid",
      header: { logoHeight: 9999 }, // should clamp to 120
      watermark: { opacity: 5.5 }, // should clamp to 0.5
      colors: { primary: "malicious; behavior: url(evil.htc)" },
    })

    assert.equal(normalized.layout, "legacy")
    assert.equal(normalized.header.logoHeight, 120)
    assert.equal(normalized.watermark.opacity, 0.5)
    assert.equal(normalized.colors.primary, "#4f46e5") // safe fallback
  })
})

describe("WCAG 2.1 Contrast Calculation", () => {
  it("calculates contrast accurately for pure black and white", () => {
    const ratio = calculateContrastRatio("#000000", "#ffffff")
    assert.equal(ratio, 21)
    assert.equal(isWcagAccessible("#000000", "#ffffff"), true)
  })

  it("calculates contrast accurately for identical colors", () => {
    const ratio = calculateContrastRatio("#ffffff", "#ffffff")
    assert.equal(ratio, 1)
    assert.equal(isWcagAccessible("#ffffff", "#ffffff"), false)
  })

  it("verifies standard brand indigo passes WCAG AA against white", () => {
    // #4f46e5 against #ffffff has ratio > 8.0:1
    const ratio = calculateContrastRatio("#4f46e5", "#ffffff")
    assert.ok(ratio >= 4.5, `Expected >= 4.5, got ${ratio}`)
    assert.equal(isWcagAccessible("#4f46e5", "#ffffff"), true)
  })

  it("detects low-contrast colors failing WCAG AA", () => {
    // Pale yellow #fef08a on white has ratio ~ 1.2:1
    const ratio = calculateContrastRatio("#fef08a", "#ffffff")
    assert.ok(ratio < 4.5, `Expected < 4.5, got ${ratio}`)
    assert.equal(isWcagAccessible("#fef08a", "#ffffff"), false)
  })
})

describe("UPI Payment URI Builder", () => {
  it("constructs standard NPCI compliant UPI URIs", () => {
    const uri = buildUpiPaymentUri({
      upiId: "yatratours@okhdfcbank",
      payeeName: "Shree Ram Yatra",
      amount: 4500,
      note: "Booking INV-045",
    })
    assert.ok(uri.startsWith("upi://pay?"))
    assert.ok(uri.includes("pa=yatratours%40okhdfcbank"))
    assert.ok(uri.includes("pn=Shree+Ram+Yatra"))
    assert.ok(uri.includes("am=4500.00"))
    assert.ok(uri.includes("cu=INR"))
  })

  it("returns empty string when upiId is missing", () => {
    assert.equal(buildUpiPaymentUri({ upiId: "" }), "")
    assert.equal(buildUpiPaymentUri({}), "")
  })
})

describe("Document HTML Pure Renderer (shared/documentRenderer.js)", () => {
  const sampleBooking = {
    invoiceNo: "YHB/2026-27/0055",
    status: "Confirmed",
    date: "2026-05-10T10:00:00.000Z",
    journeyDate: "2026-05-20T06:00:00.000Z",
    tourName: "Dwarka - Somnath Tour",
    busType: "AC Sleeper 2+1",
    contactName: "Pravinbhai Shah <script>alert('xss')</script>",
    contactPhone: "+91 98251 11223",
    totalAmount: 18000,
    advanceReceived: 8000,
    discount: 500,
    gstRate: 5,
    taxAmount: 850,
    passengers: [
      {
        name: "Pravinbhai Shah",
        age: 55,
        gender: "Male",
        seatId: "U1",
        city: "Rajkot",
        aadhaar: "998877665544",
        encryptedAadhaar: "secret_encrypted_token",
      },
      {
        name: "Minaxiben Shah",
        age: 52,
        gender: "Female",
        seatId: "U2",
        city: "Rajkot",
        aadhaar: "112233445566",
      },
    ],
  }

  const sampleUser = {
    companyName: "Gokul Yatra Services <img src=x onerror=alert(1)>",
    companyHeadquarters: "Junagadh, Gujarat",
    companyPhone: "+91 98765 43210",
    gstNumber: "24AAAAA0000A1Z5",
    bankDetails: {
      accountName: "Gokul Yatra Services",
      accountNumber: "9876543210",
      ifscCode: "HDFC0001234",
      upiId: "gokul@okhdfcbank",
    },
  }

  it("strictly neutralizes XSS payloads in customer, company, and notes", () => {
    const html = renderDocumentHtml({
      booking: sampleBooking,
      user: sampleUser,
      template: DEFAULT_TEMPLATE_CONFIG,
    })

    assert.ok(html.includes("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"))
    assert.equal(html.includes("<script>alert('xss')</script>"), false)

    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"))
    assert.equal(html.includes("<img src=x onerror=alert(1)>"), false)
  })

  it("enforces ZERO Aadhaar leakage in generated invoice HTML", () => {
    const html = renderDocumentHtml({
      booking: sampleBooking,
      user: sampleUser,
      template: DEFAULT_TEMPLATE_CONFIG,
    })

    assert.equal(html.includes("998877665544"), false, "Raw Aadhaar must NEVER be printed")
    assert.equal(html.includes("112233445566"), false, "Raw Aadhaar must NEVER be printed")
    assert.equal(html.includes("secret_encrypted_token"), false, "Encrypted Aadhaar token must NEVER leak")
  })

  it("includes strict CSP meta tag in document header", () => {
    const html = renderDocumentHtml({
      booking: sampleBooking,
      user: sampleUser,
    })

    assert.ok(
      html.includes(
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: 'self'; font-src data:; script-src 'none';"/>`
      )
    )
  })

  it("renders multiple copies with corresponding labels and page breaks", () => {
    const multiCopyTemplate = {
      ...DEFAULT_TEMPLATE_CONFIG,
      copies: "original-duplicate",
      copyLabels: {
        copy1: "Original for Passenger",
        copy2: "Duplicate for Transporter",
      },
    }

    const html = renderDocumentHtml({
      booking: sampleBooking,
      user: sampleUser,
      template: multiCopyTemplate,
    })

    assert.ok(html.includes("Original for Passenger"))
    assert.ok(html.includes("Duplicate for Transporter"))
    assert.ok(html.includes("page-break"))
  })

  it("renders thermal format correctly without page tables", () => {
    const thermalTemplate = {
      ...DEFAULT_TEMPLATE_CONFIG,
      paper: { size: "thermal80" },
    }

    const html = renderDocumentHtml({
      booking: sampleBooking,
      user: sampleUser,
      template: thermalTemplate,
    })

    assert.ok(html.includes("width:72mm;"))
    assert.ok(html.includes("80mm auto"))
  })

  it("renders automatic VOID watermark when document status is void", () => {
    const voidDoc = {
      type: "tax-invoice",
      number: "INV-999",
      status: "void",
      voidReason: "Customer cancellation",
    }

    const html = renderDocumentHtml({
      document: voidDoc,
      booking: sampleBooking,
      user: sampleUser,
      template: DEFAULT_TEMPLATE_CONFIG,
    })

    assert.ok(html.includes("VOID"))
    assert.ok(html.includes("Customer cancellation"))
  })

  it("golden test: legacy layout preserves existing InvoiceView visual structure", () => {
    const html = renderDocumentHtml({
      booking: sampleBooking,
      user: sampleUser,
      template: { ...DEFAULT_TEMPLATE_CONFIG, layout: "legacy" },
    })

    assert.ok(html.includes("TAX INVOICE"))
    assert.ok(html.includes("Headquarters"))
    assert.ok(html.includes("Passenger Manifest"))
    assert.ok(html.includes("Balance Payable"))
    assert.ok(html.includes("We wish you a magnificent journey!"))
  })
})

describe("Asset Upload Magic Byte Validator (backend/utils/assetValidation.js)", () => {
  it("accepts valid PNG image buffers", () => {
    // Valid PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
    const res = validateUploadedAsset(pngBuffer, "logo")
    assert.equal(res.valid, true)
    assert.equal(res.mimeType, "image/png")
    assert.ok(res.dataUrl.startsWith("data:image/png;base64,"))
  })

  it("accepts valid JPEG image buffers", () => {
    // Valid JPEG signature: FF D8 FF
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    const res = validateUploadedAsset(jpegBuffer, "signature")
    assert.equal(res.valid, true)
    assert.equal(res.mimeType, "image/jpeg")
    assert.ok(res.dataUrl.startsWith("data:image/jpeg;base64,"))
  })

  it("accepts valid WebP image buffers", () => {
    // Valid WebP signature: RIFF (bytes 0-3) and WEBP (bytes 8-11)
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, // WEBP
      0x56, 0x50, 0x38, 0x20,
    ])
    const res = validateUploadedAsset(webpBuffer, "stamp")
    assert.equal(res.valid, true)
    assert.equal(res.mimeType, "image/webp")
  })

  it("strictly rejects SVG images and XML vectors", () => {
    const svgString = "data:image/svg+xml;base64," + Buffer.from("<svg><script>alert(1)</script></svg>").toString("base64")
    const res = validateUploadedAsset(svgString, "logo")
    assert.equal(res.valid, false)
    assert.ok(res.error.includes("SVG format is rejected for security"))
  })

  it("rejects non-image arbitrary binary data", () => {
    const binaryTrash = Buffer.from("MZ\x90\x00\x03\x00\x00\x00WindowsExecutable")
    const res = validateUploadedAsset(binaryTrash, "logo")
    assert.equal(res.valid, false)
    assert.ok(res.error.includes("Invalid image format"))
  })

  it("rejects assets exceeding the 200 KB size limit", () => {
    // 250 KB fake buffer
    const oversized = Buffer.alloc(250 * 1024, 0x89)
    const res = validateUploadedAsset(oversized, "logo")
    assert.equal(res.valid, false)
    assert.ok(res.error.includes("exceeds maximum allowed limit of 200 KB"))
  })
})
