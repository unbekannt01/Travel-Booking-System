/**
 * YatraHub (TBS) — Pure Shared CSV Engine (Part 6c)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (export/import routes) and frontend (DataManagement UI).
 */

import { normalizeIndianMobile } from "./customers.js"
import { EXPENSE_CATEGORY_IDS, EXPENSE_CATEGORIES, EXPENSE_PAYMENT_MODE_IDS } from "./expenses.js"

// Formula injection dangerous leading characters (Excel, LibreOffice, Google Sheets)
export const DANGEROUS_FORMULA_PREFIXES = Object.freeze(["=", "+", "-", "@", "\t", "\r"])

/**
 * Escapes a cell value against CSV formula injection (CSV Injection / Formula Injection).
 * If a string begins with dangerous prefix characters, prepends a single apostrophe (').
 * Numbers, booleans, null, and undefined are not apostrophe-prefixed.
 *
 * @param {any} value
 * @returns {string}
 */
export function sanitizeCell(value) {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") return String(value)
  const str = String(value)
  if (str.length === 0) return ""
  const firstChar = str.charAt(0)
  if (DANGEROUS_FORMULA_PREFIXES.includes(firstChar)) {
    return `'${str}`
  }
  return str
}

/**
 * Removes the formula injection guard apostrophe if present.
 *
 * @param {string} value
 * @returns {string}
 */
export function unsanitizeCell(value) {
  if (typeof value !== "string") return value
  if (value.startsWith("'") && value.length > 1) {
    const secondChar = value.charAt(1)
    if (DANGEROUS_FORMULA_PREFIXES.includes(secondChar)) {
      return value.slice(1)
    }
  }
  return value
}

/**
 * Formats a value for RFC 4180 CSV export with quotes if needed.
 *
 * @param {any} value
 * @returns {string}
 */
export function escapeCsvField(value) {
  const sanitized = sanitizeCell(value)
  // If field contains quote, comma, CR, or LF, wrap in quotes and double internal quotes
  if (sanitized.includes('"') || sanitized.includes(",") || sanitized.includes("\n") || sanitized.includes("\r")) {
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  return sanitized
}

/**
 * Generates an RFC 4180 compliant CSV string with UTF-8 BOM.
 *
 * @param {object} options
 * @param {Array<string|{ key: string, label: string }>} options.columns
 * @param {Array<object|Array>} options.rows
 * @param {boolean} [options.bom=true]
 * @param {string} [options.eol="\r\n"]
 * @returns {string}
 */
export function toCsv({ columns, rows, bom = true, eol = "\r\n" }) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return bom ? "\uFEFF" : ""
  }

  const colDefs = columns.map((col) => {
    if (typeof col === "string") {
      return { key: col, label: col }
    }
    return { key: col.key || col.id, label: col.label || col.name || col.key }
  })

  const headerLine = colDefs.map((c) => escapeCsvField(c.label)).join(",")

  const bodyLines = rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map((cell) => escapeCsvField(cell)).join(",")
    }
    return colDefs.map((col) => escapeCsvField(row[col.key])).join(",")
  })

  const csvBody = [headerLine, ...bodyLines].join(eol)
  return bom ? `\uFEFF${csvBody}` : csvBody
}

export const CSV_PARSER_LIMITS = Object.freeze({
  MAX_BYTES: 1_000_000,
  MAX_ROWS: 2_000,
  MAX_COLS: 30,
  MAX_CELL: 500,
  MAX_CELL_CHARS: 500,
})

/**
 * Pure RFC 4180 compliant CSV Parser with bounds enforcement and detailed error codes.
 *
 * @param {string} text
 * @param {object} [limits]
 * @param {number} [limits.maxBytes=1000000] 1 MB default
 * @param {number} [limits.maxRows=2000]
 * @param {number} [limits.maxCols=30]
 * @param {number} [limits.maxCell=500]
 * @returns {{ headers: string[], rows: Array<Record<string, string>>, rawRows: string[][], rowCount: number }}
 */
