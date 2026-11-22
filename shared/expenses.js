/**
 * YatraHub (TBS) — Pure Shared Expenses Utilities & Catalogs (Part 4a)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (routes/validation) and frontend (UI/formatters).
 */

import { financialYearOf } from "./documentTypes.js"

/**
 * Rounds a number to exactly 2 decimal places for Indian Rupee accounting.
 * @param {number|string} num
 * @returns {number}
 */
export function round2(num) {
  const n = Number(num)
  if (isNaN(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Fixed Built-in Expense Categories.
 * Exported as a frozen ARRAY for UI iteration and an object MAP for O(1) lookups.
 */
export const EXPENSE_CATEGORIES = Object.freeze([
  {
    id: "fuel",
    label: "Fuel & Diesel",
    labelHi: "ईंधन / डीज़ल",
    labelGu: "ઈંધણ / ડીઝલ",
    icon: "Fuel",
    description: "Diesel, petrol, CNG for bus and pilot vehicles",
  },
  {
    id: "toll",
    label: "Toll & Fastag",
    labelHi: "टोल टैक्स / फास्टैग",
    labelGu: "ટોલ ટેક્સ / ફાસ્ટેગ",
    icon: "CreditCard",
    description: "National and state highway toll booths and Fastag recharges",
  },
  {
    id: "driver-allowance",
    label: "Driver & Conductor Allowance",
    labelHi: "चालक / परिचालक भत्ता",
    labelGu: "ડ્રાઈવર / કંડક્ટર ભથ્થું",
    icon: "UserCheck",
    description: "Daily bhatta, food allowance, overtime and driver tips",
  },
  {
    id: "bus-hire",
    label: "Bus / Vehicle Hire",
    labelHi: "बस / वाहन किराया",
    labelGu: "બસ / વાહન ભાડું",
    icon: "Bus",
    description: "Third-party coach leasing, backup bus hiring, and tempo rent",
  },
  {
    id: "food",
    label: "Food & Pilgrim Meals",
    labelHi: "खान-पान / भोजन",
    labelGu: "ભોજન / ખાણીપીણી",
    icon: "Utensils",
    description: "Pilgrim meals, langar contribution, chai-nashta, water bottles",
  },
  {
    id: "accommodation",
    label: "Accommodation & Dharamshala",
    labelHi: "आवास / धर्मशाला व होटल",
    labelGu: "હોટેલ / ધર્મશાળા",
    icon: "Hotel",
    description: "Dharamshala, guest house, hotel rooms and tent stays",
  },
  {
    id: "permit-tax",
    label: "Permit, Taxes & Parking",
    labelHi: "परमिट, टैक्स व पार्किंग",
    labelGu: "પરમિટ, ટેક્સ અને પાર્કિંગ",
    icon: "FileText",
    description: "Inter-state passenger tax, temporary permits, border tax, parking fees",
  },
  {
    id: "maintenance",
    label: "Vehicle Maintenance & Repairs",
    labelHi: "वाहन मरम्मत व सर्विस",
    labelGu: "વાહન રિપેરિંગ / સર્વિસ",
    icon: "Wrench",
    description: "Tyre puncture, oil changes, spare parts, emergency repairs",
  },
  {
    id: "commission",
    label: "Agent Commission & Booking Fees",
    labelHi: "एजेंट कमीशन / दलाली",
    labelGu: "એજન્ટ કમિશન",
    icon: "Percent",
    description: "Commissions paid to booking agents, travel desks and promoters",
  },
  {
    id: "advertising",
    label: "Marketing & Advertising",
    labelHi: "विज्ञापन व प्रचार",
    labelGu: "જાહેરાત અને માર્કેટિંગ",
    icon: "Megaphone",
    description: "Banner prints, pamphlets, newspaper notices, WhatsApp/SMS outreach",
  },
  {
    id: "office",
    label: "Office & Administrative",
    labelHi: "कार्यालय व उपयोगिता",
    labelGu: "ઓફિસ ખર્ચ",
    icon: "Building2",
    description: "Office rent, electricity, stationery, ticket printing paper",
  },
  {
    id: "salary",
    label: "Staff Salary & Wages",
    labelHi: "कर्मचारी वेतन",
    labelGu: "સ્ટાફ પગાર",
    icon: "Users",
    description: "Monthly staff wages, cleaners, helpers, and office staff",
  },
  {
    id: "other",
    label: "Other Miscellaneous",
    labelHi: "अन्य विविध खर्च",
    labelGu: "અન્ય પરચૂરણ ખર્ચ",
    icon: "HelpCircle",
    description: "Emergency expenses, puja expenses, or unforeseen yatra costs",
  },
])

export const EXPENSE_CATEGORY_MAP = Object.freeze(
  Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, c])),
)

