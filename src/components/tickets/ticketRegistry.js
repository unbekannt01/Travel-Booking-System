/**
 * Modular Ticket Templates System for YatraHub Bus Operators
 * Provides 6 professionally designed ticket styles:
 * 1. Classic - Perforated two-panel airline/bus boarding pass
 * 2. Modern - Contemporary minimalist card with pill tags & gradient accents
 * 3. Heritage - Traditional Indian pilgrimage "शुभ यात्रा" aesthetic
 * 4. Corporate - Slate & Navy executive travel voucher with GST counterfoil
 * 5. Thermal - High-density conductor slip / rapid-scan ticket
 * 6. Transit - Vibrant intercity express pass with color-coded deck badges
 */

import { getDocumentTranslation } from "../../i18n/documents.js"
import { formatDisplayDate } from "../../utils/date.js"
import { maskAadhaar } from "../../utils/formatters.js"

export const TICKET_TEMPLATES = [
  {
    id: "classic",
    name: "Classic Express",
    badge: "Most Popular",
    description: "Traditional two-panel boarding pass with dashed tear-off stub and bold seat numbers.",
    accentDefault: "#4f46e5",
    previewStyle: "Bordered dual-column with perforated divider",
  },
  {
    id: "modern",
    name: "Modern Minimalist",
    badge: "Contemporary",
    description: "Sleek, rounded travel card featuring pill tags, clean metrics, and soft shadows.",
    accentDefault: "#0284c7",
    previewStyle: "Clean cards, pill badges, and airy typography",
  },
  {
    id: "heritage",
    name: "Royal Yatra",
    badge: "Pilgrimage",
    description: "Traditional Indian yatra aesthetic with devotional borders, blessings, and warm tones.",
    accentDefault: "#b45309",
    previewStyle: "Saffron/gold accents, auspicious header, ornate frames",
  },
  {
    id: "corporate",
    name: "Corporate Executive",
    badge: "Business",
    description: "Formal slate/navy layout with full tax/GST credentials, counterfoil, and sign block.",
    accentDefault: "#1e293b",
    previewStyle: "Structured corporate grid with conductor inspection box",
  },
  {
    id: "thermal",
    name: "Conductor Slip",
    badge: "Compact",
    description: "High-density thermal receipt layout with monospace accents and fast-check QR.",
    accentDefault: "#0f172a",
    previewStyle: "Compact receipt card with high-contrast legibility",
  },
  {
    id: "transit",
    name: "Metro Transit",
    badge: "Vibrant",
    description: "Dynamic route styling with color-coded Upper/Lower deck badges and departure board timeline.",
    accentDefault: "#059669",
    previewStyle: "Deck color badges, route timeline, vibrant status tags",
  },
]

export const getTicketTemplate = (id) => {
  const found = TICKET_TEMPLATES.find((t) => t.id === id)
  return found || TICKET_TEMPLATES[0]
}

const getDeckLabel = (seatId) => {
  if (!seatId) return "Seat"
  const s = seatId.toLowerCase()
  if (s.startsWith("lower") || s.includes("-l") || s.startsWith("l")) return "Lower Deck"
  if (s.startsWith("upper") || s.includes("-u") || s.startsWith("u")) return "Upper Deck"
  return "Reserved"
}

/**
 * Builds HTML snippet for a single passenger ticket in the selected template style.
 */
