/**
 * YatraHub (TBS) — Pure Customer Statement HTML Renderer (Part 5b)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (PDF/HTML export) and frontend (sandbox iframe preview, print).
 *
 * SECURITY:
 * - Injects strict CSP: default-src 'none'; style-src 'unsafe-inline'; img-src data:;
 * - Escapes all user inputs, customer fields, and notes via escapeHtml.
 * - Enforces safe image data URIs or relative paths via sanitizeImageUrl.
 */

import { escapeHtml, sanitizeHexColor, sanitizeImageUrl } from "./escapeHtml.js"

export const STATEMENT_I18N = Object.freeze({
  en: {
    title: "ACCOUNT STATEMENT",
    subtitle: "Customer Ledger & Payment Summary",
    statementPeriod: "Statement Period",
    asOf: "As of",
    allTime: "All Time",
    customerDetails: "Customer Information",
    phone: "Phone",
    email: "Email",
    city: "City",
    address: "Address",
    gstin: "GSTIN",
    openingBalance: "Opening Balance",
    totalDebits: "Total Debits",
    totalCredits: "Total Credits",
    closingBalance: "Closing Balance (Due)",
    date: "Date",
    ref: "Ref / Doc",
    description: "Transaction Description",
    debit: "Debit (₹)",
    credit: "Credit (₹)",
    balance: "Balance (₹)",
    noTransactions: "No transactions recorded for this period.",
    computerGenerated: "This is a computer-generated account statement and does not require a physical signature.",
    authorizedSignatory: "Authorized Signatory",
    thankYou: "Thank you for choosing us for your journeys!",
  },
  hi: {
    title: "खाता विवरण",
    subtitle: "ग्राहक खाता एवं भुगतान सारांश",
    statementPeriod: "विवरण अवधि",
    asOf: "दिनांक तक",
    allTime: "शुरुआत से अब तक",
    customerDetails: "ग्राहक विवरण",
    phone: "फ़ोन",
    email: "ईमेल",
    city: "शहर",
    address: "पता",
    gstin: "जीएसटीआईएन (GSTIN)",
    openingBalance: "प्रारंभिक शेष",
    totalDebits: "कुल डेबिट (खर्च)",
    totalCredits: "कुल क्रेडिट (जमा)",
    closingBalance: "अंतिम शेष (देय राशि)",
    date: "दिनांक",
    ref: "संदर्भ / बिल",
    description: "लेन-देन विवरण",
    debit: "डेबिट (₹)",
    credit: "क्रेडिट (₹)",
    balance: "शेष (₹)",
    noTransactions: "इस अवधि के लिए कोई लेन-देन दर्ज नहीं है।",
    computerGenerated: "यह कंप्यूटर द्वारा तैयार किया गया खाता विवरण है और इसमें भौतिक हस्ताक्षर की आवश्यकता नहीं है।",
    authorizedSignatory: "अधिकृत हस्ताक्षरकर्ता",
    thankYou: "आपकी यात्रा के लिए धन्यवाद!",
  },
  gu: {
    title: "ખાતા વિગત",
    subtitle: "ગ્રાહક ખાતાવહી અને ચુકવણી સારાંશ",
    statementPeriod: "સમયગાળો",
    asOf: "તારીખ સુધી",
    allTime: "શરૂઆતથી અત્યાર સુધી",
    customerDetails: "ગ્રાહક વિગતો",
    phone: "ફોન",
    email: "ઇમેઇલ",
    city: "શહેર",
    address: "સરનામું",
    gstin: "જીએસટીઆઇએન (GSTIN)",
    openingBalance: "શરૂઆતની બાકી",
    totalDebits: "કુલ ઉધાર",
    totalCredits: "કુલ જમા",
    closingBalance: "આખરની બાકી (ચુકવવાપાત્ર)",
    date: "તારીખ",
    ref: "સંદર્ભ / બિલ",
    description: "વિગત",
    debit: "ઉધાર (₹)",
    credit: "જમા (₹)",
    balance: "બાકી (₹)",
    noTransactions: "આ સમયગાળા દરમિયાન કોઈ વ્યવહાર નોંધાયેલ નથી.",
    computerGenerated: "આ કમ્પ્યુટર દ્વારા જનરેટ કરેલ ખાતા વિગત છે અને તેને ભૌતિક સહીની જરૂર નથી.",
    authorizedSignatory: "અધિકૃત સહી કરનાર",
    thankYou: "અમારી સાથે યાત્રા કરવા બદલ આપનો આભાર!",
  },
})

