/**
 * YatraHub (TBS) — Pure Document & Invoice HTML Renderer (Part 3.7b)
 * Pure, zero-dependency ESM renderer supporting live iframe preview and window printing.
 * Strictly escapes all dynamic variables, enforces zero Aadhaar output, and respects CSP.
 */

import { escapeHtml, sanitizeHexColor, sanitizeImageUrl } from "./escapeHtml.js"
import {
  normalizeTemplateConfig,
  buildUpiPaymentUri,
  isValidUpiVpa,
} from "./invoiceTemplate.js"
import { getType } from "./documentTypes.js"
import { getDocumentTranslation } from "../src/i18n/documents.js"

/**
 * Pure function rendering a complete standalone HTML document string for preview or print.
 *
 * @param {Object} params
 * @param {Object} [params.document] - IssuedDocument record or snapshot
 * @param {Object} [params.booking] - Booking record
 * @param {Object} [params.template] - InvoiceTemplate configuration object
 * @param {Object} [params.user] - Operator profile & business settings
 * @param {string} [params.qrDataUrl] - Base64 data URI of the generated UPI payment QR code
 * @param {boolean} [params.previewMode=false] - When true, optimizes styles for iframe display
 * @returns {string} Fully self-contained HTML document string
 */
export function renderDocumentHtml({
  document: doc,
  booking: rawBooking,
  template: templateInput,
  user,
  qrDataUrl = "",
  previewMode = false,
} = {}) {
  const booking = rawBooking?.booking || rawBooking || {}
  const templateConfig = doc?.templateSnapshot || templateInput || {}
  const template = normalizeTemplateConfig(templateConfig)

  const lang = template.language || user?.documentLanguage || "en"
  const t = getDocumentTranslation(lang)

  // Document metadata
  const docType = doc?.type || "tax-invoice"
  const typeMeta = getType(docType)
  const docTitle =
    template.labels?.title ||
    doc?.settings?.title ||
    typeMeta?.defaultTitle ||
    t.officialBookingInvoice
  const docNumber = doc?.number || booking?.invoiceNo || "PREVIEW-001"
  const isVoid = doc?.status === "void"
  const isCancelled = booking?.status === "Cancelled" || booking?.status === "cancelled"
  const voidReason = doc?.voidReason || (isCancelled ? booking?.cancellationReason : "") || ""

  // Financial figures (snapshot priority, fallback to booking)
  const totalAmount = doc?.amounts?.totalAmount ?? booking?.totalAmount ?? 0
  const advanceReceived = doc?.amounts?.advanceReceived ?? booking?.advanceReceived ?? 0
  const balance = Math.max(0, totalAmount - advanceReceived)
  const discount = doc?.amounts?.discount ?? booking?.discount ?? 0
  const gstRate = doc?.amounts?.gstRate ?? booking?.gstRate ?? 0
  const taxAmount = doc?.amounts?.taxAmount ?? booking?.taxAmount ?? 0
  const isTaxInclusive = doc?.amounts?.isTaxInclusive ?? booking?.isTaxInclusive ?? false
  const cancellationCharge = doc?.amounts?.cancellationCharge ?? booking?.cancellationCharge ?? 0
  const refundAmount = doc?.amounts?.refundAmount ?? booking?.refundAmount ?? 0
  const showGstBreakup =
    template.sections.showFinancialBreakup &&
    (doc?.settings?.showGstBreakup ?? typeMeta?.showGstBreakup ?? true)

  // Company branding & contact info
  const safePrimary = sanitizeHexColor(template.colors.primary, "#4f46e5")
  const safeAccent = sanitizeHexColor(template.colors.accent, "#6366f1")
  const safeText = sanitizeHexColor(template.colors.text, "#0f172a")
  const safeBorder = sanitizeHexColor(template.colors.border, "#e2e8f0")
  const safeSurface = sanitizeHexColor(template.colors.surface, "#f8fafc")

  const companyName = escapeHtml(
    doc?.company?.name || user?.companyName?.toUpperCase() || "YATRA TOURS"
  )
  const companyTagline = escapeHtml(
    doc?.company?.tagline || user?.companyTagline || "Tourism & Travels"
  )
  const companyHQ = escapeHtml(
    doc?.company?.address || user?.companyHeadquarters || ""
  )
  const companyPhone = escapeHtml(
    doc?.company?.phone || user?.companyPhone || ""
  )
  const gstinVal = doc?.company?.gstin || user?.gstNumber || ""
  const safeLogo = sanitizeImageUrl(
    template.header.showLogo
      ? template.assets?.logo || doc?.company?.logoUrl || user?.companyLogo
      : ""
  )
  const safeSignature = sanitizeImageUrl(template.assets?.signature)
  const safeStamp = sanitizeImageUrl(template.assets?.stamp)

  // Tour details
  const tourName = escapeHtml(booking.tourName || "Custom Tour")
  const busType = escapeHtml(booking.busType || "AC Luxury Coach")
  const journeyDate = booking.journeyDate
    ? new Date(booking.journeyDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—"
  const bookingDate = booking.date
    ? new Date(booking.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN")
  const validUntil = doc?.validUntil
    ? new Date(doc.validUntil).toLocaleDateString("en-IN")
    : null

  // Customer details
  const customerName = escapeHtml(doc?.customer?.name || booking.contactName || "Guest Traveler")
  const customerPhone = escapeHtml(doc?.customer?.phone || booking.contactPhone || "")
  const customerEmail = escapeHtml(doc?.customer?.email || booking.contactEmail || "")

  // Line items (Passengers) — Strictly zero Aadhaar output!
  const passengers = (doc?.lineItems && doc.lineItems.length > 0)
    ? doc.lineItems
    : (booking.passengers || [])

  // Organizers
  const organizers = user?.organizers || []

  // Terms & Conditions list
  const defaultTC = [
    "Valid photo ID is required for all travelers during boarding.",
    "Advance payment is non-refundable upon confirmation.",
    "Final balance must be settled 24 hours prior to departure.",
    "Company is not liable for itinerary adjustments due to weather.",
  ]
  const rawTerms = doc?.settings?.terms || user?.termsAndConditions
  const tcList = rawTerms
    ? (Array.isArray(rawTerms)
        ? rawTerms
        : String(rawTerms).split("\n").map((s) => s.trim()).filter(Boolean))
    : defaultTC

  // Notes
  const notesText = doc?.settings?.notes || booking.notes || ""

  // Bank & UPI details
  const bankDetails = doc?.company?.bankDetails || user?.bankDetails || {}
  const hasBankDetails = Boolean(
    bankDetails.upiId || bankDetails.accountNumber || bankDetails.accountName
  )

  // Paper and font settings
  const paperSize = template.paper.size
  const isThermal = paperSize === "thermal80" || paperSize === "thermal58"
  const thermalWidth = paperSize === "thermal58" ? "48mm" : "72mm"
  const fontCss =
    template.typography.fontFamily === "inter"
      ? "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      : template.typography.fontFamily === "serif"
      ? "Georgia, 'Times New Roman', serif"
      : "'Segoe UI', Arial, sans-serif"

  // Number of copies
  const copiesCount =
    template.copies === "original-duplicate-triplicate"
      ? 3
      : template.copies === "original-duplicate"
      ? 2
      : 1

  const copyLabelsList = [
    template.copyLabels.copy1 || "Original for Recipient",
    template.copyLabels.copy2 || "Duplicate for Transporter",
    template.copyLabels.copy3 || "Triplicate for Supplier",
  ]

  // Multi-copy generator
  const copiesHtml = []
  for (let c = 0; c < copiesCount; c++) {
    const copyLabel = copiesCount > 1 ? copyLabelsList[c] : ""
    const sheetHtml = renderSingleSheet({
      layout: template.layout,
      isThermal,
      thermalWidth,
      copyLabel,
      copyIndex: c,
      isLastCopy: c === copiesCount - 1,
      docTitle,
      docType,
      docNumber,
      isVoid,
      isCancelled,
      voidReason,
      companyName,
      companyTagline,
      companyHQ,
      companyPhone,
      gstinVal,
      safeLogo,
      safeSignature,
      safeStamp,
      customerName,
      customerPhone,
      customerEmail,
      tourName,
      busType,
      journeyDate,
      bookingDate,
      validUntil,
      paymentMode: booking.paymentMode || "Cash",
      passengers,
      organizers,
      tcList,
      notesText,
      bankDetails,
      hasBankDetails,
      qrDataUrl,
      baseAmount: booking.baseAmount || totalAmount,
      totalAmount,
      advanceReceived,
      balance,
      discount,
      gstRate,
      taxAmount,
      isTaxInclusive,
      cancellationCharge,
      refundAmount,
      showGstBreakup,
      template,
      safePrimary,
      safeAccent,
      safeText,
      safeBorder,
      safeSurface,
      t,
    })
    copiesHtml.push(sheetHtml)
  }

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: 'self'; font-src data:; script-src 'none';"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escapeHtml(docTitle)} #${escapeHtml(docNumber)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body {
    font-family: ${fontCss};
    background: ${previewMode ? "transparent" : "#f1f5f9"};
    color: ${safeText};
    font-size: ${template.typography.fontSize === "compact" ? "12px" : template.typography.fontSize === "spacious" ? "15px" : "13px"};
    line-height: 1.45;
  }

  .sheet-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: ${previewMode ? "8px" : "16px"};
  }

  .invoice-sheet {
    position: relative;
    width: 100%;
    max-width: ${isThermal ? (paperSize === "thermal58" ? "58mm" : "80mm") : "820px"};
    background: #ffffff;
    margin-bottom: ${copiesCount > 1 ? "24px" : "0"};
    border: 1px solid ${safeBorder};
    border-radius: ${isThermal ? "0" : template.layout === "modern" ? "16px" : template.layout === "minimal" ? "4px" : "8px"};
    box-shadow: ${previewMode ? "0 2px 10px rgba(0,0,0,0.05)" : "0 4px 16px rgba(0,0,0,0.06)"};
    overflow: hidden;
  }

  /* Copy header tag */
  .copy-tag {
    background: ${safeSurface};
    border-bottom: 1px dashed ${safeBorder};
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
    text-align: right;
    padding: 4px 16px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* Watermark overlay */
  .watermark-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
    overflow: hidden;
  }
  .watermark-text {
    font-size: 72px;
    font-weight: 900;
    text-transform: uppercase;
    transform: rotate(-30deg);
    letter-spacing: 0.1em;
    user-select: none;
  }

  @page {
    size: ${isThermal ? (paperSize === "thermal58" ? "58mm auto" : "80mm auto") : paperSize === "a5" ? "A5 " + template.paper.orientation : "A4 " + template.paper.orientation};
    margin: ${isThermal ? "2mm" : template.paper.marginMm + "mm"};
  }

  @media print {
    body { background: #ffffff !important; }
    .sheet-container { padding: 0 !important; }
    .invoice-sheet {
      box-shadow: none !important;
      border: ${isThermal ? "none" : "1px solid " + safeBorder} !important;
      border-radius: 0 !important;
      margin: 0 !important;
      max-width: 100% !important;
    }
    .page-break { page-break-after: always; break-after: page; }
  }
</style>
</head>
<body>
<div class="sheet-container">
  ${copiesHtml.join("\n")}
</div>
</body>
</html>`
}

/**
 * Internal helper to render a single sheet of an invoice.
 */
function renderSingleSheet({
  layout,
  isThermal,
  thermalWidth,
  copyLabel,
  isLastCopy,
  docTitle,
  docType,
  docNumber,
  isVoid,
  isCancelled,
  voidReason,
  companyName,
  companyTagline,
  companyHQ,
  companyPhone,
  gstinVal,
  safeLogo,
  safeSignature,
  safeStamp,
  customerName,
  customerPhone,
  customerEmail,
  tourName,
  busType,
  journeyDate,
  bookingDate,
  validUntil,
  paymentMode,
  passengers,
  organizers,
  tcList,
  notesText,
  bankDetails,
  hasBankDetails,
  qrDataUrl,
  baseAmount,
  totalAmount,
  advanceReceived,
  balance,
  discount,
  gstRate,
  taxAmount,
  isTaxInclusive = false,
  showGstBreakup,
  template,
  safePrimary,
  safeAccent,
  safeText,
  safeBorder,
  safeSurface,
  t,
}) {
  const isCreditNote = docType === "credit-note"
  const docWord = isCreditNote ? t.creditNote.toUpperCase() : t.invoiceWord

  // Watermark text evaluation
  let watermarkText = ""
  let watermarkColor = "rgba(0,0,0,0.06)"
  if (isVoid) {
    watermarkText = "VOID"
    watermarkColor = "rgba(239, 68, 68, 0.15)"
  } else if (isCancelled) {
    watermarkText = "CANCELLED"
    watermarkColor = "rgba(239, 68, 68, 0.12)"
  } else if (template.watermark.enabled && template.watermark.text) {
    watermarkText = escapeHtml(template.watermark.text)
    watermarkColor = `rgba(15, 23, 42, ${template.watermark.opacity})`
  }

  // Passenger rows (ZERO AADHAAR!)
  const passengersHtml = passengers
    .map((p, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : safeSurface
      const seat = escapeHtml(p.seatId || p.seat || "—")
      const name = escapeHtml(p.name || `Traveler ${i + 1}`)
      const city = escapeHtml(p.city || "—")
      const age = escapeHtml(p.age || "—")
      const gender = escapeHtml(p.gender || "—")
      return `<tr style="background:${bg};">
        <td style="padding:8px 12px;font-weight:700;color:#94a3b8;width:36px;">${i + 1}</td>
        <td style="padding:8px 12px;font-weight:700;color:${safeText};">${name}</td>
        <td style="padding:8px 12px;font-weight:800;color:${safePrimary};font-size:11px;text-transform:uppercase;">${seat}</td>
        <td style="padding:8px 12px;color:#475569;">${city}</td>
        <td style="padding:8px 12px;font-weight:700;text-align:center;color:${safeText};">${age}</td>
        <td style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:#475569;">${gender}</td>
      </tr>`
    })
    .join("")

  // Organizers HTML
  const organizersHtml = template.header.showOrganizers && organizers.length > 0
    ? organizers
        .map(
          (o) =>
            `<p style="font-size:11px;font-weight:700;color:${safePrimary};margin:2px 0;">
             📞 ${escapeHtml(o.name)}${o.phone ? " — " + escapeHtml(o.phone) : ""}
            </p>`
        )
        .join("")
    : ""

  // Terms HTML
  const termsHtml = template.sections.showTerms && tcList.length > 0
    ? tcList.map((item) => `<li style="margin-bottom:3px;">• ${escapeHtml(item)}</li>`).join("")
    : ""

  // Thermal layout branch
  if (isThermal) {
    return `
    <div class="invoice-sheet" style="padding:12px;width:${thermalWidth};">
      ${copyLabel ? `<div class="copy-tag" style="text-align:center;">${escapeHtml(copyLabel)}</div>` : ""}
      ${isVoid ? `<div style="background:#fee2e2;border:1px solid #ef4444;color:#b91c1c;padding:4px;font-size:11px;font-weight:900;text-align:center;margin-bottom:8px;">⛔ VOID: ${escapeHtml(voidReason || "DOCUMENT VOIDED")}</div>` : ""}
      <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
        <h2 style="font-size:16px;font-weight:900;line-height:1.2;">${companyName}</h2>
        ${companyPhone ? `<p style="font-size:11px;">Tel: ${companyPhone}</p>` : ""}
        ${gstinVal ? `<p style="font-size:10px;font-weight:700;">GSTIN: ${escapeHtml(gstinVal)}</p>` : ""}
        <div style="margin-top:4px;font-weight:900;font-size:12px;text-transform:uppercase;">${escapeHtml(docTitle)}</div>
        <div style="font-size:11px;">#${escapeHtml(docNumber)}</div>
        <div style="font-size:10px;color:#475569;">${bookingDate}</div>
      </div>

      <div style="font-size:11px;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;">
        <div><strong>Traveler:</strong> ${customerName}</div>
        ${customerPhone ? `<div><strong>Phone:</strong> ${customerPhone}</div>` : ""}
        <div><strong>Tour:</strong> ${tourName}</div>
        <div><strong>Journey:</strong> ${journeyDate}</div>
        <div><strong>Pax:</strong> ${passengers.length}</div>
      </div>

      <table style="width:100%;font-size:10px;border-collapse:collapse;margin-bottom:6px;">
        <thead>
          <tr style="border-bottom:1px solid #000;text-align:left;">
            <th>#</th><th>Name</th><th>Seat</th>
          </tr>
        </thead>
        <tbody>
          ${passengers.map((p, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.seatId || p.seat || "—")}</td></tr>`).join("")}
        </tbody>
      </table>

      <div style="border-top:1px dashed #000;padding-top:6px;font-size:11px;line-height:1.6;">
        <div style="display:flex;justify-content:space-between;"><span>Total Amount:</span><strong>₹${totalAmount.toLocaleString()}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Advance Paid:</span><span>₹${advanceReceived.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:900;border-top:1px solid #000;margin-top:4px;padding-top:4px;">
          <span>Balance Due:</span><span>₹${balance.toLocaleString()}</span>
        </div>
      </div>

      ${qrDataUrl && template.sections.showUpiQr && balance > 0 && bankDetails.upiId && isValidUpiVpa(bankDetails.upiId) ? `
      <div style="text-align:center;margin-top:12px;padding-top:8px;border-top:1px dashed #000;">
        <img src="${qrDataUrl}" alt="UPI QR" style="width:100px;height:100px;display:inline-block;" />
        <div style="font-size:10px;font-weight:700;margin-top:2px;">Scan to Pay via UPI</div>
        ${bankDetails.upiId ? `<div style="font-size:9px;">${escapeHtml(bankDetails.upiId)}</div>` : ""}
      </div>` : ""}

      <div style="text-align:center;margin-top:10px;font-size:10px;border-top:1px dashed #000;padding-top:6px;">
        <p>${escapeHtml(template.footer.customText || t.wishJourney)}</p>
      </div>
    </div>
    ${isLastCopy ? "" : `<div class="page-break"></div>`}
    `
  }

  // Standard layouts (legacy, modern, classic, minimal, corporate)
  return `
  <div class="invoice-sheet">
    ${copyLabel ? `<div class="copy-tag">${escapeHtml(copyLabel)}</div>` : ""}

    ${watermarkText ? `
    <div class="watermark-overlay">
      <div class="watermark-text" style="color:${watermarkColor};">${watermarkText}</div>
    </div>` : ""}

    ${isVoid ? `
    <div style="background:#fee2e2;border-bottom:2px solid #ef4444;color:#b91c1c;padding:8px 16px;font-weight:900;text-align:center;text-transform:uppercase;font-size:12px;">
      ⛔ VOID: ${escapeHtml(voidReason || "This document has been voided")}
    </div>` : ""}

    <!-- HEADER SECTION -->
    <div style="padding:28px 36px;${layout === "legacy" || layout === "modern" ? `background:linear-gradient(135deg, ${safePrimary}, #0f172a);color:#ffffff;` : layout === "classic" ? `background:${safePrimary};color:#ffffff;` : layout === "corporate" ? `background:#0f172a;color:#ffffff;border-bottom:4px solid ${safePrimary};` : `background:#ffffff;border-bottom:2px solid ${safePrimary};color:${safeText};`}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:16px;">
          ${safeLogo ? `<div style="background:#ffffff;border-radius:10px;padding:6px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.1);"><img src="${safeLogo}" alt="Logo" style="height:${template.header.logoHeight}px;max-width:140px;object-fit:contain;" /></div>` : ""}
          <div>
            <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.02em;line-height:1.1;color:${layout === "minimal" ? safePrimary : "#ffffff"};">${companyName}</h1>
            ${template.header.showTagline && companyTagline ? `<p style="font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;margin-top:3px;opacity:0.85;color:${layout === "minimal" ? "#64748b" : "#c7d2fe"};">${companyTagline}</p>` : ""}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;${layout === "minimal" ? `background:#f1f5f9;color:${safePrimary};border:1px solid ${safeBorder};` : `background:rgba(255,255,255,0.2);color:#ffffff;border:1px solid rgba(255,255,255,0.3);`}">${escapeHtml(docTitle)}</div>
          <div style="font-size:32px;font-weight:900;letter-spacing:-0.03em;margin-top:2px;opacity:${layout === "minimal" ? "0.15" : "0.2"};color:${layout === "minimal" ? "#0f172a" : "#ffffff"};">${escapeHtml(docWord)}</div>
        </div>
      </div>
    </div>

    <!-- META DETAILS ROW -->
    <div style="display:flex;gap:24px;padding:24px 36px 18px;border-bottom:1px solid ${safeBorder};flex-wrap:wrap;background:${layout === "minimal" ? "#ffffff" : safeSurface};">
      <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:14px;">
        <div>
          <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-bottom:2px;">${t.headquarters}</div>
          ${companyHQ ? `<div style="font-size:12px;font-weight:700;color:#334155;">📍 ${companyHQ}</div>` : ""}
          ${companyPhone ? `<div style="font-size:12px;font-weight:700;color:#334155;">📞 ${companyPhone}</div>` : ""}
          ${template.header.showGstin && gstinVal ? `<div style="font-size:11px;font-weight:900;color:${safePrimary};margin-top:2px;">GSTIN: ${escapeHtml(gstinVal)}</div>` : ""}
        </div>
        ${organizersHtml ? `<div><div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-bottom:2px;">${t.tourOrganizers}</div>${organizersHtml}</div>` : ""}
        ${template.sections.showCustomer ? `
        <div>
          <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-bottom:2px;">${t.customerDetails}</div>
          <div style="font-size:15px;font-weight:900;color:${safePrimary};">${customerName}</div>
          ${customerPhone ? `<div style="font-size:12px;font-weight:700;color:#64748b;">${customerPhone}</div>` : ""}
          ${customerEmail ? `<div style="font-size:12px;font-weight:700;color:#94a3b8;">${customerEmail}</div>` : ""}
        </div>` : ""}
      </div>

      <div style="background:#ffffff;border:1px solid ${safeBorder};border-radius:12px;padding:16px 20px;min-width:250px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-bottom:2px;">${isCreditNote ? t.creditNote : t.invoiceNo}</div>
            <div style="font-size:13px;font-weight:900;color:${safeText};">#${escapeHtml(docNumber)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-bottom:2px;">${t.bookingDate}</div>
            <div style="font-size:12px;font-weight:900;color:${safeText};">${bookingDate}</div>
          </div>
          ${validUntil ? `<div><div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-bottom:2px;">${t.validUntil}</div><div style="font-size:12px;font-weight:900;color:${safeText};">${validUntil}</div></div>` : ""}
          <div>
            <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-bottom:2px;">${t.paymentMode}</div>
            <div style="font-size:11px;font-weight:900;color:#059669;text-transform:uppercase;">${escapeHtml(paymentMode)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;margin-bottom:2px;">${t.status}</div>
            <div style="font-size:11px;font-weight:900;color:${isCancelled ? "#dc2626" : safePrimary};text-transform:uppercase;">${isCancelled ? t.cancelled : t.confirmed}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- TOUR DETAILS CARDS -->
    ${template.sections.showTourDetails ? `
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;padding:16px 36px 8px;">
      <div style="background:${safeSurface};border:1px solid ${safeBorder};border-radius:10px;padding:12px 14px;">
        <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:${safePrimary};margin-bottom:2px;">${t.tourName}</div>
        <div style="font-size:13px;font-weight:900;color:${safeText};">${tourName}</div>
      </div>
      <div style="background:${safeSurface};border:1px solid ${safeBorder};border-radius:10px;padding:12px 14px;">
        <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:${safePrimary};margin-bottom:2px;">${t.journeyDate}</div>
        <div style="font-size:13px;font-weight:900;color:${safeText};">${journeyDate}</div>
      </div>
      <div style="background:${safeSurface};border:1px solid ${safeBorder};border-radius:10px;padding:12px 14px;">
        <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:${safePrimary};margin-bottom:2px;">${t.travelConfig}</div>
        <div style="font-size:13px;font-weight:900;color:${safeText};">${busType}</div>
      </div>
    </div>` : ""}

    <!-- PASSENGER MANIFEST TABLE -->
    ${template.sections.showPassengerManifest ? `
    <div style="margin:12px 36px;border:1px solid ${safeBorder};border-radius:10px;overflow:hidden;">
      <div style="background:${safeSurface};padding:8px 12px;border-bottom:1px solid ${safeBorder};">
        <p style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#64748b;">
          ${t.passengerManifest} — ${passengers.length} ${t.totalPax}
        </p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#ffffff;border-bottom:1px solid ${safeBorder};">
            <th style="padding:8px 12px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;text-align:left;">#</th>
            <th style="padding:8px 12px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;text-align:left;">${t.travelerName}</th>
            <th style="padding:8px 12px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;text-align:left;">${t.seat}</th>
            <th style="padding:8px 12px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;text-align:left;">${t.city}</th>
            <th style="padding:8px 12px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;text-align:center;">${t.age}</th>
            <th style="padding:8px 12px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#94a3b8;text-align:left;">${t.gender}</th>
          </tr>
        </thead>
        <tbody>
          ${passengersHtml}
        </tbody>
      </table>
    </div>` : ""}

    <!-- BOTTOM ROW: TERMS, BANK, FINANCIALS & SIGNATURE -->
    <div style="display:flex;gap:24px;padding:12px 36px 28px;flex-wrap:wrap;">
      <div style="flex:1;min-width:240px;display:flex;flex-direction:column;gap:12px;">
        ${termsHtml ? `
        <div>
          <h4 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:#0f172a;margin-bottom:6px;">⚑ ${t.bookingPolicyTC}</h4>
          <ul style="list-style:none;font-size:10px;color:#64748b;line-height:1.6;">
            ${termsHtml}
          </ul>
        </div>` : ""}

        ${template.sections.showBankDetails && hasBankDetails ? `
        <div style="background:${safeSurface};border:1px dashed ${safeBorder};border-radius:10px;padding:10px 14px;">
          <h4 style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.15em;color:${safePrimary};margin-bottom:4px;">💳 ${t.bankPaymentDetails}</h4>
          ${bankDetails.upiId ? `<p style="font-size:11px;font-weight:900;color:${safePrimary};margin:2px 0;">${t.upiId}: ${escapeHtml(bankDetails.upiId)}</p>` : ""}
          ${bankDetails.accountName ? `<p style="font-size:10px;font-weight:700;color:#0f172a;margin:2px 0;">${t.accountName}: ${escapeHtml(bankDetails.accountName)}</p>` : ""}
          ${bankDetails.accountNumber ? `<p style="font-size:10px;font-weight:700;color:#475569;margin:2px 0;">${t.accountNumber}: ${escapeHtml(bankDetails.accountNumber)} | ${t.ifscCode}: ${escapeHtml(bankDetails.ifscCode || "")} | ${t.bankName}: ${escapeHtml(bankDetails.bankName || "")}</p>` : ""}
        </div>` : ""}

        ${template.sections.showNotes && notesText ? `
        <div style="font-size:11px;font-weight:600;color:#64748b;background:${safeSurface};padding:8px 10px;border-radius:8px;border:1px solid ${safeBorder};">
          📝 <strong>${t.notes}:</strong> ${escapeHtml(notesText)}
        </div>` : ""}

        ${template.sections.showAuthorizedSignature ? `
        <div style="margin-top:16px;border-top:1px dashed ${safeBorder};padding-top:12px;display:flex;align-items:flex-end;justify-content:space-between;">
          <div>
            ${safeStamp ? `<img src="${safeStamp}" alt="Stamp" style="height:48px;max-width:100px;object-fit:contain;margin-bottom:4px;" />` : ""}
            <div style="font-size:10px;font-weight:700;color:#64748b;">For ${companyName}</div>
          </div>
          <div style="text-align:right;">
            ${safeSignature ? `<img src="${safeSignature}" alt="Signature" style="height:36px;max-width:120px;object-fit:contain;margin-bottom:2px;" />` : `<div style="height:36px;width:120px;border-bottom:1px solid #94a3b8;margin-bottom:4px;"></div>`}
            <div style="font-size:10px;font-weight:900;color:#0f172a;text-transform:uppercase;">${t.authorizedSignatory}</div>
          </div>
        </div>` : ""}
      </div>

      <!-- Financial figures column -->
      <div style="min-width:260px;display:flex;flex-direction:column;gap:8px;">
        <div style="background:#ffffff;border:1px solid ${safeBorder};border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;">
            <span style="font-weight:700;color:#94a3b8;text-transform:uppercase;font-size:9px;letter-spacing:0.1em;">${t.grossPackage}</span>
            <span style="font-weight:900;color:#0f172a;">₹${(baseAmount || totalAmount).toLocaleString()}</span>
          </div>

          ${discount > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:11px;">
            <span style="font-weight:700;color:#94a3b8;text-transform:uppercase;font-size:9px;letter-spacing:0.1em;">${t.discount}</span>
            <span style="font-weight:900;color:#059669;">(–) ₹${discount.toLocaleString()}</span>
          </div>` : ""}

          ${showGstBreakup && gstRate > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:11px;">
            <span style="font-weight:700;color:#94a3b8;text-transform:uppercase;font-size:9px;letter-spacing:0.1em;">${t.gst} (${gstRate}%)</span>
            <span style="font-weight:900;color:${safePrimary};">${isTaxInclusive ? "(Incl.)" : "(+)"} ₹${taxAmount.toLocaleString()}</span>
          </div>` : ""}

          <div style="display:flex;justify-content:space-between;border-top:1px dashed ${safeBorder};padding-top:6px;font-size:12px;">
            <span style="font-weight:900;color:#0f172a;">${t.finalAmount}</span>
            <span style="font-weight:900;color:#0f172a;">₹${totalAmount.toLocaleString()}</span>
          </div>

          <div style="display:flex;justify-content:space-between;font-size:11px;">
            <span style="font-weight:700;color:#94a3b8;text-transform:uppercase;font-size:9px;letter-spacing:0.1em;">${t.advancePaid}</span>
            <span style="font-weight:900;color:#059669;">(–) ₹${advanceReceived.toLocaleString()}</span>
          </div>

          ${isCancelled && (cancellationCharge > 0 || refundAmount > 0) ? `
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#dc2626;">
            <span style="font-weight:700;text-transform:uppercase;font-size:9px;">${t.cancellationFee}</span>
            <span style="font-weight:900;">₹${cancellationCharge.toLocaleString()}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#d97706;">
            <span style="font-weight:700;text-transform:uppercase;font-size:9px;">${t.refundIssued}</span>
            <span style="font-weight:900;">₹${refundAmount.toLocaleString()}</span>
          </div>` : ""}

          <!-- Balance Due Highlight -->
          <div style="background:${layout === "minimal" ? safeSurface : safePrimary};border:${layout === "minimal" ? "2px solid " + safePrimary : "none"};border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;color:${layout === "minimal" ? safeText : "#ffffff"};margin-top:4px;">
            <div>
              <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;opacity:0.85;">${t.balancePayable}</div>
              <div style="font-size:24px;font-weight:900;color:${layout === "minimal" ? safePrimary : "#ffffff"};line-height:1.1;">₹${balance.toLocaleString()}</div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" style="opacity:0.25;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                 <polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>

        <!-- Optional UPI QR Box (rendered only if UPI ID is valid, section enabled, and balance > 0) -->
        ${qrDataUrl && template.sections.showUpiQr && balance > 0 && bankDetails.upiId && isValidUpiVpa(bankDetails.upiId) ? `
        <div style="background:#ffffff;border:1px solid ${safeBorder};border-radius:12px;padding:12px;text-align:center;">
          <img src="${qrDataUrl}" alt="UPI QR" style="width:110px;height:110px;display:inline-block;" />
          <div style="font-size:11px;font-weight:900;color:${safePrimary};margin-top:4px;">Scan to Pay via UPI</div>
          ${bankDetails.upiId ? `<div style="font-size:10px;color:#64748b;">${escapeHtml(bankDetails.upiId)}</div>` : ""}
        </div>` : ""}
      </div>
    </div>

    <!-- FOOTER SECTION -->
    <div style="background:${safeSurface};border-top:1px solid ${safeBorder};padding:16px 36px;text-align:center;">
      <h3 style="font-size:14px;font-weight:900;color:#0f172a;">${escapeHtml(template.footer.customText || t.wishJourney)}</h3>
      ${template.footer.showWebsite ? `<p style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.25em;color:${safePrimary};opacity:0.85;margin-top:2px;">${(companyName || "yatrahub").toLowerCase().replace(/[^a-z0-9]/g, "")}.com</p>` : ""}
    </div>
  </div>
  ${isLastCopy ? "" : `<div class="page-break"></div>`}
  `
}