export const buildSingleTicketCardHTML = ({
  templateId = "classic",
  booking,
  pax,
  idx,
  qrUrl,
  user,
  departure,
  lang = "en",
}) => {
  const t = getDocumentTranslation(lang)
  const accentColor = user?.invoiceColor || getTicketTemplate(templateId).accentDefault
  const companyName = user?.companyName || "YATRA TOURS"
  const companyPhone = user?.companyPhone || ""
  const companyHQ = user?.companyHeadquarters || ""
  const companyTagline = user?.companyTagline || "Tourism & Travels"
  const gstNumber = user?.gstNumber || ""

  const busNumber =
    departure?.busNumber ||
    booking?.busNumber ||
    booking?.busType ||
    "AC Sleeper Coach"

  const primaryOrganizer = user?.organizers?.[0]
  const organizerContact = primaryOrganizer
    ? `${primaryOrganizer.name} (${primaryOrganizer.phone})`
    : companyPhone || "Operator Office"

  const seat = pax.seatId || `P${idx + 1}`
  const deckLabel = getDeckLabel(seat)
  const isPaid = (booking.advanceReceived || 0) >= (booking.totalAmount || 0)
  const dueAmount = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0))
  const journeyDateFormatted = formatDisplayDate(booking.journeyDate)
  const maskedAadhaarVal = pax.aadhar ? maskAadhaar(pax.aadhar) : "—"

  // ─────────────────────────────────────────────────────────────
  // TEMPLATE 1: CLASSIC
  // ─────────────────────────────────────────────────────────────
  if (templateId === "classic") {
    return `
      <div class="ticket-classic">
        <div class="classic-main">
          <div class="classic-header">
            <div>
              <h2 class="brand-title" style="color: ${accentColor};">${companyName.toUpperCase()}</h2>
              <p class="brand-tagline">${companyTagline}</p>
              <p class="brand-sub">${companyHQ ? "📍 " + companyHQ : ""} ${companyPhone ? " | 📞 " + companyPhone : ""}</p>
            </div>
            <div class="ticket-badge">
              <span class="badge-pill" style="background: ${accentColor};">${t.boardingPass.toUpperCase()}</span>
              <span class="badge-sub-text">Invoice #${booking.invoiceNo}</span>
            </div>
          </div>

          <div class="classic-tour-strip">
            <div>
              <span class="label-tiny">${t.tourName.toUpperCase()}</span>
              <div class="title-bold">${booking.tourName}</div>
            </div>
            <div style="text-align: right;">
              <span class="label-tiny">${t.journeyDate.toUpperCase()}</span>
              <div class="date-bold" style="color: ${accentColor};">${journeyDateFormatted}</div>
            </div>
          </div>

          <div class="classic-grid">
            <div>
              <span class="label-tiny">${t.travelerName.toUpperCase()}</span>
              <div class="val-bold">${pax.name || "Passenger " + (idx + 1)}</div>
              <div class="val-sub">${pax.age ? pax.age + " Yrs" : ""} • ${pax.gender || ""} • ${pax.city || ""}</div>
              ${pax.aadhar ? `<div class="val-sub">ID: ${maskedAadhaarVal}</div>` : ""}
            </div>
            <div>
              <span class="label-tiny">${t.busNumber.toUpperCase()}</span>
              <div class="val-bold">${busNumber}</div>
              <div class="val-sub">Reporting: 30m prior</div>
            </div>
            <div>
              <span class="label-tiny">${t.emergencyContact.toUpperCase()}</span>
              <div class="val-bold">${organizerContact}</div>
              <div class="val-sub">Lead: ${booking.contactName}</div>
            </div>
          </div>

          <div class="classic-instructions">
            <span class="inst-head">⚑ ${t.importantInstructions}</span>
            <p>• ${t.inst1} • ${t.inst2}</p>
          </div>
        </div>

        <div class="classic-stub">
          <div class="stub-notch top"></div>
          <div class="stub-notch bottom"></div>
          <span class="deck-tag">${deckLabel.toUpperCase()}</span>
          <div class="seat-huge" style="color: ${accentColor};">${seat}</div>
          <span class="seat-label">${t.seatNumber}</span>

          <div class="qr-box">
            ${qrUrl ? `<img src="${qrUrl}" alt="QR" class="qr-img"/>` : `<div class="qr-ph">QR</div>`}
            <span class="qr-code-text">${booking.invoiceNo}-${seat}</span>
          </div>

          <div class="pay-tag ${isPaid ? "paid" : "due"}">
            ${isPaid ? t.confirmed : `Due ₹${dueAmount.toLocaleString()}`}
          </div>
          <span class="scan-verify">${t.scanVerification}</span>
        </div>
      </div>
    `
  }

  // ─────────────────────────────────────────────────────────────
  // TEMPLATE 2: MODERN MINIMALIST
  // ─────────────────────────────────────────────────────────────
  if (templateId === "modern") {
    return `
      <div class="ticket-modern">
        <div class="modern-accent-bar" style="background: linear-gradient(90deg, ${accentColor}, #0284c7);"></div>
        <div class="modern-body">
          <div class="modern-header">
            <div class="modern-brand">
              <span class="modern-logo-dot" style="background: ${accentColor};"></span>
              <div>
                <h3 class="modern-company">${companyName}</h3>
                <p class="modern-route">${booking.tourName}</p>
              </div>
            </div>
            <div class="modern-date-badge">
              <span class="modern-date">${journeyDateFormatted}</span>
              <span class="modern-inv">#${booking.invoiceNo}</span>
            </div>
          </div>

          <div class="modern-content">
            <div class="modern-details">
              <div class="modern-data-row">
                <div class="modern-cell">
                  <span class="m-lbl">TRAVELER</span>
                  <p class="m-val">${pax.name || "Passenger " + (idx + 1)}</p>
                  <span class="m-sub">${pax.age ? pax.age + " Y" : ""} ${pax.gender || ""} • ${pax.city || ""}</span>
                </div>
                <div class="modern-cell">
                  <span class="m-lbl">BUS & COACH</span>
                  <p class="m-val">${busNumber}</p>
                  <span class="m-sub">${deckLabel}</span>
                </div>
                <div class="modern-cell">
                  <span class="m-lbl">EMERGENCY ASSISTANCE</span>
                  <p class="m-val">${organizerContact}</p>
                  <span class="m-sub">Lead: ${booking.contactPhone}</span>
                </div>
              </div>

              <div class="modern-notes">
                <span class="m-note-pill">Aadhaar ID Mandatory</span>
                <span class="m-note-pill">Report 30 mins before</span>
                <span class="m-note-pill ${isPaid ? "pill-paid" : "pill-due"}">${isPaid ? "PAID" : `DUE ₹${dueAmount}`}</span>
              </div>
            </div>

            <div class="modern-qr-card">
              <div class="m-seat-circle" style="border-color: ${accentColor}; color: ${accentColor};">
                ${seat}
              </div>
              <span class="m-seat-lbl">ASSIGNED BERTH</span>
              ${qrUrl ? `<img src="${qrUrl}" alt="QR" class="modern-qr-img"/>` : ""}
              <span class="m-code">${booking.invoiceNo}-${seat}</span>
            </div>
          </div>
        </div>
      </div>
    `
  }

  // ─────────────────────────────────────────────────────────────
  // TEMPLATE 3: ROYAL YATRA HERITAGE
  // ─────────────────────────────────────────────────────────────
  if (templateId === "heritage") {
    return `
      <div class="ticket-heritage">
        <div class="heritage-border">
          <div class="heritage-top">
            <div class="heritage-symbol">🕉 ॥ शुभ यात्रा ॥ 卐</div>
            <h2 class="heritage-title" style="color: ${accentColor};">${companyName.toUpperCase()}</h2>
            <p class="heritage-tag">${companyTagline} • Yatra Travel Pass</p>
            <p class="heritage-hq">${companyHQ ? "📍 " + companyHQ : ""} ${companyPhone ? " • 📞 " + companyPhone : ""}</p>
          </div>

          <div class="heritage-strip" style="border-color: ${accentColor};">
            <div class="heritage-col">
              <span class="h-lbl">तीर्थ यात्रा / TOUR</span>
              <span class="h-val-lg">${booking.tourName}</span>
            </div>
            <div class="heritage-col" style="text-align: right;">
              <span class="h-lbl">यात्रा तिथि / DATE</span>
              <span class="h-val-lg" style="color: ${accentColor};">${journeyDateFormatted}</span>
            </div>
          </div>

          <div class="heritage-main">
            <div class="heritage-pax-box">
              <div class="h-row">
                <div>
                  <span class="h-lbl">यात्री का नाम / TRAVELER NAME</span>
                  <div class="h-pax-name">${pax.name || "Passenger " + (idx + 1)}</div>
                  <div class="h-pax-sub">${pax.age ? pax.age + " वर्ष" : ""} • ${pax.gender || ""} • शहर: ${pax.city || "—"}</div>
                  ${pax.aadhar ? `<div class="h-pax-sub">आधार: ${maskedAadhaarVal}</div>` : ""}
                </div>
                <div>
                  <span class="h-lbl">बस क्रमांक / COACH NO.</span>
                  <div class="h-pax-name">${busNumber}</div>
                  <div class="h-pax-sub">रसीद / INV: #${booking.invoiceNo}</div>
                </div>
                <div>
                  <span class="h-lbl">आयोजक संपर्क / ASSISTANCE</span>
                  <div class="h-pax-name">${organizerContact}</div>
                  <div class="h-pax-sub">मुख्य ग्राहक: ${booking.contactName}</div>
                </div>
              </div>

              <div class="heritage-guidelines">
                <p><strong>मार्गदर्शन:</strong> कृपया मूल पहचान पत्र (आधार कार्ड) साथ रखें। प्रस्थान समय से ३० मिनट पूर्व पहुंचे। ईश्वर आपकी यात्रा मंगलमय करे।</p>
              </div>
            </div>

            <div class="heritage-seat-stub" style="border-left-color: ${accentColor};">
              <span class="h-deck">${deckLabel.toUpperCase()}</span>
              <div class="h-seat" style="color: ${accentColor};">${seat}</div>
              <span class="h-seat-label">आरक्षित सीट / SEAT</span>

              <div class="h-qr">
                ${qrUrl ? `<img src="${qrUrl}" alt="QR" class="qr-img"/>` : ""}
              </div>

              <div class="h-status ${isPaid ? "h-paid" : "h-due"}">
                ${isPaid ? "भुगतान पूर्ण (PAID)" : `शेष: ₹${dueAmount}`}
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  // ─────────────────────────────────────────────────────────────
  // TEMPLATE 4: CORPORATE EXECUTIVE
  // ─────────────────────────────────────────────────────────────
  if (templateId === "corporate") {
    return `
      <div class="ticket-corporate">
        <div class="corp-header">
          <div>
            <div class="corp-company">${companyName.toUpperCase()}</div>
            <div class="corp-meta">${companyTagline} | ${companyHQ || "Corporate Operations"} ${gstNumber ? " | GSTIN: " + gstNumber : ""}</div>
          </div>
          <div class="corp-doc-type">
            <span class="corp-badge">EXECUTIVE TRAVEL VOUCHER</span>
            <span class="corp-ref">REF: ${booking.invoiceNo}</span>
          </div>
        </div>

        <div class="corp-banner">
          <div class="corp-block">
            <span class="c-lbl">TOUR DESTINATION</span>
            <div class="c-val-bold">${booking.tourName}</div>
          </div>
          <div class="corp-block">
            <span class="c-lbl">DEPARTURE DATE</span>
            <div class="c-val-bold">${journeyDateFormatted}</div>
          </div>
          <div class="corp-block">
            <span class="c-lbl">ASSIGNED COACH</span>
            <div class="c-val-bold">${busNumber}</div>
          </div>
          <div class="corp-block">
            <span class="c-lbl">BERTH & DECK</span>
            <div class="c-val-bold" style="color: #2563eb;">SEAT ${seat} (${deckLabel})</div>
          </div>
        </div>

        <div class="corp-body">
          <table class="corp-table">
            <thead>
              <tr>
                <th>PASSENGER NAME</th>
                <th>DEMOGRAPHICS</th>
                <th>GOVT ID (MASKED)</th>
                <th>OPERATOR CONTACT</th>
                <th>PAYMENT CLEARANCE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold">${pax.name || "Passenger " + (idx + 1)}</td>
                <td>${pax.age ? pax.age + " Y" : "—"} / ${pax.gender || "—"} (${pax.city || "—"})</td>
                <td>${maskedAadhaarVal}</td>
                <td>${organizerContact}</td>
                <td class="font-bold ${isPaid ? "text-emerald-700" : "text-amber-700"}">
                  ${isPaid ? "CLEARED / FULLY PAID" : `BALANCE PENDING: ₹${dueAmount}`}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="corp-footer-grid">
            <div class="corp-instructions">
              <span class="c-lbl">TERMS & REGULATORY NOTICE</span>
              <p>• Boarding requires government photo identification. Reporting required 30 minutes prior to scheduled departure. Non-transferable ticket voucher.</p>
            </div>
            <div class="corp-counterfoil">
              <div class="corp-qr-wrap">
                ${qrUrl ? `<img src="${qrUrl}" alt="QR" class="corp-qr"/>` : ""}
                <div class="corp-sign-box">
                  <div class="sign-space"></div>
                  <span>CONDUCTOR STAMP & SIGN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  // ─────────────────────────────────────────────────────────────
  // TEMPLATE 5: CONDUCER SLIP / THERMAL
  // ─────────────────────────────────────────────────────────────
  if (templateId === "thermal") {
    return `
      <div class="ticket-thermal">
        <div class="thermal-box">
          <div class="thermal-top">
            <h4 class="th-company">${companyName}</h4>
            <p class="th-phone">Tel: ${companyPhone || organizerContact}</p>
            <div class="th-dashed"></div>
            <div class="th-inv-row">
              <span>INV: #${booking.invoiceNo}</span>
              <span>DATE: ${journeyDateFormatted}</span>
            </div>
            <div class="th-tour">${booking.tourName}</div>
          </div>

          <div class="thermal-body">
            <div class="th-seat-banner">
              <div class="th-deck">${deckLabel.toUpperCase()}</div>
              <div class="th-seat">${seat}</div>
              <div class="th-coach">COACH: ${busNumber}</div>
            </div>

            <div class="th-pax">
              <div class="th-row"><span>PAX:</span> <strong>${pax.name || "Passenger " + (idx + 1)}</strong></div>
              <div class="th-row"><span>AGE/GEN:</span> <span>${pax.age || "—"} / ${pax.gender || "—"}</span></div>
              <div class="th-row"><span>CITY:</span> <span>${pax.city || "—"}</span></div>
              ${pax.aadhar ? `<div class="th-row"><span>AADHAAR:</span> <span>${maskedAadhaarVal}</span></div>` : ""}
              <div class="th-row"><span>LEAD:</span> <span>${booking.contactName} (${booking.contactPhone})</span></div>
              <div class="th-row th-fare">
                <span>STATUS:</span>
                <strong>${isPaid ? "PAID" : `DUE ₹${dueAmount}`}</strong>
              </div>
            </div>

            <div class="thermal-qr-box">
              ${qrUrl ? `<img src="${qrUrl}" alt="QR" class="thermal-qr"/>` : ""}
              <div class="th-code">${booking.invoiceNo}-${seat}</div>
            </div>
          </div>

          <div class="th-dashed"></div>
          <div class="th-rules">
            * CARRY ORIGINAL PHOTO ID * REPORT 30 MINS PRIOR * WISH YOU HAPPY JOURNEY *
          </div>
        </div>
      </div>
    `
  }

  // ─────────────────────────────────────────────────────────────
  // TEMPLATE 6: METRO TRANSIT
  // ─────────────────────────────────────────────────────────────
  return `
    <div class="ticket-transit">
      <div class="transit-main">
        <div class="transit-header">
          <div>
            <div class="transit-route-badge">EXPRESS COACH TRANSIT</div>
            <h2 class="transit-company" style="color: ${accentColor};">${companyName.toUpperCase()}</h2>
            <p class="transit-tour">${booking.tourName}</p>
          </div>
          <div class="transit-date-box">
            <span class="tr-lbl">JOURNEY DATE</span>
            <div class="tr-date">${journeyDateFormatted}</div>
            <span class="tr-inv">Ticket #${booking.invoiceNo}</span>
          </div>
        </div>

        <div class="transit-grid">
          <div class="transit-card">
            <span class="tr-lbl">PASSENGER</span>
            <div class="tr-val">${pax.name || "Passenger " + (idx + 1)}</div>
            <div class="tr-sub">${pax.age ? pax.age + " Y" : ""} ${pax.gender || ""} • ${pax.city || ""}</div>
          </div>
          <div class="transit-card">
            <span class="tr-lbl">COACH ASSIGNED</span>
            <div class="tr-val">${busNumber}</div>
            <div class="tr-sub">${organizerContact}</div>
          </div>
          <div class="transit-card">
            <span class="tr-lbl">PAYMENT STATUS</span>
            <div class="tr-val ${isPaid ? "text-green" : "text-amber"}">${isPaid ? "FULLY PAID" : `DUE ₹${dueAmount}`}</div>
            <div class="tr-sub">${booking.contactPhone}</div>
          </div>
        </div>

        <div class="transit-notice">
          <span>✓ Valid Government Photo ID Mandatory</span>
          <span>✓ Boarding closes 15 mins prior to departure</span>
        </div>
      </div>

      <div class="transit-stub">
        <div class="transit-deck-pill ${deckLabel.toLowerCase().includes("upper") ? "deck-upper" : "deck-lower"}">
          ${deckLabel.toUpperCase()}
        </div>
        <div class="transit-seat" style="color: ${accentColor};">${seat}</div>
        <span class="tr-lbl">BERTH ASSIGNMENT</span>

        <div class="transit-qr-wrap">
          ${qrUrl ? `<img src="${qrUrl}" alt="QR" class="qr-img"/>` : ""}
          <span class="tr-qr-code">${booking.invoiceNo}-${seat}</span>
        </div>

        <div class="transit-footer">
          <span>BOARDING PASS</span>
        </div>
      </div>
    </div>
  `
}