export function parseCsv(text, limits = {}) {
  const {
    maxBytes = CSV_PARSER_LIMITS.MAX_BYTES,
    maxRows = CSV_PARSER_LIMITS.MAX_ROWS,
    maxCols = CSV_PARSER_LIMITS.MAX_COLS,
    maxCell = CSV_PARSER_LIMITS.MAX_CELL,
  } = limits

  if (typeof text !== "string") {
    const err = new Error("CSV input must be a string")
    err.code = "INVALID_INPUT"
    throw err
  }

  // Byte length check
  const byteLength = typeof Buffer !== "undefined"
    ? Buffer.byteLength(text, "utf8")
    : new TextEncoder().encode(text).length

  if (byteLength > maxBytes) {
    const err = new Error(`CSV file size (${Math.round(byteLength / 1024)} KB) exceeds limit of ${Math.round(maxBytes / 1024)} KB`)
    err.code = "TOO_LARGE"
    throw err
  }

  // Strip BOM if present
  let cleanText = text
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1)
  }

  if (cleanText.trim().length === 0) {
    const err = new Error("CSV content is empty")
    err.code = "EMPTY"
    throw err
  }

  const rawRows = []
  let currentRow = []
  let currentField = ""
  let inQuotes = false
  let fieldStartIndex = 0
  const len = cleanText.length

  for (let i = 0; i < len; i++) {
    const ch = cleanText[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && cleanText[i + 1] === '"') {
          // Escaped quote ("")
          currentField += '"'
          i++
        } else {
          // End of quoted field
          inQuotes = false
        }
      } else {
        currentField += ch
      }
    } else {
      if (ch === '"') {
        if (currentField.length === 0) {
          inQuotes = true
        } else {
          // Stray quote inside unquoted field
          const err = new Error(`Unescaped quote at character index ${i}`)
          err.code = "BAD_QUOTE"
          throw err
        }
      } else if (ch === ",") {
        if (currentField.length > maxCell) {
          const err = new Error(`Cell value exceeds maximum allowed length of ${maxCell} characters`)
          err.code = "CELL_TOO_LONG"
          throw err
        }
        currentRow.push(unsanitizeCell(currentField.trim()))
        if (currentRow.length > maxCols) {
          const err = new Error(`Row exceeds maximum allowed columns (${maxCols})`)
          err.code = "TOO_MANY_COLUMNS"
          throw err
        }
        currentField = ""
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && i + 1 < len && cleanText[i + 1] === "\n") {
          i++ // skip LF
        }

        if (currentField.length > maxCell) {
          const err = new Error(`Cell value exceeds maximum allowed length of ${maxCell} characters`)
          err.code = "CELL_TOO_LONG"
          throw err
        }
        currentRow.push(unsanitizeCell(currentField.trim()))

        if (currentRow.length > maxCols) {
          const err = new Error(`Row exceeds maximum allowed columns (${maxCols})`)
          err.code = "TOO_MANY_COLUMNS"
          throw err
        }

        // Avoid adding a trailing completely empty row if the file ends with newline
        const isCompletelyEmptyRow = currentRow.length === 1 && currentRow[0] === ""
        if (!isCompletelyEmptyRow || rawRows.length > 0) {
          rawRows.push(currentRow)
          if (rawRows.length - 1 > maxRows) { // excluding header
            const err = new Error(`CSV exceeds maximum allowed rows (${maxRows})`)
            err.code = "TOO_MANY_ROWS"
            throw err
          }
        }
        currentRow = []
        currentField = ""
      } else {
        currentField += ch
      }
    }
  }

  // Handle final trailing field/row
  if (inQuotes) {
    const err = new Error("Unclosed quote at end of CSV")
    err.code = "BAD_QUOTE"
    throw err
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    if (currentField.length > maxCell) {
      const err = new Error(`Cell value exceeds maximum allowed length of ${maxCell} characters`)
      err.code = "CELL_TOO_LONG"
      throw err
    }
    currentRow.push(unsanitizeCell(currentField.trim()))
    if (currentRow.length > maxCols) {
      const err = new Error(`Row exceeds maximum allowed columns (${maxCols})`)
      err.code = "TOO_MANY_COLUMNS"
      throw err
    }
    rawRows.push(currentRow)
    if (rawRows.length - 1 > maxRows) {
      const err = new Error(`CSV exceeds maximum allowed rows (${maxRows})`)
      err.code = "TOO_MANY_ROWS"
      throw err
    }
  }

  // Remove any trailing purely empty row
  while (rawRows.length > 0 && rawRows[rawRows.length - 1].length === 1 && rawRows[rawRows.length - 1][0] === "") {
    rawRows.pop()
  }

  if (rawRows.length < 1) {
    const err = new Error("CSV has no headers or data")
    err.code = "EMPTY"
    throw err
  }

  const headers = rawRows[0].map((h) => h.trim())
  const dataRows = rawRows.slice(1)

  const rows = dataRows.map((rawRow) => {
    const obj = {}
    headers.forEach((header, idx) => {
      obj[header] = rawRow[idx] !== undefined ? rawRow[idx] : ""
    })
    return obj
  })

  return {
    headers,
    rows,
    rawRows,
    rowCount: rows.length,
  }
}

