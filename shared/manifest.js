/**
 * YatraHub - Shared Passenger Manifest Engine (Part 6d)
 *
 * Column definitions, presets, natural seat sorting, Aadhaar formatting,
 * and high-fidelity, sandboxed print HTML generator.
 */

import { escapeHtml } from "./escapeHtml.js"
import { getSeatLayout, layoutKeyForBusType, resolveSeatId, formatSeatDisplayName } from "./seatLayouts.js"

export const MANIFEST_COLUMNS = Object.freeze([
  Object.freeze({
    id: "srNo",
    label: "Sr No",
    labelHi: "क्र.सं.",
    labelGu: "ક્રમ",
    required: true,
    defaultSelected: true,
    sensitive: false,
    align: "center",
    width: "45px",
  }),
  Object.freeze({
    id: "name",
    label: "Passenger Name",
    labelHi: "यात्री का नाम",
    labelGu: "મુસાફરનું નામ",
    required: true,
    defaultSelected: true,
    sensitive: false,
    align: "left",
    width: "auto",
  }),
  Object.freeze({
    id: "seat",
    label: "Seat No",
    labelHi: "सीट नं.",
    labelGu: "સીટ નં.",
    required: false,
    defaultSelected: true,
    sensitive: false,
    align: "center",
    width: "75px",
  }),
  Object.freeze({
    id: "gender",
    label: "Gender",
    labelHi: "लिंग",
    labelGu: "જાતિ",
    required: false,
    defaultSelected: true,
    sensitive: false,
    align: "center",
    width: "55px",
  }),
  Object.freeze({
    id: "age",
    label: "Age",
    labelHi: "उम्र",
    labelGu: "ઉંમર",
    required: false,
    defaultSelected: true,
    sensitive: false,
    align: "center",
    width: "50px",
  }),
  Object.freeze({
    id: "mobile",
    label: "Mobile No",
    labelHi: "मोबाइल नं.",
    labelGu: "મોબાઇલ નં.",
    required: false,
    defaultSelected: true,
    sensitive: false,
    align: "center",
    width: "105px",
  }),
  Object.freeze({
    id: "city",
    label: "City / Address",
    labelHi: "शहर / पता",
    labelGu: "શહેર / સરનામું",
    required: false,
    defaultSelected: false,
    sensitive: false,
    align: "left",
    width: "100px",
  }),
  Object.freeze({
    id: "pickup",
    label: "Pickup Point",
    labelHi: "पिकअप पॉइंट",
    labelGu: "પિકઅપ પોઇન્ટ",
    required: false,
    defaultSelected: true,
    sensitive: false,
    align: "left",
    width: "115px",
  }),
  Object.freeze({
    id: "bookingRef",
    label: "Booking Ref",
    labelHi: "बुकिंग संदर्भ",
    labelGu: "બુકિંગ સંદર્ભ",
    required: false,
    defaultSelected: false,
    sensitive: false,
    align: "center",
    width: "95px",
  }),
  Object.freeze({
    id: "paymentStatus",
    label: "Payment Status",
    labelHi: "भुगतान स्थिति",
    labelGu: "ચુકવણી સ્થિતિ",
    required: false,
    defaultSelected: false,
    sensitive: false,
    align: "center",
    width: "85px",
  }),
  Object.freeze({
    id: "aadhaar",
    label: "Aadhaar No",
    labelHi: "आधार नं.",
    labelGu: "આધાર નં.",
    required: false,
    defaultSelected: false,
    sensitive: true,
    align: "center",
    width: "125px",
  }),
  Object.freeze({
    id: "balanceDue",
    label: "Balance Due",
    labelHi: "बकाया राशि",
    labelGu: "બાકી રકમ",
    required: false,
    defaultSelected: false,
    sensitive: false,
    align: "right",
    width: "85px",
  }),
  Object.freeze({
    id: "boarded",
    label: "Boarded",
    labelHi: "सवार",
    labelGu: "બેઠા",
    required: false,
    defaultSelected: true,
    sensitive: false,
    align: "center",
    width: "60px",
    checkbox: true,
  }),
  Object.freeze({
    id: "remarks",
    label: "Remarks / Sign",
    labelHi: "टिप्पणी / हस्ताक्षर",
    labelGu: "નોંધ / સહી",
    required: false,
    defaultSelected: false,
    sensitive: false,
    align: "left",
    width: "105px",
  }),
])

