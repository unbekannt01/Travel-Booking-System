/**
 * YatraHub (TBS) — Pure Receivables & Aging Engine (Part 5b)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (reports/routes) and frontend (Outstanding screen, CSV).
 *
 * RULES:
 * 1. Aging Bases:
 *    - "journey" (default): Aging calculated from journeyDate (when the service/trip occurs).
 *    - "booking": Aging calculated from booking date (when the reservation was created).
 * 2. 5 Frozen Aging Buckets:
 *    - "not-due": Future dates relative to asOfDate (daysOverdue <= 0).
 *    - "0-30": 0 to 30 days past due.
 *    - "31-60": 31 to 60 days past due.
 *    - "61-90": 61 to 90 days past due.
 *    - "90-plus": 91+ days past due.
 * 3. Scope & Financial Parity:
 *    - Only active (non-cancelled) bookings with outstanding balance > 0 are included.
 *    - Cancelled bookings have zero balance due (P&L rule).
 *    - Financial metrics are derived via calculateBookingFinancials.
 */

import { round2 } from "./expenses.js"
import { calculateBookingFinancials } from "./profitLoss.js"

export const AGING_BUCKETS = Object.freeze([
  "not-due",
  "0-30",
  "31-60",
  "61-90",
  "90-plus",
])

export const AGING_BUCKET_LABELS = Object.freeze({
  "not-due": "Not Due",
  "0-30": "0–30 Days",
  "31-60": "31–60 Days",
  "61-90": "61–90 Days",
  "90-plus": "90+ Days",
})

/**
 * Normalizes a date or date string into YYYY-MM-DD.
 * @param {string|Date|number|null|undefined} d
 * @returns {string}
 */
