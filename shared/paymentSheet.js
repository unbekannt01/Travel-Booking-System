/**
 * YatraHub - Shared Operator Departure Payment Sheet Engine
 *
 * Dedicated A4 collection and verification sheet for bus conductors & operators.
 * Lists all passengers for a departure with clear paid/balance indicators.
 *
 * Requirements & Features:
 * - Consistent 1px solid #000 borders on every cell (th, td, tfoot td).
 * - Exact table-layout: fixed with explicit <colgroup> column widths.
 * - Group subtotal row: label spans all columns before Paid, wraps cleanly (white-space: normal; word-break: break-word),
 *   never overflows, with Paid amount vertically aligned under Paid column and subsequent cells populated.
 * - Totals row: label spans all columns before Paid, Paid amount sits under Paid column.
 * - Ruled line for Operator note column: every passenger row displays a sharp horizontal bottom border across all cells.
 * - Suppressed browser headers/footers via @page { size: A4; margin: 0; } and 12mm padding on wrapper.
 * - Multi-page support: repeating thead with slim running header, no row splitting, tfoot kept together.
 * - Operator Note column is always widest (minimum 28% width, 9.5mm row height for pen handwriting).
 * - Auto-switches to landscape if note column width falls below 28% or >= 7 columns.
 * - Automatic Group Clustering: Multi-passenger group bookings clustered with thin sub-header and subtotal rows.
 * - Single bookings render as normal rows with no group header/subtotal.
 * - Overall bottom totals include all passengers once without double counting.
 */

import { escapeHtml } from "./escapeHtml.js"
import { formatSeatDisplayName, resolveSeatId } from "./seatLayouts.js"
import { isGroupBooking, getGroupInfo } from "./groupHelpers.js"

export const PAYMENT_SHEET_COLUMNS = Object.freeze([
  Object.freeze({
    id: "srNo",
    label: "Sr No",
    labelHi: "क्र.सं.",
    labelGu: "ક્રમ",
    required: true,
    defaultSelected: true,
    align: "center",
    width: "42px",
  }),
  Object.freeze({
    id: "name",
    label: "Passenger Name",
    labelHi: "यात्री का नाम",
    labelGu: "મુસાફરનું નામ",
    required: true,
    defaultSelected: true,
    align: "left",
    width: "145px",
  }),
  Object.freeze({
    id: "city",
    label: "City / Village",
    labelHi: "शहर / गांव",
    labelGu: "શહેર / ગામ",
    required: false,
    defaultSelected: true,
    align: "left",
    width: "100px",
  }),
  Object.freeze({
    id: "seat",
    label: "Seat No",
    labelHi: "सीट नं.",
    labelGu: "સીટ નં.",
    required: false,
    defaultSelected: false,
    align: "center",
    width: "65px",
  }),
  Object.freeze({
    id: "mobile",
    label: "Mobile No",
    labelHi: "मोबाइल नं.",
    labelGu: "મોબાઇલ નં.",
    required: false,
    defaultSelected: false,
    align: "center",
    width: "95px",
  }),
  Object.freeze({
    id: "gender",
    label: "Gender",
    labelHi: "लिंग",
    labelGu: "જાતિ",
    required: false,
    defaultSelected: false,
    align: "center",
    width: "50px",
  }),
  Object.freeze({
    id: "age",
    label: "Age",
    labelHi: "उम्र",
    labelGu: "ઉંમર",
    required: false,
    defaultSelected: false,
    align: "center",
    width: "45px",
  }),
  Object.freeze({
    id: "group",
    label: "Group",
    labelHi: "समूह",
    labelGu: "ગ્રુપ",
    required: false,
    defaultSelected: false,
    align: "left",
    width: "100px",
  }),
  Object.freeze({
    id: "paid",
    label: "Paid (₹)",
    labelHi: "जमा (₹)",
    labelGu: "ચૂકવેલ (₹)",
    required: false,
    defaultSelected: true,
    align: "right",
    width: "85px",
  }),
  Object.freeze({
    id: "balance",
    label: "Balance (₹)",
    labelHi: "बकाया (₹)",
    labelGu: "બાકી (₹)",
    required: false,
    defaultSelected: false,
    align: "right",
    width: "95px",
  }),
  Object.freeze({
    id: "fare",
    label: "Fare (₹)",
    labelHi: "किराया (₹)",
    labelGu: "ભાડું (₹)",
    required: false,
    defaultSelected: false,
    align: "right",
    width: "80px",
  }),
  Object.freeze({
    id: "pickup",
    label: "Pickup Point",
    labelHi: "पिकअप स्थान",
    labelGu: "પિકઅપ પોઇન્ટ",
    required: false,
    defaultSelected: false,
    align: "left",
    width: "105px",
  }),
  Object.freeze({
    id: "drop",
    label: "Drop Point",
    labelHi: "ड्रॉप स्थान",
    labelGu: "ડ્રોપ પોઇન્ટ",
    required: false,
    defaultSelected: false,
    align: "left",
    width: "105px",
  }),
  Object.freeze({
    id: "bookingRef",
    label: "Invoice No",
    labelHi: "बिल नं.",
    labelGu: "બિલ નં.",
    required: false,
    defaultSelected: false,
    align: "center",
    width: "85px",
  }),
  Object.freeze({
    id: "note",
    label: "Operator Note / Remarks (Pen Write-In)",
    labelHi: "ऑपरेटर टिप्पणी / हस्ताक्षर (पेन से लिखें)",
    labelGu: "ઓપરેટર નોંધ / સહી (પેનથી લખવા માટે)",
    required: true,
    defaultSelected: true,
    align: "left",
    width: "auto", // Grows to fill remaining space, minimum 28%
  }),
])