export const MANIFEST_PRESETS = Object.freeze({
  "without-aadhaar": Object.freeze([
    "srNo",
    "name",
    "seat",
    "gender",
    "age",
    "mobile",
    "pickup",
    "boarded",
  ]),
  "with-aadhaar": Object.freeze([
    "srNo",
    "name",
    "seat",
    "gender",
    "age",
    "mobile",
    "pickup",
    "aadhaar",
    "boarded",
  ]),
  "pickup-wise": Object.freeze([
    "srNo",
    "name",
    "seat",
    "gender",
    "age",
    "mobile",
    "pickup",
    "paymentStatus",
    "balanceDue",
    "boarded",
  ]),
  minimal: Object.freeze(["srNo", "name", "seat", "mobile", "boarded"]),
})

const VALID_COLUMN_IDS = new Set(MANIFEST_COLUMNS.map((c) => c.id))

/**
 * Normalizes user-selected column IDs:
 * - Drops invalid / unrecognized IDs
 * - Deduplicates IDs
 * - Ensures `srNo` and `name` are always present
 * - Sorts in canonical definition order
 *
 * @param {string[]} ids
 * @returns {string[]}
 */
export function normalizeColumnSelection(ids = []) {
  const set = new Set(Array.isArray(ids) ? ids.filter((id) => VALID_COLUMN_IDS.has(id)) : [])
  set.add("srNo")
  set.add("name")

  return MANIFEST_COLUMNS.filter((col) => set.has(col.id)).map((col) => col.id)
}

/**
 * Formats an Aadhaar number:
 * - mode === "full": "1234 5678 9012"
 * - mode === "last4": "XXXX XXXX 9012"
 *
 * @param {string | null | undefined} value
 * @param {"full" | "last4"} mode
 * @returns {string}
 */
