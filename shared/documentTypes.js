/**
 * YatraHub (TBS) — Document Type Registry & Numbering Helpers (Part 3.7a)
 * Pure, zero-dependency ESM module shared across frontend and backend.
 */

export const DOCUMENT_TYPES = {
  "tax-invoice": {
    id: "tax-invoice",
    label: "Tax Invoice",
    defaultTitle: "TAX INVOICE",
    defaultPrefix: "INV",
    showGstBreakup: true,
    requiresPayment: true,
    numberSeriesKey: "tax-invoice",
    allowedBookingStates: ["Confirmed"],
    supportsValidUntil: false,
  },
  "bill-of-supply": {
    id: "bill-of-supply",
    label: "Bill of Supply",
    defaultTitle: "BILL OF SUPPLY",
    defaultPrefix: "BOS",
    showGstBreakup: false,
    requiresPayment: true,
    numberSeriesKey: "bill-of-supply",
    allowedBookingStates: ["Confirmed"],
    supportsValidUntil: false,
  },
  "quotation": {
    id: "quotation",
    label: "Quotation",
    defaultTitle: "QUOTATION",
    defaultPrefix: "QTN",
    showGstBreakup: false,
    requiresPayment: false,
    numberSeriesKey: "quotation",
    allowedBookingStates: ["Confirmed"],
    supportsValidUntil: true,
  },
  "proforma": {
    id: "proforma",
    label: "Proforma Invoice",
    defaultTitle: "PROFORMA INVOICE",
    defaultPrefix: "PRF",
    showGstBreakup: true,
    requiresPayment: true,
    numberSeriesKey: "proforma",
    allowedBookingStates: ["Confirmed"],
    supportsValidUntil: false,
  },
  "booking-confirmation": {
    id: "booking-confirmation",
    label: "Booking Confirmation",
    defaultTitle: "BOOKING CONFIRMATION",
    defaultPrefix: "BKC",
    showGstBreakup: false,
    requiresPayment: false,
    numberSeriesKey: "booking-confirmation",
    allowedBookingStates: ["Confirmed"],
    supportsValidUntil: false,
  },
  "credit-note": {
    id: "credit-note",
    label: "Credit Note",
    defaultTitle: "CREDIT NOTE",
    defaultPrefix: "CN",
    showGstBreakup: true,
    requiresPayment: false,
    numberSeriesKey: "credit-note",
    allowedBookingStates: ["Cancelled"],
    supportsValidUntil: false,
  },
}

export const DOCUMENT_TYPE_IDS = Object.freeze(Object.keys(DOCUMENT_TYPES))
export const DOCUMENT_TYPE_LIST = Object.freeze(Object.values(DOCUMENT_TYPES))

/**
 * Validates if the given string is a supported document type id.
 */
export function isValidType(type) {
  return typeof type === "string" && Boolean(DOCUMENT_TYPES[type])
}

/**
 * Returns document type configuration or null if invalid.
 */
export function getType(type) {
  return DOCUMENT_TYPES[type] || null
}

/**
 * Returns the Indian Financial Year string (April 1 to March 31).
 * Example:
 *   Date in 2026-03-31 -> "2025-26"
 *   Date in 2026-04-01 -> "2026-27"
 *   Date in 2026-10-15 -> "2026-27"
 *   Date in 2027-02-10 -> "2026-27"
 */
export function financialYearOf(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  const validDate = isNaN(d.getTime()) ? new Date() : d

  const month = validDate.getMonth() // 0-indexed: 0=Jan, 2=Mar, 3=Apr...
  const fullYear = validDate.getFullYear()

  if (month >= 3) {
    const nextYearTwoDigits = (fullYear + 1) % 100
    return `${fullYear}-${String(nextYearTwoDigits).padStart(2, "0")}`
  } else {
    const prevYear = fullYear - 1
    const currYearTwoDigits = fullYear % 100
    return `${prevYear}-${String(currYearTwoDigits).padStart(2, "0")}`
  }
}

/**
 * Formats a document number from its prefix, FY, sequence and padding.
 * @param {Object} options
 * @param {string} options.prefix - Document prefix (e.g. "INV")
 * @param {string} [options.fy] - Financial Year string (e.g. "2026-27")
 * @param {number} options.seq - Sequence counter integer
 * @param {number} [options.padding=3] - Digit padding (3 to 6)
 * @param {boolean} [options.includeFy=false] - Whether to include FY
 * @param {string} [options.separator="-"] - Delimiter character
 */
export function formatNumber({
  prefix,
  fy,
  seq = 1,
  padding = 3,
  includeFy = false,
  separator = "-",
}) {
  const safePrefix = String(prefix || "DOC").trim().toUpperCase()
  const safeSeq = Math.max(1, parseInt(seq, 10) || 1)
  const safePadding = Math.max(3, Math.min(6, parseInt(padding, 10) || 3))
  const seqStr = String(safeSeq).padStart(safePadding, "0")

  if (includeFy && fy) {
    return `${safePrefix}${separator}${fy}${separator}${seqStr}`
  }
  return `${safePrefix}${separator}${seqStr}`
}

/**
 * Default document settings per type.
 */
export function getDefaultDocumentSettings() {
  const settings = {}
  for (const [id, config] of Object.entries(DOCUMENT_TYPES)) {
    settings[id] = {
      enabled: true,
      prefix: config.defaultPrefix,
      title: config.defaultTitle,
      includeFy: false,
      padding: 3,
      resetPolicy: "never",
      terms: "",
      notes: "",
      validityDays: config.supportsValidUntil ? 30 : null,
      showGstBreakup: config.showGstBreakup,
    }
  }
  return settings
}