export const PAYMENT_SHEET_DEFAULTS = Object.freeze(["srNo", "name", "city", "paid", "note"])

export const PAYMENT_SHEET_I18N = Object.freeze({
  en: {
    sheetTitle: "BUS OPERATOR PAYMENT & COLLECTION SHEET",
    route: "Tour / Route",
    date: "Departure Date",
    busNo: "Bus Plate No",
    busType: "Bus Type",
    totalPax: "Total Passengers",
    totalFare: "Total Fare",
    totalCollected: "Advance Collected",
    totalOutstanding: "Total Due on Board",
    generatedOn: "Generated",
    emptySheet: "No passenger bookings recorded for this departure.",
    totals: "TOTALS",
    groupTotal: "Group total",
    groupLabel: "Group",
  },
  hi: {
    sheetTitle: "बस ऑपरेटर भुगतान एवं वसूली पत्रक",
    route: "यात्रा / मार्ग",
    date: "प्रस्थान दिनांक",
    busNo: "बस नंबर",
    busType: "बस प्रकार",
    totalPax: "कुल यात्री",
    totalFare: "कुल किराया",
    totalCollected: "अग्रिम जमा",
    totalOutstanding: "बस में कुल देय बकाया",
    generatedOn: "जारी दिनांक",
    emptySheet: "इस प्रस्थान के लिए कोई यात्री बुकिंग नहीं मिली।",
    totals: "कुल योग",
    groupTotal: "समूह कुल",
    groupLabel: "समूह",
  },
  gu: {
    sheetTitle: "બસ ઓપરેટર ચુકવણી અને ઉઘરાણી પત્રક",
    route: "પ્રવાસ / રૂટ",
    date: "પ્રસ્થાન તારીખ",
    busNo: "બસ નંબર",
    busType: "બસ પ્રકાર",
    totalPax: "કુલ મુસાફરો",
    totalFare: "કુલ ભાડું",
    totalCollected: "અગાઉ જમા",
    totalOutstanding: "બસમાં બાકી લેવાની રકમ",
    generatedOn: "તૈયાર કર્યા તારીખ",
    emptySheet: "આ પ્રસ્થાન માટે કોઈ મુસાફર બુકિંગ નોંધાયેલ નથી.",
    totals: "કુલ સરવાળો",
    groupTotal: "ગ્રુપ કુલ",
    groupLabel: "ગ્રુપ",
  },
})

/**
 * Natural comparison for seat IDs (e.g., L1-1 before L1-2, L2-1, L10-1)
 */