export const EXPENSE_CATEGORY_IDS = Object.freeze(EXPENSE_CATEGORIES.map((c) => c.id))

/**
 * Payment Modes for Expenses
 */
export const EXPENSE_PAYMENT_MODES = Object.freeze([
  { id: "cash", label: "Cash", labelHi: "नकद", labelGu: "રોકડ" },
  { id: "upi", label: "UPI / QR", labelHi: "यूपीआई / क्यूआर", labelGu: "યુપીઆઈ" },
  { id: "bank", label: "Bank Transfer / NEFT", labelHi: "बैंक ट्रांसफर", labelGu: "બેંક ટ્રાન્સફર" },
  { id: "card", label: "Card", labelHi: "कार्ड", labelGu: "કાર્ડ" },
  { id: "cheque", label: "Cheque / DD", labelHi: "चेक", labelGu: "ચેક" },
])

export const EXPENSE_PAYMENT_MODE_MAP = Object.freeze(
  Object.fromEntries(EXPENSE_PAYMENT_MODES.map((m) => [m.id, m])),
)

export const EXPENSE_PAYMENT_MODE_IDS = Object.freeze(EXPENSE_PAYMENT_MODES.map((m) => m.id))

/**
 * Payment Statuses for Expenses
 */
export const EXPENSE_STATUSES = Object.freeze([
  { id: "paid", label: "Paid", labelHi: "भुगतान किया गया", labelGu: "ચુકવાયેલ" },
  { id: "pending", label: "Pending", labelHi: "बाकी / देय", labelGu: "બાકી" },
])

export const EXPENSE_STATUS_MAP = Object.freeze(
  Object.fromEntries(EXPENSE_STATUSES.map((s) => [s.id, s])),
)

export const EXPENSE_STATUS_IDS = Object.freeze(EXPENSE_STATUSES.map((s) => s.id))

/**
 * Sums amounts with zero floating point drift using integer paise internally.
 * @param {Array<{ amount?: number|string }>} expenses
 * @returns {number} Sum in rupees rounded to 2 decimals
 */
export function sumAmounts(expenses = []) {
  if (!Array.isArray(expenses) || expenses.length === 0) return 0
  let totalPaise = 0
  for (const exp of expenses) {
    if (!exp) continue
    const amt = Number(exp.amount)
    if (!isNaN(amt) && amt > 0) {
      totalPaise += Math.round(amt * 100)
    }
  }
  return totalPaise / 100
}

/**
 * Aggregates expenses by category with totals, counts, and percentages.
 * @param {Array<Object>} expenses
 * @returns {Array<{ id: string, label: string, labelHi: string, labelGu: string, icon: string, count: number, total: number, percentage: number }>}
 */
export function groupByCategory(expenses = []) {
  const totalAll = sumAmounts(expenses)
  const categoryPaise = new Map()
  const categoryCounts = new Map()

  for (const cat of EXPENSE_CATEGORIES) {
    categoryPaise.set(cat.id, 0)
    categoryCounts.set(cat.id, 0)
  }

  for (const exp of expenses || []) {
    if (!exp) continue
    const catId = exp.category || "other"
    const currentPaise = categoryPaise.get(catId) || 0
    const amt = Number(exp.amount)
    if (!isNaN(amt) && amt > 0) {
      categoryPaise.set(catId, currentPaise + Math.round(amt * 100))
      categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1)
    }
  }

  const result = []
  for (const cat of EXPENSE_CATEGORIES) {
    const paise = categoryPaise.get(cat.id) || 0
    const total = paise / 100
    const count = categoryCounts.get(cat.id) || 0
    const percentage = totalAll > 0 ? round2((total / totalAll) * 100) : 0

    result.push({
      id: cat.id,
      label: cat.label,
      labelHi: cat.labelHi,
      labelGu: cat.labelGu,
      icon: cat.icon,
      count,
      total,
      percentage,
    })
  }

  // Sort descending by total amount
  return result.sort((a, b) => b.total - a.total)
}