export function formatAadhaar(value, mode = "last4") {
  if (!value || typeof value !== "string") return "—"
  const clean = value.replace(/\s+/g, "")
  if (!/^\d{12}$/.test(clean)) {
    if (/^X{4}[\s-]?X{4}[\s-]?\d{4}$/i.test(value.trim())) {
      return value.trim()
    }
    return value.trim() || "—"
  }
  if (mode === "full") {
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`
  }
  return `XXXX XXXX ${clean.slice(-4)}`
}

/**
 * Natural comparator for seat labels, sorting by seat NUMBER from the layout,
 * with unknown IDs sorted last.
 *
 * @param {string} seatA
 * @param {string} seatB
 * @param {string} [layoutKeyOrBusType]
 * @returns {number}
 */
export function compareSeats(seatA = "", seatB = "", layoutKeyOrBusType) {
  if (!seatA && !seatB) return 0
  if (!seatA) return 1
  if (!seatB) return -1

  const lKey = layoutKeyOrBusType
    ? (getSeatLayout(layoutKeyOrBusType) ? layoutKeyOrBusType : layoutKeyForBusType(layoutKeyOrBusType))
    : null

  const layout = lKey ? getSeatLayout(lKey) : null

  if (layout) {
    const canA = resolveSeatId(layout.key, seatA)
    const canB = resolveSeatId(layout.key, seatB)
    const sA = layout.seats.find((s) => s.id.toLowerCase() === canA.toLowerCase())
    const sB = layout.seats.find((s) => s.id.toLowerCase() === canB.toLowerCase())

    const numA = sA ? sA.number : 999999
    const numB = sB ? sB.number : 999999

    if (numA !== numB) {
      return numA - numB
    }
  }

  return String(seatA).localeCompare(String(seatB), undefined, { numeric: true, sensitivity: "base" })
}

/**
 * Formats seatId for display in manifest tables.
 */
function displaySeat(seatId, layoutKeyOrBusType) {
  if (!seatId || typeof seatId !== "string" || !seatId.trim()) return "—"
  const clean = seatId.trim()
  const lKey = layoutKeyOrBusType
    ? (getSeatLayout(layoutKeyOrBusType) ? layoutKeyOrBusType : layoutKeyForBusType(layoutKeyOrBusType))
    : null

  const formatted = formatSeatDisplayName(lKey, clean)
  if (formatted && formatted !== clean) {
    return formatted
  }

  const canonMatch = clean.match(/^(left|right)-([LU]\d+)-([12])$/i)
  if (canonMatch) {
    const side = canonMatch[1].charAt(0).toUpperCase() + canonMatch[1].slice(1).toLowerCase()
    return `${side} ${canonMatch[2].toUpperCase()}-${canonMatch[3]}`
  }
  if (/^rear-B[12]$/i.test(clean)) {
    return `Rear ${clean.slice(-2).toUpperCase()}`
  }
  if (/^seat-\d+$/i.test(clean)) {
    return `Seat ${clean.slice(5)}`
  }

  const match = clean.match(/^(lower|upper)-([A-Za-z0-9-]+)$/i)
  if (match) {
    const deck = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
    return `${deck} ${match[2]}`
  }
  return clean
}

/**
 * Builds sorted rows for passenger manifest table.
 *
 * @param {{
 *   passengers: Array<Record<string, any>>,
 *   columns: string[],
 *   sort?: "seat" | "name" | "booking",
 *   aadhaarMode?: "full" | "last4",
 *   layoutKey?: string,
 *   busType?: string,
 * }} options
 * @returns {Array<Record<string, any>>}
 */
export function buildManifestRows({
  passengers = [],
  columns = [],
  sort = "seat",
  aadhaarMode = "last4",
  layoutKey,
  busType,
} = {}) {
  const normColumns = normalizeColumnSelection(columns)
  const list = [...(Array.isArray(passengers) ? passengers : [])]
  const effectiveLayout = layoutKey || busType

  // Sort
  if (sort === "seat") {
    list.sort((a, b) => compareSeats(a?.seat || a?.seatId, b?.seat || b?.seatId, effectiveLayout))
  } else if (sort === "name") {
    list.sort((a, b) => (a?.name || "").localeCompare(b?.name || "", undefined, { sensitivity: "base" }))
  } else if (sort === "booking") {
    list.sort((a, b) =>
      (a?.bookingRef || a?.invoiceNo || "").localeCompare(
        b?.bookingRef || b?.invoiceNo || "",
        undefined,
        { numeric: true, sensitivity: "base" },
      ),
    )
  }

  return list.map((p, idx) => {
    const row = { _original: p }
    for (const colId of normColumns) {
      switch (colId) {
        case "srNo":
          row.srNo = idx + 1
          break
        case "name":
          row.name = p.name ? String(p.name).trim() : "—"
          break
        case "seat":
          row.seat = displaySeat(p.seat || p.seatId, effectiveLayout)
          break
        case "gender":
          row.gender = p.gender ? String(p.gender).trim().toUpperCase().charAt(0) : "—"
          break
        case "age":
          row.age = p.age !== undefined && p.age !== null && p.age !== "" ? String(p.age) : "—"
          break
        case "mobile":
          row.mobile = p.mobile || p.contact || p.phone || "—"
          break
        case "city":
          row.city = p.city ? String(p.city).trim() : "—"
          break
        case "pickup":
          row.pickup = p.pickup || p.pickupPoint || "—"
          break
        case "bookingRef":
          row.bookingRef = p.bookingRef || p.invoiceNo || "—"
          break
        case "paymentStatus":
          row.paymentStatus = p.paymentStatus || (p.isPaid ? "Paid" : "Pending") || "—"
          break
        case "balanceDue": {
          const bal =
            p.balanceDue !== undefined && p.balanceDue !== null
              ? Number(p.balanceDue)
              : 0
          row.balanceDue = bal > 0 ? `₹${bal.toLocaleString("en-IN")}` : "Nil"
          break
        }
        case "aadhaar":
          row.aadhaar = formatAadhaar(p.aadhaar || p.aadhar, aadhaarMode)
          break
        case "boarded":
          row.boarded = Boolean(p.boarded || p.checkedIn)
          break
        case "remarks":
          row.remarks = p.remarks ? String(p.remarks).trim() : ""
          break
        default:
          row[colId] = p[colId] !== undefined && p[colId] !== null ? String(p[colId]) : "—"
          break
      }
    }
    return row
  })
}

const I18N = {
  en: {
    manifestTitle: "PASSENGER MANIFEST",
    tour: "Tour",
    date: "Journey Date",
    busType: "Coach Type",
    totalPax: "Total Passengers",
    conductorSign: "Conductor / Tour Manager Signature",
    generatedOn: "Generated on",
    page: "Page",
    confidentialNotice:
      "CONFIDENTIAL: Contains Aadhaar numbers. For operational/boarding verification only. Do not discard or share publicly.",
    paid: "Paid",
    pending: "Pending",
  },
  hi: {
    manifestTitle: "यात्री सूची (पैसेंजर मेनिफेस्ट)",
    tour: "यात्रा (टूर)",
    date: "यात्रा दिनांक",
    busType: "बस प्रकार",
    totalPax: "कुल यात्री",
    conductorSign: "कंडक्टर / व्यवस्थापक हस्ताक्षर",
    generatedOn: "प्रिंट समय",
    page: "पृष्ठ",
    confidentialNotice:
      "गोपनीय: आधार संख्या विवरण शामिल हैं। केवल बोर्डिंग एवं परिचालन सत्यापन हेतु। सुरक्षित रखें।",
    paid: "भुगतान पूर्ण",
    pending: "बाकी",
  },
  gu: {
    manifestTitle: "મુસાફરોની યાદી (પેસેન્જર મેનિફેસ્ટ)",
    tour: "પ્રવાસનું નામ",
    date: "મુસાફરી તારીખ",
    busType: "બસ પ્રકાર",
    totalPax: "કુલ મુસાફરો",
    conductorSign: "કંડક્ટર / મેનેજર સહી",
    generatedOn: "પ્રિન્ટ સમય",
    page: "પૃષ્ઠ",
    confidentialNotice:
      "ખાનગી: આધાર નંબર વિગતો શામેલ છે. ફક્ત પ્રવાસ ચકાસણી માટે જ ઉપયોગ કરો. સુરક્ષિત રાખો.",
    paid: "ચૂકવેલ",
    pending: "બાકી",
  },
}

/**
 * Groups and sorts passengers by pickup point for boarding coordination.
 * - Groups sorted by pickup time (earliest first), then alphabetical
 * - "No Pickup Point" group is always last
 * - Inside each group, passengers are sorted by natural seat number
 */
export function groupPassengersByPickup(passengers = [], layoutKeyOrBusType) {
  const groupsMap = new Map()

  for (const p of passengers) {
    const rawPoint = p.pickupPoint || p.pickup || p.city || ""
    const point = rawPoint.trim() || "No pickup point"
    const rawTime = p.pickupTime ? String(p.pickupTime).trim() : ""

    if (!groupsMap.has(point)) {
      groupsMap.set(point, {
        pickupPoint: point,
        pickupTime: rawTime,
        passengers: [],
      })
    }
    const group = groupsMap.get(point)
    if (!group.pickupTime && rawTime) {
      group.pickupTime = rawTime
    }
    group.passengers.push(p)
  }

  // Sort groups
  const groups = Array.from(groupsMap.values())
  groups.sort((a, b) => {
    const isANone = a.pickupPoint.toLowerCase().includes("no pickup")
    const isBNone = b.pickupPoint.toLowerCase().includes("no pickup")
    if (isANone && !isBNone) return 1
    if (!isANone && isBNone) return -1

    if (a.pickupTime && b.pickupTime) {
      const cmp = a.pickupTime.localeCompare(b.pickupTime, undefined, { numeric: true })
      if (cmp !== 0) return cmp
    } else if (a.pickupTime && !b.pickupTime) {
      return -1
    } else if (!a.pickupTime && b.pickupTime) {
      return 1
    }

    return a.pickupPoint.localeCompare(b.pickupPoint, undefined, { sensitivity: "base" })
  })

  // Sort passengers inside each group by natural seat number
  for (const group of groups) {
    group.passengers.sort((a, b) =>
      compareSeats(a?.seat || a?.seatId, b?.seat || b?.seatId, layoutKeyOrBusType),
    )
  }

  return groups
}

/**
 * Renders complete, print-ready, sandboxed HTML document string for the passenger manifest.
 *
 * @param {{
 *   manifest: {
 *     tourName?: string,
 *     dateStr?: string,
 *     busType?: string,
 *     companyName?: string,
 *     companyPhone?: string,
 *     companyAddress?: string,
 *     totalPax?: number,
 *   },
 *   passengers: Array<Record<string, any>>,
 *   columns: string[],
 *   language?: "en" | "hi" | "gu",
 *   sort?: "seat" | "name" | "booking",
 *   aadhaarMode?: "full" | "last4",
 *   orientation?: "auto" | "portrait" | "landscape",
 *   showCompanyHeader?: boolean,
 *   generatedAt?: string | Date,
 * }} options
 * @returns {string}
 */
export function renderManifestHtml({
  manifest = {},
  passengers = [],
  columns = [],
  language = "en",
  sort = "seat",
  aadhaarMode = "last4",
  orientation = "auto",
  showCompanyHeader = true,
  groupByPickup = false,
  generatedAt = new Date(),
} = {}) {
  const activeLang = I18N[language] || I18N.en
  const normColumns = normalizeColumnSelection(columns)
  const effectiveLayout = manifest?.layoutKey || manifest?.busType

  let rows = []
  let groupsWithRows = []

  if (groupByPickup) {
    const groups = groupPassengersByPickup(passengers, effectiveLayout)
    let runningSr = 1
    groupsWithRows = groups.map((g) => {
      const gRows = g.passengers.map((p) => {
        const row = { _original: p }
        for (const colId of normColumns) {
          switch (colId) {
            case "srNo":
              row.srNo = runningSr++
              break
            case "name":
              row.name = p.name ? String(p.name).trim() : "—"
              break
            case "seat":
              row.seat = displaySeat(p.seat || p.seatId, effectiveLayout)
              break
            case "gender":
              row.gender = p.gender ? String(p.gender).trim().toUpperCase().charAt(0) : "—"
              break
            case "age":
              row.age = p.age !== undefined && p.age !== null && p.age !== "" ? String(p.age) : "—"
              break
            case "mobile":
              row.mobile = p.mobile || p.contact || p.phone || "—"
              break
            case "city":
              row.city = p.city ? String(p.city).trim() : "—"
              break
            case "pickup":
              row.pickup = p.pickup || p.pickupPoint || "—"
              break
            case "bookingRef":
              row.bookingRef = p.bookingRef || p.invoiceNo || "—"
              break
            case "paymentStatus":
              row.paymentStatus = p.paymentStatus || (p.isPaid ? "Paid" : "Pending") || "—"
              break
            case "balanceDue": {
              const bal =
                p.balanceDue !== undefined && p.balanceDue !== null ? Number(p.balanceDue) : 0
              row.balanceDue = bal > 0 ? `₹${bal.toLocaleString("en-IN")}` : "Nil"
              break
            }
            case "aadhaar":
              row.aadhaar = formatAadhaar(p.aadhaar || p.aadhar, aadhaarMode)
              break
            case "boarded":
              row.boarded = Boolean(p.boarded || p.checkedIn)
              break
            case "remarks":
              row.remarks = p.remarks ? String(p.remarks).trim() : ""
              break
            default:
              row[colId] = p[colId] !== undefined && p[colId] !== null ? String(p[colId]) : "—"
              break
          }
        }
        return row
      })
      return { ...g, rows: gRows }
    })
    rows = groupsWithRows.flatMap((g) => g.rows)
  } else {
    rows = buildManifestRows({
      passengers,
      columns: normColumns,
      sort,
      aadhaarMode,
      layoutKey: manifest?.layoutKey,
      busType: manifest?.busType,
    })
  }

  // Auto orientation: if columns count > 7 or orientation is explicit landscape
  const effectiveOrientation =
    orientation === "landscape" || (orientation === "auto" && normColumns.length > 7)
      ? "landscape"
      : "portrait"

  const columnDefs = normColumns
    .map((id) => MANIFEST_COLUMNS.find((c) => c.id === id))
    .filter(Boolean)

  const hasAadhaar = normColumns.includes("aadhaar")

  const formattedDate =
    manifest.dateStr ||
    (manifest.journeyDate ? new Date(manifest.journeyDate).toISOString().slice(0, 10) : "—")

  const genDateStr =
    typeof generatedAt === "string"
      ? generatedAt
      : new Date(generatedAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })

  const getColLabel = (col) => {
    if (language === "hi" && col.labelHi) return col.labelHi
    if (language === "gu" && col.labelGu) return col.labelGu
    return col.label
  }

  // Header section
  const companyTitle = manifest.companyName || "YATRA HUB"
  const companyPhone = manifest.companyPhone || ""
  const companyAddress = manifest.companyAddress || ""

  return `<!DOCTYPE html>
<html lang="${escapeHtml(language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
  <title>${escapeHtml(activeLang.manifestTitle)} - ${escapeHtml(manifest.tourName || "Tour")}</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #ffffff;
      color: #0f172a;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Devanagari", "Noto Sans Gujarati", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
    }
    @page {
      size: A4 ${effectiveOrientation};
      margin: 8mm 8mm 10mm 8mm;
    }
    @media print {
      body {
        width: 100% !important;
        background: #ffffff !important;
      }
      .no-print {
        display: none !important;
      }
      .chk-box {
        border-color: #000000 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    .manifest-container {
      width: 100%;
      max-width: 100%;
      padding: 4px;
    }
    .company-header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 8px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .company-name {
      font-size: 18px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.02em;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 10px;
      color: #475569;
      margin-top: 2px;
    }
    .manifest-badge {
      text-align: right;
    }
    .manifest-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .meta-value {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 1px;
    }
    table.manifest-table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      font-size: 10px;
    }
    table.manifest-table thead {
      display: table-header-group;
    }
    table.manifest-table tfoot {
      display: table-footer-group;
    }
    table.manifest-table tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table.manifest-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 6px 4px;
      border: 1px solid #94a3b8;
    }
    table.manifest-table td {
      padding: 5px 4px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
      color: #1e293b;
    }
    table.manifest-table tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .chk-box {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 1.5px solid #334155;
      border-radius: 2px;
      background: #ffffff;
      vertical-align: middle;
      box-sizing: border-box;
    }
    .write-in-cell {
      display: inline-block;
      min-width: 48px;
      min-height: 14px;
    }
    .footer-sign-block {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sign-line {
      width: 200px;
      border-top: 1px solid #475569;
      text-align: center;
      padding-top: 4px;
      font-size: 9.5px;
      font-weight: 600;
      color: #334155;
    }
    .aadhaar-warning {
      margin-top: 12px;
      padding: 6px 10px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 3px solid #d97706;
      border-radius: 3px;
      color: #92400e;
      font-size: 9px;
      font-weight: 600;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pickup-group-banner {
      background: #e0f2fe;
      border: 1px solid #7dd3fc;
      border-left: 4px solid #0284c7;
      padding: 6px 10px;
      margin-top: 14px;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-after: avoid;
      break-after: avoid;
    }
    .pickup-group-title {
      font-weight: 800;
      font-size: 11px;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .pickup-group-count {
      font-weight: 700;
      font-size: 10px;
      color: #0c4a6e;
    }
    .system-footer {
      margin-top: 16px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #64748b;
      font-size: 8.5px;
    }
  </style>
</head>
<body>
  <div class="manifest-container">
    ${
      showCompanyHeader
        ? `
    <header class="company-header">
      <div>
        <div class="company-name">${escapeHtml(companyTitle)}</div>
        ${companyPhone || companyAddress ? `<div class="company-sub">${escapeHtml([companyPhone, companyAddress].filter(Boolean).join(" • "))}</div>` : ""}
      </div>
      <div class="manifest-badge">
        <div class="manifest-title">${escapeHtml(activeLang.manifestTitle)}</div>
      </div>
    </header>
    `
        : `
    <header class="company-header" style="justify-content: center; text-align: center;">
      <div class="manifest-title" style="font-size: 16px;">${escapeHtml(activeLang.manifestTitle)}</div>
    </header>
    `
    }

    <section class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">${escapeHtml(activeLang.tour)}</span>
        <span class="meta-value">${escapeHtml(manifest.tourName || "All Tours")}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">${escapeHtml(activeLang.date)}</span>
        <span class="meta-value">${escapeHtml(formattedDate)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">${escapeHtml(activeLang.busType)}</span>
        <span class="meta-value">${escapeHtml(manifest.busType || "2x1 Sleeper Luxury")}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">${escapeHtml(activeLang.totalPax)}</span>
        <span class="meta-value">${escapeHtml(String(rows.length))} PAX</span>
      </div>
    </section>

    ${
      groupByPickup
        ? groupsWithRows.length === 0
          ? `<table class="manifest-table"><tbody><tr><td style="text-align: center; padding: 24px; color: #64748b;">No passengers found for this departure.</td></tr></tbody></table>`
          : groupsWithRows
              .map(
                (grp) => `
    <div class="pickup-group-banner">
      <span class="pickup-group-title">📍 ${escapeHtml(grp.pickupPoint)}${grp.pickupTime ? ` (${escapeHtml(grp.pickupTime)})` : ""}</span>
      <span class="pickup-group-count">${escapeHtml(String(grp.rows.length))} ${grp.rows.length === 1 ? "Passenger" : "Passengers"}</span>
    </div>
    <table class="manifest-table" style="margin-bottom: 12px;">
      <thead>
        <tr>
          ${columnDefs
            .map(
              (col) => `
          <th style="width: ${escapeHtml(col.width)}; text-align: ${escapeHtml(col.align)};">
            ${escapeHtml(getColLabel(col))}
          </th>`,
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${grp.rows
          .map(
            (row) => `
        <tr>
          ${columnDefs
            .map((col) => {
              const val = row[col.id]
              let cellContent = escapeHtml(String(val !== undefined && val !== null ? val : "—"))
              if (col.id === "boarded") {
                cellContent = `<span class="chk-box"></span>`
              } else if (col.id === "remarks") {
                cellContent = `<span class="write-in-cell"></span>`
              }
              return `<td style="text-align: ${escapeHtml(col.align)};">${cellContent}</td>`
            })
            .join("")}
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>`,
              )
              .join("")
        : `
    <table class="manifest-table">
      <thead>
        <tr>
          ${columnDefs
            .map(
              (col) => `
          <th style="width: ${escapeHtml(col.width)}; text-align: ${escapeHtml(col.align)};">
            ${escapeHtml(getColLabel(col))}
          </th>`,
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length === 0
            ? `<tr><td colspan="${columnDefs.length}" style="text-align: center; padding: 24px; color: #64748b;">No passengers found for this departure.</td></tr>`
            : rows
                .map(
                  (row) => `
        <tr>
          ${columnDefs
            .map((col) => {
              const val = row[col.id]
              let cellContent = escapeHtml(String(val !== undefined && val !== null ? val : "—"))
              if (col.id === "boarded") {
                cellContent = `<span class="chk-box"></span>`
              } else if (col.id === "remarks") {
                cellContent = `<span class="write-in-cell"></span>`
              }
              return `<td style="text-align: ${escapeHtml(col.align)};">${cellContent}</td>`
            })
            .join("")}
        </tr>`,
                )
                .join("")
        }
      </tbody>
    </table>`
    }

    ${
      hasAadhaar
        ? `
    <div class="aadhaar-warning">
      ⚠️ ${escapeHtml(activeLang.confidentialNotice)}
    </div>`
        : ""
    }

    <footer class="footer-sign-block">
      <div style="font-size: 9px; color: #64748b;">
        ${escapeHtml(activeLang.totalPax)}: <strong>${escapeHtml(String(rows.length))}</strong>
      </div>
      <div class="sign-line">
        ${escapeHtml(activeLang.conductorSign)}
      </div>
    </footer>

    <div class="system-footer">
      <span>YatraHub • ${escapeHtml(activeLang.generatedOn)}: ${escapeHtml(genDateStr)}</span>
      <span>${escapeHtml(activeLang.page)} 1</span>
    </div>
  </div>
</body>
</html>`
}

/**
 * Builds formatted WhatsApp text for driver / tour coordinator.
 * Groups passengers by pickup stop with continuous sequence numbers.
 * STRICT PRIVACY: NEVER includes Aadhaar details.
 */
export function buildPickupWiseWhatsAppText({
  manifest = {},
  passengers = [],
  columns = [],
} = {}) {
  const effectiveLayout = manifest.layoutKey || manifest.busType
  const groups = groupPassengersByPickup(passengers, effectiveLayout)
  const normColumns = normalizeColumnSelection(columns)
  const includePhone = normColumns.includes("mobile") || normColumns.includes("phone")
  const includeBalance = normColumns.includes("balanceDue")

  const companyTitle = manifest.companyName || "YatraHub"
  const tourName = manifest.tourName || "Tour"
  const dateStr =
    manifest.dateStr ||
    (manifest.journeyDate ? new Date(manifest.journeyDate).toISOString().slice(0, 10) : "")
  const busType = manifest.busType || "Coach"

  let text = `*📍 ${companyTitle.toUpperCase()} - PICKUP PASSENGER LIST*\n`
  text += `🚌 *Tour:* ${tourName}\n`
  text += `📅 *Date:* ${dateStr} • *Bus:* ${busType}\n`
  text += `👥 *Total Passengers:* ${passengers.length}\n`
  text += `──────────────────────\n\n`

  if (groups.length === 0 || passengers.length === 0) {
    text += `_No passengers booked for this departure._\n`
    return text
  }

  let runningNumber = 1
  for (const group of groups) {
    const timeText = group.pickupTime ? ` (${group.pickupTime})` : ""
    text += `*📍 ${group.pickupPoint.toUpperCase()}${timeText} — ${group.passengers.length} Pax*\n`

    group.passengers.forEach((p) => {
      const name = p.name ? String(p.name).trim() : "Traveler"
      const seat = displaySeat(p.seat || p.seatId, effectiveLayout)
      const phone = p.mobile || p.contact || p.phone || ""
      const phoneText = includePhone && phone ? ` • 📞 ${phone}` : ""

      let balText = ""
      if (includeBalance) {
        const bal = p.balanceDue !== undefined ? Number(p.balanceDue) : 0
        balText = bal > 0 ? ` • [Due: ₹${bal.toLocaleString("en-IN")}]` : ` • [Paid]`
      }

      text += `${runningNumber}. ${name} — Seat: *${seat}*${phoneText}${balText}\n`
      runningNumber++
    })
    text += `\n`
  }

  text += `──────────────────────\n`
  text += `_Note: Confidential coordinator manifest. Strictly for boarding operations._`
  return text.trim()
}