export function compareSeats(a, b) {
  const sA = String(a || "").trim()
  const sB = String(b || "").trim()
  if (!sA && !sB) return 0
  if (!sA) return 1
  if (!sB) return -1
  return sA.localeCompare(sB, undefined, { numeric: true, sensitivity: "base" })
}

/**
 * Normalizes column selection, ensuring required columns (srNo, name, note) are always present.
 * @param {string[]} selectedIds
 * @returns {string[]}
 */
export function normalizePaymentSheetColumns(selectedIds) {
  const allowed = new Set(PAYMENT_SHEET_COLUMNS.map((c) => c.id))
  const set = new Set((Array.isArray(selectedIds) ? selectedIds : PAYMENT_SHEET_DEFAULTS).filter((id) => allowed.has(id)))

  set.add("srNo")
  set.add("name")
  set.add("note")

  return PAYMENT_SHEET_COLUMNS.map((c) => c.id).filter((id) => set.has(id))
}

/**
 * Sorts passengers according to sort mode
 * @param {Array} passengers
 * @param {'seat'|'name'|'booking'} sortMode
 * @returns {Array}
 */
export function sortPaymentSheetPassengers(passengers, sortMode = "seat") {
  const list = [...(passengers || [])]

  if (sortMode === "name") {
    return list.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
  }

  if (sortMode === "booking") {
    return list.sort((a, b) => (a.bookingRef || a.bookingId || "").localeCompare(b.bookingRef || b.bookingId || ""))
  }

  return list.sort((a, b) => compareSeats(a.seat || a.seatId, b.seat || b.seatId))
}

/**
 * Clusters passengers so members of the same group appear consecutively.
 * Groups are ordered by the sort rank of their first member.
 * Single passengers are treated as individual standalone entries.
 *
 * @param {Array} passengers - pre-sorted by chosen sort mode
 * @returns {Array<{ type: 'single'|'group', groupKey: string, groupName: string, passengers: Array }>}
 */
export function clusterPassengersByGroup(passengers = []) {
  if (!passengers || passengers.length === 0) return []

  // Step 1: Count how many passengers share each group key or multi-pax booking ID
  const groupMembership = new Map()
  for (const p of passengers) {
    const gKey = p.groupId || (p.bookingId ? `booking-${p.bookingId}` : null)
    if (gKey) {
      if (!groupMembership.has(gKey)) {
        groupMembership.set(gKey, [])
      }
      groupMembership.get(gKey).push(p)
    }
  }

  const clusters = []
  const processedGroupKeys = new Set()

  for (const p of passengers) {
    const gKey = p.groupId || (p.bookingId ? `booking-${p.bookingId}` : null)
    const members = gKey ? groupMembership.get(gKey) || [] : []

    // If 2 or more passengers share this group/booking, treat as group cluster
    if (gKey && members.length > 1) {
      if (!processedGroupKeys.has(gKey)) {
        processedGroupKeys.add(gKey)
        const leadPax = members[0]
        const groupName =
          p.groupName?.trim() ||
          leadPax.groupName?.trim() ||
          (leadPax.name ? `${leadPax.name} + ${members.length - 1}` : "Group")

        clusters.push({
          type: "group",
          groupKey: gKey,
          groupName,
          passengers: members,
        })
      }
    } else {
      // Single passenger
      clusters.push({
        type: "single",
        groupKey: null,
        groupName: "",
        passengers: [p],
      })
    }
  }

  return clusters
}

/**
 * Formats rupee currency with Indian separators
 */
function formatRupees(num) {
  const val = Number(num || 0)
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val)
}

/**
 * Renders complete, sandboxed, high-contrast A4 HTML for Operator Departure Payment Sheet.
 *
 * @param {Object} options
 * @param {Object} options.departure
 * @param {Array} options.passengers
 * @param {string[]} [options.columns]
 * @param {'seat'|'name'|'booking'} [options.sort='seat']
 * @param {'auto'|'portrait'|'landscape'} [options.orientation='auto']
 * @param {'en'|'hi'|'gu'} [options.language='en']
 * @param {boolean} [options.showCompanyHeader=true]
 * @param {Object} [options.companyInfo]
 * @returns {string} Standalone HTML string
 */