/**
 * Month names for human formatting.
 */
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/**
 * Groups expenses by calendar month and associates each month with its Indian Financial Year.
 * @param {Array<Object>} expenses
 * @returns {Array<{ key: string, label: string, fy: string, count: number, total: number, paidTotal: number, pendingTotal: number }>}
 */
export function groupByMonth(expenses = []) {
  const map = new Map()

  for (const exp of expenses || []) {
    if (!exp || !exp.date) continue
    const d = new Date(exp.date)
    if (isNaN(d.getTime())) continue

    const year = d.getFullYear()
    const month = d.getMonth()
    const key = `${year}-${String(month + 1).padStart(2, "0")}`
    const label = `${MONTH_NAMES[month]} ${year}`
    const fy = financialYearOf(d)

    if (!map.has(key)) {
      map.set(key, {
        key,
        label,
        fy,
        count: 0,
        totalPaise: 0,
        paidPaise: 0,
        pendingPaise: 0,
      })
    }

    const item = map.get(key)
    const amt = Number(exp.amount)
    if (!isNaN(amt) && amt > 0) {
      const paise = Math.round(amt * 100)
      item.count += 1
      item.totalPaise += paise
      if (exp.status === "pending") {
        item.pendingPaise += paise
      } else {
        item.paidPaise += paise
      }
    }
  }

  // Convert paise to rupees and sort chronologically (oldest to newest)
  return Array.from(map.values())
    .map((m) => ({
      key: m.key,
      label: m.label,
      fy: m.fy,
      count: m.count,
      total: m.totalPaise / 100,
      paidTotal: m.paidPaise / 100,
      pendingTotal: m.pendingPaise / 100,
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

/**
 * Filters an in-memory array of expenses by multiple criteria.
 * @param {Array<Object>} expenses
 * @param {Object} filters
 * @returns {Array<Object>}
 */
export function filterExpenses(expenses = [], filters = {}) {
  if (!Array.isArray(expenses)) return []
  const {
    from,
    to,
    category,
    tourRef,
    paymentMode,
    status,
    q,
  } = filters

  const normalizedQ = q ? String(q).trim().toLowerCase() : ""

  return expenses.filter((exp) => {
    if (!exp) return false

    // Date range filter
    if (from || to) {
      const expDate = exp.date ? new Date(exp.date).toISOString().split("T")[0] : ""
      if (from && expDate < from) return false
      if (to && expDate > to) return false
    }

    // Category filter
    if (category && category !== "all" && exp.category !== category) {
      return false
    }

    // Tour filter
    if (tourRef && tourRef !== "all") {
      if (tourRef === "general") {
        if (exp.tourRef) return false
      } else if (exp.tourRef !== tourRef) {
        return false
      }
    }

    // Payment mode filter
    if (paymentMode && paymentMode !== "all" && exp.paymentMode !== paymentMode) {
      return false
    }

    // Status filter
    if (status && status !== "all" && exp.status !== status) {
      return false
    }

    // Text search query
    if (normalizedQ) {
      const vendor = (exp.vendor || "").toLowerCase()
      const note = (exp.note || "").toLowerCase()
      const tourLabel = (exp.tourLabel || "").toLowerCase()
      const catLabel = (EXPENSE_CATEGORY_MAP[exp.category]?.label || "").toLowerCase()

      const matches =
        vendor.includes(normalizedQ) ||
        note.includes(normalizedQ) ||
        tourLabel.includes(normalizedQ) ||
        catLabel.includes(normalizedQ)

      if (!matches) return false
    }

    return true
  })
}