/**
 * Builds the complete printable HTML document containing tickets for all passengers.
 */
export const buildBatchPrintableTicketsHTML = ({
  templateId = "classic",
  booking,
  passengersWithQRs = [],
  user,
  departure,
  lang = "en",
}) => {
  const ticketsHTML = passengersWithQRs
    .map(({ pax, idx, qrUrl }) =>
      buildSingleTicketCardHTML({
        templateId,
        booking,
        pax,
        idx,
        qrUrl,
        user,
        departure,
        lang,
      })
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Tickets - #${booking.invoiceNo} - ${booking.tourName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    background: #f8fafc;
    color: #0f172a;
    padding: 20px;
    font-size: 11px;
  }

  /* ─────────────────────────────────────────────────────────────
     1. CLASSIC STYLES
     ───────────────────────────────────────────────────────────── */
  .ticket-classic {
    max-width: 820px;
    margin: 0 auto 24px;
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 16px;
    display: flex;
    overflow: hidden;
    box-shadow: 0 4px 18px rgba(0,0,0,0.06);
    page-break-after: always;
  }
  .ticket-classic:last-child { page-break-after: avoid; }
  .classic-main {
    flex: 1;
    padding: 22px 26px;
    border-right: 2px dashed #cbd5e1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .classic-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 10px;
  }
  .brand-title { font-size: 19px; font-weight: 900; letter-spacing: -0.02em; }
  .brand-tagline { font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
  .brand-sub { font-size: 9.5px; font-weight: 600; color: #94a3b8; margin-top: 2px; }
  .ticket-badge { text-align: right; }
  .badge-pill { display: inline-block; color: #fff; font-size: 9.5px; font-weight: 900; padding: 3px 10px; border-radius: 999px; letter-spacing: 0.12em; }
  .badge-sub-text { display: block; font-size: 9px; font-weight: 700; color: #94a3b8; margin-top: 3px; }
  .classic-tour-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 14px;
    margin: 12px 0;
  }
  .label-tiny { display: block; font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
  .title-bold { font-size: 15px; font-weight: 900; color: #0f172a; }
  .date-bold { font-size: 14px; font-weight: 900; }
  .classic-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
  .val-bold { font-size: 12.5px; font-weight: 900; color: #0f172a; }
  .val-sub { font-size: 9.5px; font-weight: 600; color: #64748b; margin-top: 1px; }
  .classic-instructions { background: #f8fafc; border-radius: 8px; padding: 8px 12px; border: 1px solid #f1f5f9; font-size: 8.5px; color: #64748b; }
  .inst-head { display: block; font-weight: 900; text-transform: uppercase; color: #334155; margin-bottom: 2px; }
  .classic-stub {
    width: 210px;
    background: #fafafa;
    padding: 22px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    position: relative;
  }
  .deck-tag { font-size: 8.5px; font-weight: 900; letter-spacing: 0.12em; color: #64748b; text-transform: uppercase; }
  .seat-huge { font-size: 32px; font-weight: 900; letter-spacing: -0.04em; line-height: 1.1; }
  .seat-label { font-size: 8.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
  .qr-box { margin: 8px 0; }
  .qr-img { width: 100px; height: 100px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 3px; background: #fff; }
  .qr-ph { width: 100px; height: 100px; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #64748b; }
  .qr-code-text { display: block; font-size: 8.5px; font-family: monospace; font-weight: 800; color: #475569; margin-top: 3px; }
  .pay-tag { display: inline-block; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; }
  .pay-tag.paid { background: #ecfdf5; color: #059669; }
  .pay-tag.due { background: #fffbeb; color: #b45309; }
  .scan-verify { font-size: 7.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }

  /* ─────────────────────────────────────────────────────────────
     2. MODERN STYLES
     ───────────────────────────────────────────────────────────── */
  .ticket-modern {
    max-width: 820px;
    margin: 0 auto 24px;
    background: #ffffff;
    border-radius: 20px;
    border: 1px solid #cbd5e1;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    page-break-after: always;
  }
  .ticket-modern:last-child { page-break-after: avoid; }
  .modern-accent-bar { height: 6px; width: 100%; }
  .modern-body { padding: 22px 26px; }
  .modern-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px; }
  .modern-brand { display: flex; align-items: center; gap: 10px; }
  .modern-logo-dot { width: 12px; height: 12px; border-radius: 999px; }
  .modern-company { font-size: 17px; font-weight: 900; color: #0f172a; }
  .modern-route { font-size: 11px; font-weight: 700; color: #64748b; }
  .modern-date-badge { text-align: right; }
  .modern-date { display: block; font-size: 13px; font-weight: 800; color: #0f172a; }
  .modern-inv { font-size: 9.5px; font-weight: 700; color: #94a3b8; font-family: monospace; }
  .modern-content { display: flex; gap: 20px; align-items: center; }
  .modern-details { flex: 1; }
  .modern-data-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }
  .modern-cell { background: #f8fafc; border-radius: 12px; padding: 10px 12px; border: 1px solid #e2e8f0; }
  .m-lbl { display: block; font-size: 8px; font-weight: 900; color: #94a3b8; letter-spacing: 0.08em; margin-bottom: 2px; }
  .m-val { font-size: 12px; font-weight: 900; color: #0f172a; }
  .m-sub { font-size: 9px; font-weight: 600; color: #64748b; }
  .modern-notes { display: flex; gap: 6px; flex-wrap: wrap; }
  .m-note-pill { background: #f1f5f9; color: #475569; font-size: 8.5px; font-weight: 800; padding: 3px 8px; border-radius: 999px; }
  .pill-paid { background: #ecfdf5; color: #047857; }
  .pill-due { background: #fffbeb; color: #b45309; }
  .modern-qr-card { width: 140px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; text-align: center; }
  .m-seat-circle { font-size: 22px; font-weight: 900; border: 2px solid; border-radius: 12px; padding: 2px 0; margin-bottom: 2px; }
  .m-seat-lbl { font-size: 7.5px; font-weight: 800; color: #94a3b8; letter-spacing: 0.1em; display: block; margin-bottom: 6px; }
  .modern-qr-img { width: 85px; height: 85px; margin: 0 auto; display: block; border-radius: 6px; }
  .m-code { display: block; font-size: 8px; font-family: monospace; color: #64748b; margin-top: 4px; }

  /* ─────────────────────────────────────────────────────────────
     3. HERITAGE STYLES
     ───────────────────────────────────────────────────────────── */
  .ticket-heritage {
    max-width: 820px;
    margin: 0 auto 24px;
    background: #fffcf8;
    border: 3px double #d97706;
    border-radius: 14px;
    padding: 12px;
    page-break-after: always;
  }
  .ticket-heritage:last-child { page-break-after: avoid; }
  .heritage-border { border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; }
  .heritage-top { text-align: center; margin-bottom: 12px; }
  .heritage-symbol { font-size: 12px; font-weight: 900; color: #b45309; letter-spacing: 0.2em; }
  .heritage-title { font-size: 20px; font-weight: 900; letter-spacing: 0.04em; }
  .heritage-tag { font-size: 9.5px; font-weight: 800; color: #92400e; text-transform: uppercase; }
  .heritage-hq { font-size: 9px; color: #78350f; margin-top: 2px; }
  .heritage-strip { display: flex; justify-content: space-between; border-top: 2px solid; border-bottom: 2px solid; padding: 8px 12px; margin-bottom: 12px; background: #fffbeb; }
  .h-lbl { display: block; font-size: 8px; font-weight: 900; color: #92400e; letter-spacing: 0.08em; }
  .h-val-lg { font-size: 14px; font-weight: 900; color: #451a03; }
  .heritage-main { display: flex; gap: 16px; }
  .heritage-pax-box { flex: 1; }
  .h-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }
  .h-pax-name { font-size: 13px; font-weight: 900; color: #451a03; }
  .h-pax-sub { font-size: 9px; color: #78350f; }
  .heritage-guidelines { background: #fef3c7; border-radius: 6px; padding: 6px 10px; font-size: 8.5px; color: #78350f; border-left: 3px solid #d97706; }
  .heritage-seat-stub { width: 150px; text-align: center; border-left: 2px dashed; padding-left: 14px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; }
  .h-deck { font-size: 8px; font-weight: 900; color: #92400e; }
  .h-seat { font-size: 28px; font-weight: 900; line-height: 1.1; }
  .h-seat-label { font-size: 8px; font-weight: 800; color: #b45309; }
  .h-qr { margin: 6px 0; }
  .h-status { font-size: 8.5px; font-weight: 900; padding: 2px 6px; border-radius: 4px; }
  .h-paid { background: #dcfce7; color: #166534; }
  .h-due { background: #fee2e2; color: #991b1b; }

  /* ─────────────────────────────────────────────────────────────
     4. CORPORATE STYLES
     ───────────────────────────────────────────────────────────── */
  .ticket-corporate {
    max-width: 820px;
    margin: 0 auto 24px;
    background: #ffffff;
    border: 2px solid #0f172a;
    border-radius: 8px;
    padding: 16px 20px;
    page-break-after: always;
  }
  .ticket-corporate:last-child { page-break-after: avoid; }
  .corp-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
  .corp-company { font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em; }
  .corp-meta { font-size: 9px; color: #475569; font-weight: 600; margin-top: 2px; }
  .corp-doc-type { text-align: right; }
  .corp-badge { display: inline-block; background: #0f172a; color: #fff; font-size: 8.5px; font-weight: 900; padding: 2px 8px; border-radius: 3px; letter-spacing: 0.1em; }
  .corp-ref { display: block; font-size: 9px; font-family: monospace; font-weight: 800; color: #64748b; margin-top: 2px; }
  .corp-banner { display: grid; grid-template-columns: repeat(4, 1fr); background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; margin-bottom: 12px; gap: 8px; }
  .c-lbl { display: block; font-size: 7.5px; font-weight: 900; color: #64748b; letter-spacing: 0.08em; }
  .c-val-bold { font-size: 11.5px; font-weight: 900; color: #0f172a; margin-top: 2px; }
  .corp-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .corp-table th { background: #f1f5f9; padding: 5px 8px; font-size: 8px; font-weight: 800; text-align: left; border: 1px solid #cbd5e1; }
  .corp-table td { padding: 6px 8px; font-size: 9.5px; border: 1px solid #cbd5e1; }
  .corp-footer-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  .corp-instructions p { font-size: 8.5px; color: #64748b; margin-top: 2px; line-height: 1.4; }
  .corp-qr-wrap { display: flex; align-items: center; gap: 10px; justify-content: flex-end; }
  .corp-qr { width: 75px; height: 75px; border: 1px solid #cbd5e1; padding: 2px; }
  .corp-sign-box { text-align: center; }
  .sign-space { width: 110px; height: 35px; border-bottom: 1px dashed #94a3b8; }
  .corp-sign-box span { font-size: 7.5px; font-weight: 800; color: #64748b; display: block; margin-top: 3px; }

  /* ─────────────────────────────────────────────────────────────
     5. THERMAL STYLES
     ───────────────────────────────────────────────────────────── */
  .ticket-thermal {
    max-width: 520px;
    margin: 0 auto 24px;
    page-break-after: always;
  }
  .ticket-thermal:last-child { page-break-after: avoid; }
  .thermal-box {
    background: #ffffff;
    border: 2px dashed #0f172a;
    padding: 16px 20px;
    font-family: "Courier New", Courier, monospace;
  }
  .thermal-top { text-align: center; }
  .th-company { font-size: 16px; font-weight: 900; }
  .th-phone { font-size: 9.5px; color: #475569; }
  .th-dashed { border-top: 1px dashed #0f172a; margin: 8px 0; }
  .th-inv-row { display: flex; justify-content: space-between; font-size: 9.5px; font-weight: 700; }
  .th-tour { font-size: 13px; font-weight: 900; margin: 4px 0; }
  .thermal-body { display: flex; gap: 14px; align-items: center; margin: 8px 0; }
  .th-seat-banner { background: #0f172a; color: #fff; padding: 10px; border-radius: 6px; text-align: center; min-width: 90px; }
  .th-deck { font-size: 8px; letter-spacing: 0.1em; }
  .th-seat { font-size: 24px; font-weight: 900; margin: 2px 0; }
  .th-coach { font-size: 8px; }
  .th-pax { flex: 1; font-size: 9px; line-height: 1.5; }
  .th-row { display: flex; justify-content: space-between; }
  .th-fare { border-top: 1px solid #e2e8f0; margin-top: 4px; padding-top: 2px; }
  .thermal-qr-box { text-align: center; }
  .thermal-qr { width: 75px; height: 75px; }
  .th-code { font-size: 8px; font-weight: 700; }
  .th-rules { font-size: 7.5px; text-align: center; color: #64748b; letter-spacing: 0.05em; }

  /* ─────────────────────────────────────────────────────────────
     6. METRO TRANSIT STYLES
     ───────────────────────────────────────────────────────────── */
  .ticket-transit {
    max-width: 820px;
    margin: 0 auto 24px;
    background: #ffffff;
    border-radius: 16px;
    border: 2px solid #e2e8f0;
    display: flex;
    overflow: hidden;
    page-break-after: always;
  }
  .ticket-transit:last-child { page-break-after: avoid; }
  .transit-main { flex: 1; padding: 20px 24px; }
  .transit-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px; }
  .transit-route-badge { display: inline-block; background: #059669; color: #fff; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.08em; margin-bottom: 4px; }
  .transit-company { font-size: 18px; font-weight: 900; }
  .transit-tour { font-size: 13px; font-weight: 800; color: #1e293b; }
  .transit-date-box { text-align: right; }
  .tr-lbl { display: block; font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 0.08em; }
  .tr-date { font-size: 13px; font-weight: 900; color: #0f172a; }
  .tr-inv { font-size: 9px; color: #64748b; font-family: monospace; }
  .transit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
  .transit-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; }
  .tr-val { font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 2px; }
  .tr-sub { font-size: 8.5px; color: #64748b; }
  .transit-notice { display: flex; justify-content: space-between; font-size: 8.5px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 6px 12px; border-radius: 8px; }
  .transit-stub { width: 190px; background: #f8fafc; border-left: 2px dashed #cbd5e1; padding: 20px 14px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; }
  .transit-deck-pill { font-size: 8.5px; font-weight: 900; padding: 3px 10px; border-radius: 999px; letter-spacing: 0.1em; color: #fff; }
  .deck-lower { background: #059669; }
  .deck-upper { background: #4f46e5; }
  .transit-seat { font-size: 32px; font-weight: 900; line-height: 1.1; margin: 4px 0; }
  .transit-qr-wrap { margin: 8px 0; }
  .tr-qr-code { display: block; font-size: 8px; font-family: monospace; color: #475569; margin-top: 2px; }
  .transit-footer { font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 0.1em; }
  .text-green { color: #059669 !important; }
  .text-amber { color: #d97706 !important; }

  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    body { background: #ffffff; padding: 0; }
  }
</style>
</head>
<body>
  ${ticketsHTML}
</body>
</html>`
}