/**
 * Money parsing: Converts string representation of INR to integer paise.
 * E.g. "1250", "₹1,250.50", "1,250.50" -> 125050
 *
 * @param {string|number} input
 * @returns {{ valid: boolean, paise: number, error?: string }}
 */
export function parseMoney(input) {
  if (input === null || input === undefined || input === "") {
    return { valid: false, paise: 0, error: "Amount is required" }
  }

  const str = String(input).replace(/[₹,\s]/g, "").trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) {
    return { valid: false, paise: 0, error: "Invalid currency format" }
  }

  const num = parseFloat(str)
  if (isNaN(num) || num < 0) {
    return { valid: false, paise: 0, error: "Amount must be a non-negative number" }
  }

  const paise = Math.round(num * 100)
  return { valid: true, paise }
}

/**
 * Date parsing: Converts varied Indian and ISO date formats to ISO YYYY-MM-DD.
 * Supports: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD, DD.MM.YYYY.
 *
 * @param {string} input
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null if invalid
 */
export function parseDate(input) {
  if (!input || typeof input !== "string") return null
  const trimmed = input.trim()
  if (!trimmed) return null

  let year = null
  let month = null
  let day = null

  // Format 1: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10)
    month = parseInt(isoMatch[2], 10)
    day = parseInt(isoMatch[3], 10)
  }

  // Format 2: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const indianMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (indianMatch) {
    day = parseInt(indianMatch[1], 10)
    month = parseInt(indianMatch[2], 10)
    year = parseInt(indianMatch[3], 10)
  }

  if (!year || !month || !day) return null

  // Validate bounds
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null
  }

  // Days in month check (including leap year)
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const daysInMonths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (day > daysInMonths[month - 1]) {
    return null
  }

  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${year}-${mm}-${dd}`
}

/**
 * Boolean parsing: Parses yes/no, true/false, 1/0, ha/na in English, Hindi, Gujarati.
 *
 * @param {any} input
 * @param {boolean} [defaultValue=false]
 * @returns {boolean}
 */
export function parseBool(input, defaultValue = false) {
  if (input === null || input === undefined || input === "") return defaultValue
  const str = String(input).trim().toLowerCase()
  if (["true", "yes", "1", "y", "ha", "haan", "હા", "हाँ"].includes(str)) {
    return true
  }
  if (["false", "no", "0", "n", "na", "nahi", "ના", "नहीं"].includes(str)) {
    return false
  }
  return defaultValue
}

/**
 * Blood group validator
 */
const VALID_BLOOD_GROUPS = Object.freeze(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])

/**
 * Normalizes a header string for fuzzy alias matching.
 * E.g. "Customer Phone Number" -> "customerphonenumber"
 *
 * @param {string} str
 * @returns {string}
 */
function normalizeHeaderKey(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF]/g, "")
}

/**
 * Maps CSV file headers to canonical fields defined in a spec.
 * Detects missing required fields, unmapped columns, and security risks (like Aadhaar).
 *
 * @param {string[]} fileHeaders
 * @param {object} spec
 * @returns {{ mapping: Record<string, string>, unmapped: string[], missingRequired: string[], hasUnsafeAadhaarHeader: boolean }}
 */
export function mapHeaders(fileHeaders, spec) {
  const mapping = {}
  const unmapped = []
  let hasUnsafeAadhaarHeader = false

  const assignedFields = new Set()

  fileHeaders.forEach((rawHeader) => {
    const cleanHeader = rawHeader.trim()
    const norm = normalizeHeaderKey(cleanHeader)

    // Security check: Never accept Aadhaar/UID headers
    if (
      norm.includes("aadhaar") ||
      norm.includes("aadhar") ||
      norm.includes("uidai") ||
      norm === "uid"
    ) {
      hasUnsafeAadhaarHeader = true
    }

    let matchedField = null

    // Direct check against spec fields and their aliases
    for (const [fieldKey, fieldDef] of Object.entries(spec.fields)) {
      if (assignedFields.has(fieldKey)) continue

      if (normalizeHeaderKey(fieldKey) === norm || normalizeHeaderKey(fieldDef.label) === norm) {
        matchedField = fieldKey
        break
      }

      if (fieldDef.aliases) {
        for (const alias of fieldDef.aliases) {
          if (normalizeHeaderKey(alias) === norm) {
            matchedField = fieldKey
            break
          }
        }
      }

      if (matchedField) break
    }

    if (matchedField) {
      mapping[cleanHeader] = matchedField
      assignedFields.add(matchedField)
    } else {
      unmapped.push(cleanHeader)
    }
  })

  const missingRequired = []
  for (const [fieldKey, fieldDef] of Object.entries(spec.fields)) {
    if (fieldDef.required && !assignedFields.has(fieldKey)) {
      missingRequired.push(fieldKey)
    }
  }

  return {
    mapping,
    unmapped,
    missingRequired,
    hasUnsafeAadhaarHeader,
  }
}

// -----------------------------------------------------------------------------
// SPECIFICATIONS FOR IMPORT / EXPORT
// -----------------------------------------------------------------------------

/**
 * Customer Import Specification
 */
export const CUSTOMER_IMPORT_SPEC = Object.freeze({
  type: "customers",
  label: "Customers",
  fields: Object.freeze({
    name: Object.freeze({
      label: "Customer Name",
      required: true,
      aliases: ["name", "customer", "customer name", "full name", "client", "नाम", "ગ્રાહકનું નામ", "નામ"],
    }),
    phone: Object.freeze({
      label: "Mobile Number",
      required: true,
      aliases: [
        "phone",
        "mobile",
        "contact",
        "mobile number",
        "phone number",
        "contact phone",
        "cell",
        "ફોન",
        "મોબાઈલ",
        "મોબાઈલ નંબર",
        "मोबाइल",
        "फ़ोन",
      ],
    }),
    city: Object.freeze({
      label: "City / Village",
      required: false,
      aliases: ["city", "town", "village", "location", "address", "ગામ", "શહેર", "शहर", "गाँव"],
    }),
    email: Object.freeze({
      label: "Email Address",
      required: false,
      aliases: ["email", "email address", "mail", "ઈમેલ", "ईमेल"],
    }),
    emergencyContact: Object.freeze({
      label: "Emergency Contact",
      required: false,
      aliases: ["emergency", "emergency contact", "alternate phone", "alt phone", "બીજો ફોન", "आपातकालीन नंबर"],
    }),
    bloodGroup: Object.freeze({
      label: "Blood Group",
      required: false,
      aliases: ["blood group", "blood", "bg", "બ્લડ ગ્રુપ", "रक्त समूह"],
    }),
    notes: Object.freeze({
      label: "Notes / Remarks",
      required: false,
      aliases: ["notes", "remarks", "comments", "description", "નોંધ", "टिप्पणी"],
    }),
    whatsappOptOut: Object.freeze({
      label: "WhatsApp Opt-Out",
      required: false,
      aliases: ["whatsapp opt out", "no whatsapp", "opt out", "dnd", "વોટ્સએપ બંધ"],
    }),
  }),
})

/**
 * Helper to match category string to canonical category ID
 *
 * @param {string} val
 * @returns {string}
 */
export function matchExpenseCategory(val) {
  if (!val) return "other"
  const norm = normalizeHeaderKey(val)

  for (const cat of EXPENSE_CATEGORIES) {
    if (normalizeHeaderKey(cat.id) === norm || normalizeHeaderKey(cat.label) === norm) {
      return cat.id
    }
    if (cat.labelHi && normalizeHeaderKey(cat.labelHi) === norm) return cat.id
    if (cat.labelGu && normalizeHeaderKey(cat.labelGu) === norm) return cat.id
  }

  // Substring / keyword matches across En, Hi, Gu
  if (norm.includes("diesel") || norm.includes("fuel") || norm.includes("petrol") || norm.includes("cng") || norm.includes("ઈંધણ") || norm.includes("ईंधन")) return "fuel"
  if (norm.includes("toll") || norm.includes("fastag") || norm.includes("ટોલ") || norm.includes("टोल")) return "toll"
  if (norm.includes("driver") || norm.includes("bhatta") || norm.includes("allowance") || norm.includes("ભથ્થ") || norm.includes("भत्ता")) return "driver-allowance"
  if (norm.includes("hire") || norm.includes("rent") || norm.includes("lease") || norm.includes("ભાડ") || norm.includes("किराया")) return "bus-hire"
  if (norm.includes("food") || norm.includes("meal") || norm.includes("chai") || norm.includes("nashta") || norm.includes("lunch") || norm.includes("dinner") || norm.includes("ભોજન") || norm.includes("ખાણી") || norm.includes("खान") || norm.includes("भोजन")) return "food"
  if (norm.includes("hotel") || norm.includes("room") || norm.includes("dharamshala") || norm.includes("stay") || norm.includes("હોટેલ") || norm.includes("ધર્મશાળા") || norm.includes("धर्मशाला")) return "accommodation"
  if (norm.includes("permit") || norm.includes("tax") || norm.includes("parking") || norm.includes("પરમિટ") || norm.includes("ટેક્સ") || norm.includes("પાર્કિંગ")) return "permit-tax"
  if (norm.includes("repair") || norm.includes("tyre") || norm.includes("service") || norm.includes("maintenance") || norm.includes("રિપેર") || norm.includes("મરામત")) return "maintenance"
  if (norm.includes("commission") || norm.includes("agent") || norm.includes("કમિશન") || norm.includes("कमीशन")) return "commission"
  if (norm.includes("ad") || norm.includes("marketing") || norm.includes("pamphlet") || norm.includes("જાહેરાત") || norm.includes("प्रचार")) return "advertising"
  if (norm.includes("office") || norm.includes("electricity") || norm.includes("bill") || norm.includes("ઓફિસ") || norm.includes("कार्यालय")) return "office"
  if (norm.includes("salary") || norm.includes("wage") || norm.includes("staff") || norm.includes("પગાર") || norm.includes("वेतन")) return "salary"

  return "other"
}

/**
 * Helper to match payment mode
 *
 * @param {string} val
 * @returns {string}
 */
export function matchExpensePaymentMode(val) {
  if (!val) return "cash"
  const norm = normalizeHeaderKey(val)
  if (norm.includes("upi") || norm.includes("gpay") || norm.includes("phonepe") || norm.includes("paytm") || norm.includes("qr")) return "upi"
  if (norm.includes("bank") || norm.includes("neft") || norm.includes("rtgs") || norm.includes("imps") || norm.includes("transfer")) return "bank"
  if (norm.includes("card") || norm.includes("debit") || norm.includes("credit")) return "card"
  if (norm.includes("cheque") || norm.includes("check") || norm.includes("dd")) return "cheque"
  return "cash"
}

/**
 * Expense Import Specification
 */
export const EXPENSE_IMPORT_SPEC = Object.freeze({
  type: "expenses",
  label: "Expenses",
  fields: Object.freeze({
    date: Object.freeze({
      label: "Date",
      required: true,
      aliases: ["date", "expense date", "paid on", "तारीख", "તારીખ"],
    }),
    category: Object.freeze({
      label: "Category",
      required: true,
      aliases: ["category", "expense category", "head", "type", "खर्च प्रकार", "કેટેગરી"],
    }),
    amount: Object.freeze({
      label: "Amount (₹)",
      required: true,
      aliases: ["amount", "cost", "total", "rupees", "inr", "रकम", "રકમ"],
    }),
    account: Object.freeze({
      label: "Account (Cash / Bank)",
      required: false,
      aliases: ["account", "paid from", "cash bank", "ખાતું", "खाता"],
    }),
    paymentMode: Object.freeze({
      label: "Payment Mode",
      required: false,
      aliases: ["payment mode", "mode", "payment method", "ચુકવણી પ્રકાર", "भुगतान विधि"],
    }),
    vendor: Object.freeze({
      label: "Vendor / Payee",
      required: false,
      aliases: ["vendor", "payee", "paid to", "party", "વેપારી", "विक्रेता"],
    }),
    notes: Object.freeze({
      label: "Notes / Description",
      required: false,
      aliases: ["notes", "description", "remarks", "memo", "વિગત", "विवरण"],
    }),
  }),
})

// -----------------------------------------------------------------------------
// LOCALIZED STRINGS AND LABELS (English, Hindi, Gujarati)
// -----------------------------------------------------------------------------

export const CSV_LABELS = Object.freeze({
  en: {
    importTitle: "Import CSV Data",
    exportTitle: "Export System Data",
    downloadTemplate: "Download Template",
    chooseFile: "Choose CSV File",
    mapColumns: "Map Columns",
    previewData: "Preview & Validate",
    commitImport: "Commit Import",
    undoImport: "Undo Batch",
    step1: "1. Select Type & Template",
    step2: "2. Upload File",
    step3: "3. Map Columns",
    step4: "4. Preview & Finish",
    validRows: "Valid rows ready for import",
    invalidRows: "Rows with errors (will be skipped)",
    sampleTemplateNote: "Download a starter CSV template with example data and standard column headers.",
    unsafeAadhaarWarning: "Security Warning: CSV contains an Aadhaar/UID column. Aadhaar data cannot be imported or exported.",
    confirmUndoTitle: "Undo this import batch?",
    confirmUndoDesc: "This will remove the records imported in this batch, provided they are not locked by books close or referenced in active transactions.",
  },
  hi: {
    importTitle: "सीएसवी डेटा आयात करें (Import)",
    exportTitle: "सिस्टम डेटा निर्यात करें (Export)",
    downloadTemplate: "टेम्पलेट डाउनलोड करें",
    chooseFile: "सीएसवी फ़ाइल चुनें",
    mapColumns: "कॉलम मैप करें",
    previewData: "पूर्वावलोकन और जांचें",
    commitImport: "डेटा आयात करें",
    undoImport: "बैच पूर्ववत करें (Undo)",
    step1: "1. प्रकार व टेम्पलेट चुनें",
    step2: "2. फ़ाइल अपलोड करें",
    step3: "3. कॉलम मिलान",
    step4: "4. पूर्वावलोकन व पूर्ण करें",
    validRows: "आयात के लिए तैयार वैध पंक्तियाँ",
    invalidRows: "त्रुटिपूर्ण पंक्तियाँ (छोड़ दी जाएंगी)",
    sampleTemplateNote: "उदाहरण डेटा और मानक कॉलम शीर्षकों के साथ एक आरंभिक सीएसवी टेम्पलेट डाउनलोड करें।",
    unsafeAadhaarWarning: "सुरक्षा चेतावनी: सीएसवी में आधार/यूआईडी कॉलम है। आधार डेटा आयात या निर्यात नहीं किया जा सकता।",
    confirmUndoTitle: "क्या आप इस आयात बैच को पूर्ववत करना चाहते हैं?",
    confirmUndoDesc: "यह इस बैच में आयात किए गए रिकॉर्ड हटा देगा, यदि वे बंद बहीखाता या सक्रिय लेनदेन द्वारा सुरक्षित नहीं हैं।",
  },
  gu: {
    importTitle: "CSV ડેટા આયાત કરો (Import)",
    exportTitle: "સિસ્ટમ ડેટા નિકાસ કરો (Export)",
    downloadTemplate: "ટેમ્પલેટ ડાઉનલોડ કરો",
    chooseFile: "CSV ફાઇલ પસંદ કરો",
    mapColumns: "કોલમ મેપ કરો",
    previewData: "પૂર્વાવલોકન અને ચકાસણી",
    commitImport: "ડેટા આયાત કરો",
    undoImport: "બેચ પાછી ખેંચો (Undo)",
    step1: "1. પ્રકાર અને ટેમ્પલેટ પસંદ કરો",
    step2: "2. ફાઇલ અપલોડ કરો",
    step3: "3. કોલમ મેપિંગ",
    step4: "4. પૂર્વાવલોકન અને પૂરું કરો",
    validRows: "આયાત માટે માન્ય પંક્તિઓ",
    invalidRows: "ભૂલવાળી પંક્તિઓ (છોડી દેવાશે)",
    sampleTemplateNote: "નમૂનારૂપ ડેટા અને પ્રમાણિત કોલમ શીર્ષકો સાથેનું પ્રારંભિક CSV ટેમ્પલેટ ડાઉનલોડ કરો.",
    unsafeAadhaarWarning: "સુરક્ષા ચેતવણી: CSV માં આધાર કાર્ડ કોલમ છે. આધાર ડેટા ક્યારેય આયાત કે નિકાસ થઈ શકતો નથી.",
    confirmUndoTitle: "શું તમે આ આયાત બેચ રદ કરવા માંગો છો?",
    confirmUndoDesc: "આ બેચ દ્વારા આયાત થયેલ રેકોર્ડ્સ રદ થશે, જો તે બંધ ચોપડા કે સક્રિય વ્યવહારોમાં લૉક ન હોય.",
  },
})