export function renderPaymentSheetHtml({
  departure = {},
  passengers = [],
  columns = PAYMENT_SHEET_DEFAULTS,
  sort = "seat",
  orientation = "auto",
  language = "en",
  showCompanyHeader = true,
  companyInfo = {},
}) {
  const activeCols = normalizePaymentSheetColumns(columns)
  const sortedPax = sortPaymentSheetPassengers(passengers, sort)
  const clusters = clusterPassengersByGroup(sortedPax)

  const lang = ["en", "hi", "gu"].includes(language) ? language : "en"
  const t = PAYMENT_SHEET_I18N[lang] || PAYMENT_SHEET_I18N.en

  // Determine paper orientation:
  // Printable width portrait ~ 186mm (703px). If non-note columns sum > 510px, note width < 28%, switch to landscape.
  const colDefMap = new Map(PAYMENT_SHEET_COLUMNS.map((c) => [c.id, c]))
  let fixedWidthSumPx = 0
  activeCols.forEach((colId) => {
    if (colId !== "note") {
      const def = colDefMap.get(colId)
      if (def?.width) {
        fixedWidthSumPx += parseInt(def.width, 10) || 70
      }
    }
  })

  // Portrait printable width ~ 700px. Note needs >= 28% (~196px). So max non-note sum in portrait is ~504px.
  const needsLandscape = fixedWidthSumPx > 504 || activeCols.length >= 7
  const effectiveOrientation =
    orientation === "auto" ? (needsLandscape ? "landscape" : "portrait") : orientation

  const companyName = companyInfo.companyName || departure.companyName || "YATRA HUB"
  const companyPhone = companyInfo.companyPhone || companyInfo.phone || departure.companyPhone || ""
  const companyAddress = companyInfo.companyAddress || companyInfo.address || departure.companyAddress || ""
  const tourName = departure.tourName || departure.tour || "Departure Tour"
  const dateStr = departure.dateStr || departure.journeyDate || ""
  const busNumber = departure.busNumber || departure.busPlateNo || departure.vehicleNo || ""
  const busType = departure.busType || ""

  // Financial accumulations
  let totalFareSum = 0
  let totalPaidSum = 0
  let totalDueSum = 0

  sortedPax.forEach((p) => {
    const f = Number(p.fare || 0)
    const pd = Number(p.paid !== undefined ? p.paid : p.isPaid ? f : 0)
    const b = Number(p.balance !== undefined ? p.balance : p.balanceDue !== undefined ? p.balanceDue : Math.max(0, f - pd))

    totalFareSum += f
    totalPaidSum += pd
    totalDueSum += b
  })

  // Has balance column in view?
  const hasBalanceColumn = activeCols.includes("balance")

  // Generate <colgroup> for 100% strict column width control across header, body, and totals
  const colgroupHtml = `<colgroup>
    ${activeCols
      .map((colId) => {
        const def = colDefMap.get(colId)
        if (colId === "note") {
          return `<col style="width: auto; min-width: 28%;"/>`
        }
        return `<col style="width: ${def?.width || "70px"};"/>`
      })
      .join("\n    ")}
  </colgroup>`

  // Generate Table Column Headers
  const theadHtml = activeCols
    .map((colId) => {
      const def = colDefMap.get(colId)
      if (!def) return ""
      const label = lang === "gu" ? def.labelGu : lang === "hi" ? def.labelHi : def.label
      const isNote = colId === "note"
      const thClass = isNote ? "th-note" : `th-${colId}`

      return `<th class="${thClass} text-${def.align}">${escapeHtml(label)}</th>`
    })
    .join("\n")

  // FIX 1: Compute dynamically the number of columns before the Paid column
  const paidColIdx = activeCols.indexOf("paid")
  const colsBeforePaid = paidColIdx >= 0 ? paidColIdx : Math.max(1, activeCols.length - 1)

  // Generate Table Body Rows (with Group Clustering)
  let globalSrNo = 1
  const bodyRows = []

  if (clusters.length === 0) {
    bodyRows.push(
      `<tr><td colspan="${activeCols.length}" class="text-center py-6 text-muted font-bold">${escapeHtml(t.emptySheet)}</td></tr>`,
    )
  } else {
    for (const cluster of clusters) {
      const isGroup = cluster.type === "group"

      if (isGroup) {
        // Group sub-header row spanning ALL columns
        bodyRows.push(
          `<tr class="group-header-row"><td colspan="${activeCols.length}" class="group-sub-header">👥 ${escapeHtml(t.groupLabel)}: ${escapeHtml(cluster.groupName)} (${cluster.passengers.length} pax)</td></tr>`,
        )
      }

      let clusterPaidSum = 0
      let clusterFareSum = 0
      let clusterDueSum = 0

      for (const p of cluster.passengers) {
        const fare = Number(p.fare || 0)
        const paid = Number(p.paid !== undefined ? p.paid : p.isPaid ? fare : 0)
        const balance = Number(
          p.balance !== undefined
            ? p.balance
            : p.balanceDue !== undefined
              ? p.balanceDue
              : Math.max(0, fare - paid),
        )
        const hasDue = balance > 0

        clusterFareSum += fare
        clusterPaidSum += paid
        clusterDueSum += balance

        const cells = activeCols.map((colId) => {
          switch (colId) {
            case "srNo":
              return `<td class="text-center font-bold">${globalSrNo++}</td>`
            case "name":
              return `<td class="text-left font-bold text-dark cell-wrap">${escapeHtml(p.name || "—")}</td>`
            case "city":
              return `<td class="text-left cell-wrap">${escapeHtml(p.city || "—")}</td>`
            case "seat":
              return `<td class="text-center font-mono font-bold">${p.seat || p.seatId ? escapeHtml(formatSeatDisplayName(resolveSeatId(null, p.seat || p.seatId))) : "—"}</td>`
            case "mobile":
              return `<td class="text-center font-mono">${escapeHtml(p.mobile || "—")}</td>`
            case "gender":
              return `<td class="text-center">${escapeHtml(p.gender || "—")}</td>`
            case "age":
              return `<td class="text-center">${escapeHtml(String(p.age || "—"))}</td>`
            case "group":
              return `<td class="text-left text-xs cell-wrap">${escapeHtml(cluster.groupName || p.groupName || "—")}</td>`
            case "paid": {
              const marker = !hasBalanceColumn && hasDue ? ` <strong class="due-star" title="Due ₹${formatRupees(balance)}">*</strong>` : ""
              return `<td class="text-right ${hasDue && !hasBalanceColumn ? "font-bold text-due" : "font-medium"}">₹${formatRupees(paid)}${marker}</td>`
            }
            case "balance": {
              if (hasDue) {
                return `<td class="text-right font-bold text-due">₹${formatRupees(balance)} <span class="due-flag">[DUE]</span></td>`
              }
              return `<td class="text-right font-medium text-paid">₹0</td>`
            }
            case "fare":
              return `<td class="text-right font-medium">₹${formatRupees(fare)}</td>`
            case "pickup":
              return `<td class="text-left text-xs cell-wrap">${escapeHtml(p.pickup || p.pickupPoint || "—")}</td>`
            case "drop":
              return `<td class="text-left text-xs cell-wrap">${escapeHtml(p.drop || p.dropPoint || "—")}</td>`
            case "bookingRef":
              return `<td class="text-center font-mono text-xs">${escapeHtml(p.bookingRef || "—")}</td>`
            case "note":
              // FIX 2: Explicit non-breaking space ensures line box and horizontal ruled line are never collapsed or missing
              return `<td class="note-cell"><div class="pen-write-area">&nbsp;</div></td>`
            default:
              return `<td>&nbsp;</td>`
          }
        })

        bodyRows.push(`<tr>${cells.join("")}</tr>`)
      }

      if (isGroup) {
        // FIX 1: Group subtotal row
        // 1. Spanned label cell covering ALL columns before Paid
        // Wrapped, overflow hidden, concise "Group total (N pax)" label
        const subtotalCells = []
        subtotalCells.push(
          `<td colspan="${colsBeforePaid}" class="group-subtotal-label">${escapeHtml(t.groupTotal)} (${cluster.passengers.length} pax):</td>`,
        )

        // 2. Paid cell under Paid column
        if (paidColIdx >= 0) {
          subtotalCells.push(`<td class="text-right font-bold">₹${formatRupees(clusterPaidSum)}</td>`)
        }

        // 3. Every column after Paid gets its own cell with consistent borders
        const startAfterPaid = paidColIdx >= 0 ? paidColIdx + 1 : colsBeforePaid
        for (let idx = startAfterPaid; idx < activeCols.length; idx++) {
          const colId = activeCols[idx]
          if (colId === "balance") {
            subtotalCells.push(
              `<td class="text-right font-bold ${clusterDueSum > 0 ? "text-due" : "text-paid"}">₹${formatRupees(clusterDueSum)}</td>`,
            )
          } else if (colId === "fare") {
            subtotalCells.push(`<td class="text-right font-bold">₹${formatRupees(clusterFareSum)}</td>`)
          } else if (colId === "note") {
            subtotalCells.push(`<td class="text-center font-bold text-xs" style="white-space: nowrap;">${cluster.passengers.length} PAX</td>`)
          } else {
            subtotalCells.push(`<td>&nbsp;</td>`)
          }
        }

        bodyRows.push(`<tr class="group-subtotal-row">${subtotalCells.join("")}</tr>`)
      }
    }
  }

  // FIX 1: Totals Row in tfoot using colspan for all columns before Paid
  const tfootCells = []
  tfootCells.push(
    `<td colspan="${colsBeforePaid}" class="totals-label">${escapeHtml(t.totals)}:</td>`,
  )

  if (paidColIdx >= 0) {
    tfootCells.push(`<td class="text-right font-bold">₹${formatRupees(totalPaidSum)}</td>`)
  }

  const startAfterPaidTfoot = paidColIdx >= 0 ? paidColIdx + 1 : colsBeforePaid
  for (let idx = startAfterPaidTfoot; idx < activeCols.length; idx++) {
    const colId = activeCols[idx]
    if (colId === "balance") {
      tfootCells.push(
        `<td class="text-right font-bold ${totalDueSum > 0 ? "text-due" : "text-paid"}">₹${formatRupees(totalDueSum)}</td>`,
      )
    } else if (colId === "fare") {
      tfootCells.push(`<td class="text-right font-bold">₹${formatRupees(totalFareSum)}</td>`)
    } else if (colId === "note") {
      tfootCells.push(
        `<td class="note-footer font-bold text-center" style="white-space: nowrap;">TOTAL PAX: ${sortedPax.length}</td>`,
      )
    } else {
      tfootCells.push(`<td>&nbsp;</td>`)
    }
  }

  const tfootHtml = `<tr class="totals-row">${tfootCells.join("")}</tr>`

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:;"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(t.sheetTitle)} - ${escapeHtml(tourName)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  
  @page {
    size: A4 ${effectiveOrientation};
    margin: 0; /* Suppresses default browser URL/date headers and footers */
  }

  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Devanagari", "Noto Sans Gujarati", Roboto, Arial, sans-serif;
    background: #ffffff;
    color: #000000;
    font-size: 10.5px;
    line-height: 1.3;
    padding: 12mm;
    box-sizing: border-box;
    width: 100%;
  }

  @media print {
    body {
      padding: 12mm;
      background: #ffffff;
    }
    .no-print { display: none !important; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; page-break-inside: avoid; break-inside: avoid; }
  }

  /* Printable Page Wrapper */
  .sheet-wrapper {
    width: 100%;
    margin: 0 auto;
  }

  .header-container {
    border-bottom: 2px solid #000000;
    padding-bottom: 6px;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .company-title {
    font-size: 17px;
    font-weight: 900;
    color: #000000;
    letter-spacing: -0.01em;
    text-transform: uppercase;
  }
  .company-sub {
    font-size: 9px;
    color: #333333;
    margin-top: 1px;
  }
  .sheet-tag-block {
    text-align: right;
  }
  .sheet-badge {
    display: inline-block;
    background: #000000;
    color: #ffffff;
    font-size: 10px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 3px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px 10px;
    background: #f8fafc;
    border: 1px solid #000000;
    border-radius: 3px;
    padding: 6px 10px;
    margin-bottom: 8px;
  }
  .meta-item {
    display: flex;
    flex-direction: column;
  }
  .meta-label {
    font-size: 8px;
    font-weight: 800;
    color: #333333;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .meta-val {
    font-size: 10.5px;
    font-weight: 900;
    color: #000000;
    margin-top: 1px;
  }

  .summary-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #000000;
    background: #f8fafc;
    border-radius: 3px;
    padding: 5px 10px;
    margin-bottom: 10px;
    font-size: 10.5px;
    font-weight: 800;
  }
  .stat-badge {
    padding: 1px 6px;
    border-radius: 3px;
    background: #000000;
    color: #ffffff;
    font-size: 9.5px;
    margin-left: 4px;
  }

  /* Single consistent table design with 1px solid #000 borders */
  table.paysheet-table {
    width: 100%;
    border-collapse: collapse !important;
    table-layout: fixed;
    margin-bottom: 10px;
    font-size: 10px;
    border: 1px solid #000000 !important;
    border-color: #000000 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  table.paysheet-table th,
  table.paysheet-table td {
    border: 1px solid #000000 !important;
    border-color: #000000 !important;
    padding: 4px 5px;
    vertical-align: middle;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  table.paysheet-table th {
    background: #f1f5f9 !important;
    color: #000000;
    font-weight: 900;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  /* Slim repeated running header on page 2+ */
  tr.running-header-row th {
    background: #ffffff !important;
    font-size: 8.5px;
    font-weight: normal;
    text-transform: none;
    color: #444444;
    padding: 2px 5px;
    border-top: none;
    border-left: none;
    border-right: none;
    border-bottom: 1px solid #000000 !important;
  }

  table.paysheet-table tbody td {
    height: 9.5mm; /* 9-10mm tall write-in row height requested by owner */
    min-height: 9.5mm;
    border: 1px solid #000000 !important;
    border-color: #000000 !important;
  }

  table.paysheet-table tbody tr:nth-child(even) td {
    background-color: #fafafa !important;
    border: 1px solid #000000 !important;
    border-color: #000000 !important;
  }

  /* FIX 2: Note Column & Ruled Lines */
  table.paysheet-table th.th-note {
    background: #e2e8f0 !important;
    border: 1px solid #000000 !important;
  }

  table.paysheet-table td.note-cell {
    background: #ffffff !important;
    border: 1px solid #000000 !important;
    border-bottom: 1px solid #000000 !important;
    position: relative;
    padding: 2px 4px !important;
    height: 9.5mm;
    min-height: 9.5mm;
    vertical-align: middle;
    box-sizing: border-box;
  }

  table.paysheet-table tbody tr:nth-child(even) td.note-cell {
    background: #ffffff !important;
    border: 1px solid #000000 !important;
    border-bottom: 1px solid #000000 !important;
  }

  .pen-write-area {
    min-height: 8.5mm;
    height: 8.5mm;
    width: 100%;
    display: block;
    line-height: 8.5mm;
    box-sizing: border-box;
  }

  /* Group Sub-headers and Subtotals */
  tr.group-header-row td {
    background: #e2e8f0 !important;
    color: #000000;
    font-weight: 900;
    font-size: 10px;
    height: 7mm;
    padding: 3px 6px;
    border: 1px solid #000000 !important;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: avoid;
    break-after: avoid;
  }

  tr.group-subtotal-row td {
    background: #f1f5f9 !important;
    color: #000000;
    font-size: 9.5px;
    height: 7mm;
    padding: 3px 6px;
    border: 1px solid #000000 !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* FIX 1: Subtotal and Totals Label styling preventing overflow */
  .group-subtotal-label {
    white-space: normal !important;
    word-break: break-word;
    overflow: hidden;
    text-align: right;
    font-weight: 900;
    font-size: 9.5px;
    padding-right: 8px !important;
  }

  .totals-label {
    white-space: normal !important;
    word-break: break-word;
    overflow: hidden;
    text-align: right;
    font-weight: 900;
    font-size: 11px;
    letter-spacing: 0.04em;
    padding-right: 8px !important;
  }

  /* Totals row in tfoot */
  table.paysheet-table tfoot td {
    background: #e2e8f0 !important;
    font-weight: 900;
    font-size: 10.5px;
    height: 8.5mm;
    border: 1px solid #000000 !important;
  }

  .text-center { text-align: center; }
  .text-left { text-align: left; }
  .text-right { text-align: right; }
  .font-mono { font-family: monospace, Consolas, sans-serif; }
  .font-bold { font-weight: 900; }
  .font-medium { font-weight: 700; }
  .text-dark { color: #000000; }
  .text-muted { color: #666666; }

  .cell-wrap {
    word-break: break-word;
    overflow-wrap: break-word;
  }

  /* B&W standout indicators */
  .text-due {
    color: #000000;
    font-weight: 900;
  }
  .due-star {
    font-size: 12px;
    color: #b91c1c;
    font-weight: 900;
    margin-left: 2px;
  }
  .due-flag {
    display: inline-block;
    border: 1px solid #000000;
    font-size: 7.5px;
    font-weight: 900;
    padding: 0 2px;
    border-radius: 2px;
    margin-left: 2px;
  }
  .text-paid {
    color: #15803d;
    font-weight: 800;
  }

  /* Clean Small Footer */
  .sheet-footer {
    margin-top: 10px;
    border-top: 1px dashed #666666;
    padding-top: 4px;
    font-size: 8px;
    color: #444444;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>
</head>
<body>
<div class="sheet-wrapper">

  ${
    showCompanyHeader
      ? `<!-- Header -->
  <div class="header-container">
    <div>
      <div class="company-title">${escapeHtml(companyName)}</div>
      <div class="company-sub">
        ${companyPhone ? `<span>Tel: ${escapeHtml(companyPhone)}</span> • ` : ""}
        ${companyAddress ? `<span>${escapeHtml(companyAddress)}</span>` : ""}
      </div>
    </div>
    <div class="sheet-tag-block">
      <div class="sheet-badge">${escapeHtml(t.sheetTitle)}</div>
    </div>
  </div>`
      : ""
  }

  <!-- Meta Information -->
  <div class="meta-grid">
    <div class="meta-item">
      <span class="meta-label">${escapeHtml(t.route)}</span>
      <span class="meta-val">${escapeHtml(tourName)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">${escapeHtml(t.date)}</span>
      <span class="meta-val">${escapeHtml(dateStr)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">${escapeHtml(t.busNo)} / ${escapeHtml(t.busType)}</span>
      <span class="meta-val">${escapeHtml(busNumber || "—")} ${busType ? `(${escapeHtml(busType)})` : ""}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">${escapeHtml(t.totalPax)}</span>
      <span class="meta-val">${sortedPax.length} PAX</span>
    </div>
  </div>

  <!-- Outstanding Collection Quick Strip -->
  <div class="summary-strip">
    <div>
      <span>${escapeHtml(t.totalFare)}: <strong>₹${formatRupees(totalFareSum)}</strong></span> • 
      <span>${escapeHtml(t.totalCollected)}: <strong style="color: #15803d;">₹${formatRupees(totalPaidSum)}</strong></span>
    </div>
    <div>
      <span>${escapeHtml(t.totalOutstanding)}:</span>
      <span class="stat-badge">₹${formatRupees(totalDueSum)}</span>
    </div>
  </div>

  <!-- Main Payment Sheet Table -->
  <table class="paysheet-table">
    ${colgroupHtml}
    <thead>
      <tr class="running-header-row">
        <th colspan="${activeCols.length}" class="text-left">
          ${escapeHtml(tourName)} | ${escapeHtml(dateStr)} | ${escapeHtml(t.sheetTitle)}
        </th>
      </tr>
      <tr>
        ${theadHtml}
      </tr>
    </thead>
    <tbody>
      ${bodyRows.join("\n      ")}
    </tbody>
    <tfoot>
      ${tfootHtml}
    </tfoot>
  </table>

  <!-- Clean Small Footer Notice -->
  <div class="sheet-footer">
    <span>${escapeHtml(companyName)} • Departure Payment Sheet</span>
    <span>${escapeHtml(t.generatedOn)}: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
  </div>

</div>
</body>
</html>`
}
