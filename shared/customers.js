/**
 * YatraHub (TBS) — Pure Shared Customer Logic (Part 5a)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (Customer model, routes, backfill) and frontend (Customer UI, Booking form).
 */

import { round2 } from "./expenses.js"
import { computeLedgerTotals, calculateCancellationRefund } from "./businessLogic.js"
import { isBookingCancelled } from "./profitLoss.js"

export const CUSTOMER_TAGS = Object.freeze([
  "vip",
  "group-leader",
  "agent",
  "corporate",
  "pilgrim-group",
])

export const CUSTOMER_LANGUAGES = Object.freeze(["en", "hi", "gu"])

/**
 * Normalizes an Indian mobile phone number.
 * Accepts string or number in formats like:
 * - 9876543210
 * - 09876543210
 * - 919876543210
 * - +91 98765 43210
 * - +91-98765-43210
 *
 * Valid Indian mobile numbers are 10 digits starting with 6, 7, 8, or 9.
 *
 * @param {string|number|null|undefined} input
 * @returns {{ valid: boolean, normalized: string|null, display: string|null }}
 */
export function normalizeIndianMobile(input) {
  if (input === null || input === undefined) {
    return { valid: false, normalized: null, display: null }
  }

  const raw = String(input).trim()
  if (!raw) {
    return { valid: false, normalized: null, display: null }
  }

  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, "")

  let tenDigits = null

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    tenDigits = digits
  } else if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
    tenDigits = digits.slice(1)
  } else if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    tenDigits = digits.slice(2)
  } else if (digits.length === 13 && digits.startsWith("091") && /^[6-9]/.test(digits.slice(3))) {
    tenDigits = digits.slice(3)
  }

  if (!tenDigits) {
    return { valid: false, normalized: null, display: null }
  }

  const display = `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`
  return {
    valid: true,
    normalized: tenDigits,
    display,
  }
}

/**
 * Validates email format strictly without external dependencies.
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false
  const trimmed = email.trim()
  if (trimmed.length > 254) return false
  // Standard RFC-compatible regex suitable for user input
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  return emailRegex.test(trimmed)
}

/**
 * Picks the most representative display name from an array or list of candidate names.
 * Prefers the most complete, non-empty, clean title-cased name.
 *
 * @param {string|string[]|null|undefined} names
 * @returns {string}
 */
export function pickDisplayName(names) {
  const list = Array.isArray(names) ? names : [names]
  const cleaned = list
    .map((n) => (n && typeof n === "string" ? n.trim() : ""))
    .filter(Boolean)

  if (cleaned.length === 0) return ""

  // Choose the longest clean name as it usually contains first + last name
  let best = cleaned[0]
  for (const name of cleaned) {
    if (name.length > best.length) {
      best = name
    }
  }
  return best
}

/**
 * Summarizes customer metrics across their bookings using the authoritative P&L and Ledger accounting rules.
 *
 * Accounting Rules:
 * - Cancelled bookings do not add to bookedRevenue, active passengers, or outstanding.
 * - Retained cancellation fees from cancelled bookings are included in totalCancellationFees and collected cash.
 * - Active bookings contribute totalAmount to bookedRevenue, actual paid receipts to collected, and balance to outstanding.
 *
 * @param {Array<Object>} bookings
 * @returns {{
 *   totalBookings: number,
 *   totalPassengers: number,
 *   totalBookedRevenue: number,
 *   totalCollected: number,
 *   totalOutstanding: number,
 *   totalCancelledBookings: number,
 *   totalCancellationFees: number,
 *   firstBookingDate: string|null,
 *   lastBookingDate: string|null,
 *   isRepeat: boolean,
 *   destinations: string[],
 * }}
 */
export function summarizeCustomer(bookings = []) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return {
      totalBookings: 0,
      totalPassengers: 0,
      totalBookedRevenue: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      totalCancelledBookings: 0,
      totalCancellationFees: 0,
      firstBookingDate: null,
      lastBookingDate: null,
      isRepeat: false,
      destinations: [],
    }
  }

  let totalBookings = 0
  let totalPassengers = 0
  let totalBookedRevenue = 0
  let totalCollected = 0
  let totalOutstanding = 0
  let totalCancelledBookings = 0
  let totalCancellationFees = 0

  const destinationsSet = new Set()
  const dates = []

  for (const b of bookings) {
    const isCancelled = isBookingCancelled(b)
    const dateVal = b.journeyDate || b.date || b.createdAt
    if (dateVal) {
      const dStr = typeof dateVal === "string" ? dateVal.slice(0, 10) : new Date(dateVal).toISOString().slice(0, 10)
      dates.push(dStr)
    }

    if (isCancelled) {
      totalCancelledBookings++

      // Payment resolution for cancellation
      let totalPaid = 0
      if (Array.isArray(b.payments) && b.payments.length > 0) {
        const nonVoid = b.payments.filter((p) => !p.isVoid)
        if (nonVoid.length > 0) {
          const receipts = nonVoid.filter((p) => p.type !== "refund")
          totalPaid = round2(receipts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0))
        } else {
          totalPaid = Math.max(0, round2(Number(b.advanceReceived) || 0))
        }
      } else {
        totalPaid = Math.max(0, round2(Number(b.advanceReceived) || 0))
      }

      let fee = 0
      if (b.cancellationCharge !== undefined && b.cancellationCharge !== null && b.cancellationCharge !== "") {
        const charge = round2(b.cancellationCharge)
        fee = Math.min(totalPaid, Math.max(0, charge))
      } else if (b.refundAmount !== undefined && b.refundAmount !== null && b.refundAmount !== "") {
        const refund = Math.min(totalPaid, Math.max(0, round2(b.refundAmount)))
        fee = round2(totalPaid - refund)
      } else {
        try {
          const calc = calculateCancellationRefund({ totalPaid, cancellationCharge: 0 })
          fee = calc.cancellationCharge
        } catch {
          fee = 0
        }
      }

      totalCancellationFees = round2(totalCancellationFees + fee)
      totalCollected = round2(totalCollected + fee)
    } else {
      totalBookings++

      const total = round2(Number(b.totalAmount) || 0)
      let paid = 0
      if (Array.isArray(b.payments) && b.payments.length > 0) {
        const nonVoid = b.payments.filter((p) => !p.isVoid)
        if (nonVoid.length > 0) {
          paid = computeLedgerTotals(b.payments, total).advanceReceived
        } else {
          paid = Math.max(0, round2(Number(b.advanceReceived) || 0))
        }
      } else {
        paid = Math.max(0, round2(Number(b.advanceReceived) || 0))
      }

      const paxCount = Array.isArray(b.passengers) ? b.passengers.length : 0
      const balance = Math.max(0, round2(total - paid))

      totalPassengers += paxCount
      totalBookedRevenue = round2(totalBookedRevenue + total)
      totalCollected = round2(totalCollected + paid)
      totalOutstanding = round2(totalOutstanding + balance)

      if (b.tourName) {
        destinationsSet.add(b.tourName)
      }
    }
  }

  dates.sort()
  const firstBookingDate = dates.length > 0 ? dates[0] : null
  const lastBookingDate = dates.length > 0 ? dates[dates.length - 1] : null
  const destinations = Array.from(destinationsSet).sort()

  return {
    totalBookings,
    totalPassengers,
    totalBookedRevenue,
    totalCollected,
    totalOutstanding,
    totalCancelledBookings,
    totalCancellationFees,
    firstBookingDate,
    lastBookingDate,
    isRepeat: totalBookings > 1,
    destinations,
  }
}