export function toDateString(d) {
  if (!d) return ""
  if (typeof d === "string") {
    const match = d.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  const dateObj = new Date(d)
  if (isNaN(dateObj.getTime())) return ""
  const year = dateObj.getUTCFullYear()
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0")
  const day = String(dateObj.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Computes calendar day difference between asOfDate and refDate (asOfDate - refDate).
 * Uses UTC midnight comparison to prevent timezone drift.
 *
 * @param {string} asOfDateStr - YYYY-MM-DD
 * @param {string} refDateStr - YYYY-MM-DD
 * @returns {number} Positive if refDate is in the past, 0 if today, negative if in the future.
 */
export function calculateDayDiff(asOfDateStr, refDateStr) {
  if (!asOfDateStr || !refDateStr) return 0
  const d1 = new Date(asOfDateStr.slice(0, 10) + "T00:00:00Z")
  const d2 = new Date(refDateStr.slice(0, 10) + "T00:00:00Z")
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
  const diffMs = d1.getTime() - d2.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Classifies overdue days into one of the 5 canonical aging buckets.
 *
 * @param {number} dayDiff - asOfDate - refDate
 * @returns {"not-due"|"0-30"|"31-60"|"61-90"|"90-plus"}
 */
export function classifyAgingBucket(dayDiff) {
  if (dayDiff < 0) return "not-due"
  if (dayDiff <= 30) return "0-30"
  if (dayDiff <= 60) return "31-60"
  if (dayDiff <= 90) return "61-90"
  return "90-plus"
}

/**
 * Pure calculation of receivables aging report across active bookings.
 *
 * @param {Object} params
 * @param {Array<Object>} params.bookings - Array of raw or populated booking records
 * @param {string} [params.asOfDate] - Cut-off date YYYY-MM-DD (defaults to UTC today)
 * @param {"journey"|"booking"} [params.basis="journey"] - Aging calculation basis
 * @param {Map<string, Object>|Array<Object>} [params.customers] - Optional customer master records
 * @param {string} [params.tourName] - Optional tour name filter
 * @param {string} [params.bucket] - Optional bucket filter ("all" or one of AGING_BUCKETS)
 * @returns {Object} Receivables report object
 */
export function calculateReceivables({
  bookings = [],
  asOfDate,
  basis = "journey",
  customers = null,
  tourName = "",
  bucket = "all",
} = {}) {
  const asOf = asOfDate ? toDateString(asOfDate) : toDateString(new Date())
  const validBasis = basis === "booking" ? "booking" : "journey"

  // Build customer lookup map by ID and by normalized phone if provided
  const customerById = new Map()
  const customerByPhone = new Map()
  if (customers) {
    const list = Array.isArray(customers) ? customers : Array.from(customers.values())
    for (const c of list) {
      if (c._id) customerById.set(c._id.toString(), c)
      if (c.phone) customerByPhone.set(String(c.phone).trim(), c)
    }
  }

  const bucketTotals = {
    "not-due": 0,
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90-plus": 0,
  }

  const bucketCounts = {
    "not-due": 0,
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90-plus": 0,
  }

  let totalOutstanding = 0
  let totalOverdue = 0
  let maxOverdueDays = 0

  const allRows = []

  for (const b of bookings || []) {
    // 1. Skip cancelled bookings or bookings without outstanding balance
    const fin = calculateBookingFinancials(b)
    if (fin.isCancelled || fin.outstanding <= 0) continue

    // 2. Filter by tourName if specified
    if (tourName && tourName !== "all" && b.tourName !== tourName) continue

    // 3. Resolve reference date based on basis
    const journeyDateStr = toDateString(b.journeyDate || b.date)
    const bookingDateStr = toDateString(b.date || b.createdAt)
    const refDateStr = validBasis === "booking" ? (bookingDateStr || journeyDateStr) : (journeyDateStr || bookingDateStr)

    // 4. Calculate day difference and bucket
    const dayDiff = calculateDayDiff(asOf, refDateStr)
    const bucketKey = classifyAgingBucket(dayDiff)
    const daysOverdue = Math.max(0, dayDiff)
    const isOverdue = bucketKey !== "not-due"

    // 5. Accumulate bucket metrics
    bucketTotals[bucketKey] = round2(bucketTotals[bucketKey] + fin.outstanding)
    bucketCounts[bucketKey] += 1
    totalOutstanding = round2(totalOutstanding + fin.outstanding)
    if (isOverdue) {
      totalOverdue = round2(totalOverdue + fin.outstanding)
      if (daysOverdue > maxOverdueDays) {
        maxOverdueDays = daysOverdue
      }
    }

    // 6. Resolve customer info
    let cId = b.customerId ? b.customerId.toString() : null
    let cDoc = cId ? customerById.get(cId) : null
    if (!cDoc && b.contactPhone) {
      cDoc = customerByPhone.get(String(b.contactPhone).trim())
      if (cDoc && !cId) cId = cDoc._id.toString()
    }

    const customerName = (cDoc?.name || b.customerName || b.contactName || "Unknown Customer").trim()
    const customerPhone = (cDoc?.phone || b.customerPhone || b.contactPhone || "").trim()
    const customerCity = (cDoc?.city || b.customerCity || b.contactCity || "").trim()
    const customerLanguage = cDoc?.language || "en"
    const whatsappOptOut = Boolean(cDoc?.whatsappOptOut)

    allRows.push({
      bookingId: b._id ? b._id.toString() : (b.id || ""),
      invoiceNo: b.invoiceNo || b.bookingId || "N/A",
      customerId: cId || null,
      customerName,
      customerPhone,
      customerCity,
      customerLanguage,
      whatsappOptOut,
      tourName: b.tourName || "General",
      journeyDate: journeyDateStr,
      bookingDate: bookingDateStr,
      refDate: refDateStr,
      totalAmount: fin.bookedRevenue,
      collected: fin.collected,
      outstanding: fin.outstanding,
      daysOverdue,
      bucket: bucketKey,
      isOverdue,
    })
  }

  // Filter rows by bucket if specified (e.g. user clicked a bucket card)
  const filteredRows = bucket && bucket !== "all"
    ? allRows.filter((r) => r.bucket === bucket)
    : allRows

  // 7. Customer roll-up aggregation
  const customerMap = new Map()
  const UNLINKED_KEY = "unlinked"

  for (const row of filteredRows) {
    const key = row.customerId || (row.customerPhone ? `phone_${row.customerPhone}` : UNLINKED_KEY)
    if (!customerMap.has(key)) {
      const isUnlinked = !row.customerId
      customerMap.set(key, {
        customerId: row.customerId || (isUnlinked ? UNLINKED_KEY : key),
        customerName: isUnlinked && !row.customerPhone ? "No customer record" : row.customerName,
        customerPhone: row.customerPhone || "",
        customerCity: row.customerCity || "",
        customerLanguage: row.customerLanguage || "en",
        whatsappOptOut: Boolean(row.whatsappOptOut),
        isUnlinked,
        totalOutstanding: 0,
        overdueAmount: 0,
        notDueAmount: 0,
        oldestOverdueDays: 0,
        bookingsCount: 0,
        bucketBreakdown: {
          "not-due": 0,
          "0-30": 0,
          "31-60": 0,
          "61-90": 0,
          "90-plus": 0,
        },
        bookings: [],
      })
    }

    const cGroup = customerMap.get(key)
    cGroup.totalOutstanding = round2(cGroup.totalOutstanding + row.outstanding)
    cGroup.bucketBreakdown[row.bucket] = round2(cGroup.bucketBreakdown[row.bucket] + row.outstanding)
    if (row.isOverdue) {
      cGroup.overdueAmount = round2(cGroup.overdueAmount + row.outstanding)
      if (row.daysOverdue > cGroup.oldestOverdueDays) {
        cGroup.oldestOverdueDays = row.daysOverdue
      }
    } else {
      cGroup.notDueAmount = round2(cGroup.notDueAmount + row.outstanding)
    }
    cGroup.bookingsCount += 1
    cGroup.bookings.push(row)
  }

  // Sort customer groups by totalOutstanding descending
  const customersList = Array.from(customerMap.values()).sort(
    (a, b) => b.totalOutstanding - a.totalOutstanding,
  )

  return Object.freeze({
    asOfDate: asOf,
    basis: validBasis,
    totalOutstanding,
    totalOverdue,
    notDueAmount: bucketTotals["not-due"],
    oldestOverdueDays: maxOverdueDays,
    customersOwingCount: customersList.length,
    totalBookingsOwing: allRows.length,
    bucketTotals: Object.freeze(bucketTotals),
    bucketCounts: Object.freeze(bucketCounts),
    rows: Object.freeze(filteredRows),
    customers: Object.freeze(customersList),
  })
}