/**
 * Formats a number to Indian currency format with commas.
 * @param {number} val
 * @returns {string}
 */
function formatNumberINR(val) {
  if (val === null || val === undefined || isNaN(val)) return "0.00"
  const num = Number(val)
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Renders an accessible, print-ready HTML customer statement document.
 *
 * @param {Object} params
 * @param {Object} params.statement - Output of buildCustomerStatement
 * @param {Object} [params.operatorSettings] - Operator branding, logo, company address
 * @param {string} [params.lang="en"] - Language: "en", "hi", or "gu"
 * @param {string} [params.primaryColor="#4f46e5"] - Brand primary color
 * @returns {string} Safe HTML document string
 */
export function renderCustomerStatementHtml({
  statement,
  operatorSettings = {},
  lang = "en",
  primaryColor = "#2563eb",
} = {}) {
  if (!statement) return "<html><body>Statement data missing</body></html>"

  const dict = STATEMENT_I18N[lang] || STATEMENT_I18N.en
  const brandColor = sanitizeHexColor(primaryColor, "#2563eb")
  const brandLogo = sanitizeImageUrl(operatorSettings.companyLogo || operatorSettings.logoUrl)

  const companyName = escapeHtml(operatorSettings.companyName || "YatraHub Tours & Travels")
  const companyAddress = escapeHtml(operatorSettings.address || operatorSettings.companyAddress || "")
  const companyPhone = escapeHtml(operatorSettings.phone || operatorSettings.companyPhone || "")
  const companyEmail = escapeHtml(operatorSettings.email || operatorSettings.companyEmail || "")
  const companyGstin = escapeHtml(operatorSettings.gstin || operatorSettings.companyGstin || "")

  const customer = statement.customer || {}
  const custName = escapeHtml(customer.name || "Valued Customer")
  const custPhone = escapeHtml(customer.phone || "")
  const custEmail = escapeHtml(customer.email || "")
  const custCity = escapeHtml(customer.city || "")
  const custAddress = escapeHtml(customer.address || "")
  const custGstin = escapeHtml(customer.gstin || "")

  const periodFrom = statement.period?.from || ""
  const periodTo = statement.period?.to || ""
  const asOf = statement.period?.asOf || ""

  let periodText = dict.allTime
  if (periodFrom && periodTo) {
    periodText = `${periodFrom} to ${periodTo}`
  } else if (periodFrom) {
    periodText = `From ${periodFrom}`
  } else if (periodTo) {
    periodText = `Up to ${periodTo}`
  }

  const openingBal = Number(statement.openingBalance) || 0
  const closingBal = Number(statement.closingBalance) || 0
  const totalDebits = Number(statement.totalDebits) || 0
  const totalCredits = Number(statement.totalCredits) || 0

  const lines = statement.lines || []

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(dict.title)} — ${custName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
  <style>
    @page {
      size: A4;
      margin: 12mm 14mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #0f172a;
      background: #ffffff;
      padding: 16px;
    }
    .statement-container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid ${brandColor};
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      max-height: 54px;
      max-width: 140px;
      object-fit: contain;
    }
    .company-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .company-meta {
      font-size: 10.5px;
      color: #475569;
      margin-top: 3px;
    }
    .statement-title-block {
      text-align: right;
    }
    .statement-title {
      font-size: 17px;
      font-weight: 800;
      color: ${brandColor};
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .statement-subtitle {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .period-badge {
      display: inline-block;
      margin-top: 6px;
      background: #f1f5f9;
      color: #334155;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 10.5px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
      background: #f8fafc;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .info-title {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .cust-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .info-line {
      font-size: 11px;
      color: #334155;
      margin-top: 2px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
    }
    .card-label {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }
    .card-value {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 3px;
    }
    .card-closing {
      background: #fef2f2;
      border-color: #f87171;
    }
    .card-closing .card-label {
      color: #991b1b;
    }
    .card-closing .card-value {
      color: #b91c1c;
      font-size: 17px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
      text-transform: uppercase;
      font-size: 10px;
    }
    td {
      padding: 7px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .opening-row td {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    .total-row td {
      background: #f1f5f9;
      font-weight: 700;
      border-top: 2px solid #94a3b8;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 10px;
      color: #64748b;
    }
    .sign-box {
      text-align: center;
      width: 160px;
      padding-top: 36px;
      border-top: 1px solid #94a3b8;
      font-weight: 600;
      color: #334155;
    }
    @media print {
      body {
        padding: 0;
      }
      .statement-container {
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
      tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="statement-container">
    <!-- Header -->
    <div class="header">
      <div class="brand-section">
        ${brandLogo ? `<img src="${brandLogo}" class="brand-logo" alt="Logo">` : ""}
        <div>
          <div class="company-title">${companyName}</div>
          <div class="company-meta">
            ${companyAddress ? `<span>${companyAddress}</span><br>` : ""}
            ${companyPhone ? `<span>${escapeHtml(dict.phone)}: ${companyPhone}</span> &bull; ` : ""}
            ${companyEmail ? `<span>${escapeHtml(dict.email)}: ${companyEmail}</span><br>` : ""}
            ${companyGstin ? `<span>${escapeHtml(dict.gstin)}: ${companyGstin}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="statement-title-block">
        <div class="statement-title">${escapeHtml(dict.title)}</div>
        <div class="statement-subtitle">${escapeHtml(dict.subtitle)}</div>
        <div class="period-badge">${escapeHtml(dict.statementPeriod)}: ${escapeHtml(periodText)}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
          ${escapeHtml(dict.asOf)}: ${escapeHtml(asOf)}
        </div>
      </div>
    </div>

    <!-- Customer Details & Period Grid -->
    <div class="details-grid">
      <div>
        <div class="info-title">${escapeHtml(dict.customerDetails)}</div>
        <div class="cust-name">${custName}</div>
        ${custPhone ? `<div class="info-line"><strong>${escapeHtml(dict.phone)}:</strong> ${custPhone}</div>` : ""}
        ${custEmail ? `<div class="info-line"><strong>${escapeHtml(dict.email)}:</strong> ${custEmail}</div>` : ""}
        ${custAddress || custCity ? `<div class="info-line"><strong>${escapeHtml(dict.address)}:</strong> ${custAddress || custCity}</div>` : ""}
        ${custGstin ? `<div class="info-line"><strong>${escapeHtml(dict.gstin)}:</strong> ${custGstin}</div>` : ""}
      </div>
      <div style="text-align: right;">
        <div class="info-title">${escapeHtml(dict.statementPeriod)}</div>
        <div style="font-size: 12px; font-weight: 600; color: #0f172a;">${escapeHtml(periodText)}</div>
        <div class="info-line" style="margin-top: 8px;">
          <strong>Total Active Bookings:</strong> ${statement.summary?.activeBookingsCount || 0}
        </div>
        ${statement.summary?.cancelledBookingsCount ? `<div class="info-line"><strong>Cancelled Bookings:</strong> ${statement.summary.cancelledBookingsCount}</div>` : ""}
      </div>
    </div>

    <!-- Summary 4 Cards -->
    <div class="summary-cards">
      <div class="card">
        <div class="card-label">${escapeHtml(dict.openingBalance)}</div>
        <div class="card-value font-mono">₹${formatNumberINR(openingBal)}</div>
      </div>
      <div class="card">
        <div class="card-label">${escapeHtml(dict.totalDebits)}</div>
        <div class="card-value font-mono" style="color: #0369a1;">₹${formatNumberINR(totalDebits)}</div>
      </div>
      <div class="card">
        <div class="card-label">${escapeHtml(dict.totalCredits)}</div>
        <div class="card-value font-mono" style="color: #15803d;">₹${formatNumberINR(totalCredits)}</div>
      </div>
      <div class="card card-closing">
        <div class="card-label">${escapeHtml(dict.closingBalance)}</div>
        <div class="card-value font-mono">₹${formatNumberINR(closingBal)}</div>
      </div>
    </div>

    <!-- Transaction Ledger Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 75px;">${escapeHtml(dict.date)}</th>
          <th style="width: 80px;">${escapeHtml(dict.ref)}</th>
          <th>${escapeHtml(dict.description)}</th>
          <th class="text-right" style="width: 85px;">${escapeHtml(dict.debit)}</th>
          <th class="text-right" style="width: 85px;">${escapeHtml(dict.credit)}</th>
          <th class="text-right" style="width: 90px;">${escapeHtml(dict.balance)}</th>
        </tr>
      </thead>
      <tbody>
        <tr class="opening-row">
          <td class="font-mono">${escapeHtml(periodFrom || asOf)}</td>
          <td>—</td>
          <td><strong>${escapeHtml(dict.openingBalance)}</strong></td>
          <td class="text-right font-mono">—</td>
          <td class="text-right font-mono">—</td>
          <td class="text-right font-mono">₹${formatNumberINR(openingBal)}</td>
        </tr>
        ${
          lines.length === 0
            ? `<tr><td colspan="6" class="text-center" style="padding: 24px; color: #64748b;">${escapeHtml(dict.noTransactions)}</td></tr>`
            : lines
                .map(
                  (l) => `<tr>
          <td class="font-mono">${escapeHtml(l.date)}</td>
          <td class="font-mono">${escapeHtml(l.ref)}</td>
          <td>${escapeHtml(l.description)}</td>
          <td class="text-right font-mono" style="${l.debit > 0 ? "font-weight: 600; color: #0f172a;" : "color: #94a3b8;"}">
            ${l.debit > 0 ? `₹${formatNumberINR(l.debit)}` : "—"}
          </td>
          <td class="text-right font-mono" style="${l.credit > 0 ? "font-weight: 600; color: #166534;" : "color: #94a3b8;"}">
            ${l.credit > 0 ? `₹${formatNumberINR(l.credit)}` : "—"}
          </td>
          <td class="text-right font-mono" style="font-weight: 700; color: ${l.runningBalance > 0 ? "#b91c1c" : "#15803d"};">
            ₹${formatNumberINR(l.runningBalance)}
          </td>
        </tr>`,
                )
                .join("")
        }
        <tr class="total-row">
          <td colspan="3"><strong>${escapeHtml(dict.closingBalance)}</strong></td>
          <td class="text-right font-mono" style="color: #0369a1;">₹${formatNumberINR(totalDebits)}</td>
          <td class="text-right font-mono" style="color: #15803d;">₹${formatNumberINR(totalCredits)}</td>
          <td class="text-right font-mono" style="font-size: 13px; color: #b91c1c;">₹${formatNumberINR(closingBal)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Footer -->
    <div class="footer">
      <div>
        <div>${escapeHtml(dict.thankYou)}</div>
        <div style="margin-top: 4px;">${escapeHtml(dict.computerGenerated)}</div>
      </div>
      <div class="sign-box">
        ${escapeHtml(dict.authorizedSignatory)}
      </div>
    </div>
  </div>
</body>
</html>`
}
