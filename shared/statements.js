/**
 * YatraHub (TBS) — Pure Customer Statement Engine (Part 5b)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (statement endpoint) and frontend (StatementModal, CSV).
 *
 * RULES:
 * 1. Financial Reconciliation:
 *    - Opening Balance: Net unpaid dues prior to `from` date (sum of debits minus credits).
 *    - Same-Day Ordering: Debits (bookings, cancellation fees) sort BEFORE credits (payments, refunds).
 *    - Closing Balance: openingBalance + totalDebits - totalCredits.
 *    - Parity: When `to` is today and `from` is beginning of time, closingBalance equals
 *      totalOutstanding in the receivables aging report.
 */

import { round2 } from "./expenses.js"
import { calculateBookingFinancials, isBookingCancelled } from "./profitLoss.js"
import { toDateString } from "./receivables.js"

/**
 * Builds a chronological customer account statement.
 *
 * @param {Object} params
 * @param {Object} params.customer - Customer document/record
 * @param {Array<Object>} params.bookings - Customer's bookings
 * @param {string} [params.from] - YYYY-MM-DD start date (optional)
 * @param {string} [params.to] - YYYY-MM-DD end date (optional, defaults to today)
 * @returns {Object} Structured statement object
 */
export function buildCustomerStatement({
  customer = {},
  bookings = [],
  from = "",
  to = "",
} = {}) {
  const fromDate = from ? toDateString(from) : ""
  const toDate = to ? toDateString(to) : toDateString(new Date())

  // Flatten transactions into a chronological timeline
  // Transaction structure: { date, type, ref, description, debit, credit, sortPriority }
  // sortPriority: 1 for Debits (booking charge, cancellation fee), 2 for Credits (payment, reversal), 3 for Refund debit
  const allTx = []

  for (const b of bookings || []) {
    const bookingId = b._id ? b._id.toString() : (b.id || "")
    const invoiceNo = b.invoiceNo || b.bookingId || "N/A"
    const tourName = b.tourName || "General Tour"
    const bookingDate = toDateString(b.date || b.createdAt)
    const totalAmount = round2(Number(b.totalAmount) || 0)
    const isCancelled = isBookingCancelled(b)
    const cancelledDate = toDateString(b.cancelledAt || bookingDate)

    if (!isCancelled) {
      // 1. Active booking creates a debit on booking date
      if (bookingDate && totalAmount > 0) {
        allTx.push({
          date: bookingDate,
          type: "booking",
          ref: invoiceNo,
          bookingId,
          description: `Booking #${invoiceNo} — ${tourName} (${Array.isArray(b.passengers) ? b.passengers.length : 1} seat/pax)`,
          debit: totalAmount,
          credit: 0,
          sortPriority: 1, // Debits first
        })
      }

      // 2. Payments on active booking
      if (Array.isArray(b.payments) && b.payments.length > 0) {
        for (const p of b.payments) {
          if (p.isVoid) continue
          const pAmount = round2(Number(p.amount) || 0)
          if (pAmount <= 0) continue
          const pDate = toDateString(p.date || p.createdAt || bookingDate)
          const modeLabel = (p.type || p.mode || "Payment").toUpperCase()
          const receiptRef = p.receiptNo || p.transactionId || invoiceNo

          allTx.push({
            date: pDate,
            type: "payment",
            ref: receiptRef,
            bookingId,
            description: `Payment received (${modeLabel}) for #${invoiceNo}${p.notes ? ` — ${p.notes}` : ""}`,
            debit: 0,
            credit: pAmount,
            sortPriority: 2, // Credits after debits
          })
        }
      } else if (Number(b.advanceReceived) > 0) {
        // Fallback if payments array not present
        const adv = round2(Number(b.advanceReceived))
        allTx.push({
          date: bookingDate,
          type: "payment",
          ref: invoiceNo,
          bookingId,
          description: `Advance received for #${invoiceNo}`,
          debit: 0,
          credit: adv,
          sortPriority: 2,
        })
      }
    } else {
      // Cancelled booking accounting
      const fin = calculateBookingFinancials(b)
      // Original booking debit
      if (bookingDate && totalAmount > 0) {
        allTx.push({
          date: bookingDate,
          type: "booking",
          ref: invoiceNo,
          bookingId,
          description: `Booking #${invoiceNo} — ${tourName} [Cancelled]`,
          debit: totalAmount,
          credit: 0,
          sortPriority: 1,
        })
      }

      // Recorded payments prior to cancellation
      if (Array.isArray(b.payments) && b.payments.length > 0) {
        for (const p of b.payments) {
          if (p.isVoid || p.type === "refund") continue
          const pAmount = round2(Number(p.amount) || 0)
          if (pAmount <= 0) continue
          const pDate = toDateString(p.date || p.createdAt || bookingDate)
          allTx.push({
            date: pDate,
            type: "payment",
            ref: p.receiptNo || invoiceNo,
            bookingId,
            description: `Payment received for #${invoiceNo}`,
            debit: 0,
            credit: pAmount,
            sortPriority: 2,
          })
        }
      } else if (fin.totalPaid > 0) {
        allTx.push({
          date: bookingDate,
          type: "payment",
          ref: invoiceNo,
          bookingId,
          description: `Payment received for #${invoiceNo}`,
          debit: 0,
          credit: fin.totalPaid,
          sortPriority: 2,
        })
      }

      // Cancellation reversal credit (reverses totalAmount)
      if (totalAmount > 0) {
        allTx.push({
          date: cancelledDate,
          type: "cancellation",
          ref: invoiceNo,
          bookingId,
          description: `Cancellation reversal for #${invoiceNo}`,
          debit: 0,
          credit: totalAmount,
          sortPriority: 2,
        })
      }

      // Cancellation fee debit (retained by operator)
      if (fin.cancellationFeesRetained > 0) {
        allTx.push({
          date: cancelledDate,
          type: "cancellation_fee",
          ref: invoiceNo,
          bookingId,
          description: `Cancellation fee retained for #${invoiceNo}`,
          debit: fin.cancellationFeesRetained,
          credit: 0,
          sortPriority: 1,
        })
      }

      // Refund paid to customer (debit out to restore balance to 0)
      if (fin.refundsPaid > 0) {
        allTx.push({
          date: cancelledDate,
          type: "refund",
          ref: invoiceNo,
          bookingId,
          description: `Refund processed to customer for #${invoiceNo}`,
          debit: fin.refundsPaid,
          credit: 0,
          sortPriority: 3,
        })
      }
    }
  }

  // Sort chronologically:
  // 1. date ascending
  // 2. sortPriority ascending (Debits before credits on the same day)
  allTx.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.sortPriority - b.sortPriority
  })

  // Partition transactions into:
  // - Prior to fromDate -> contributes to opening balance
  // - Within statement range (fromDate <= date <= toDate) -> statement lines
  let openingBalance = 0
  let periodDebits = 0
  let periodCredits = 0

  const lines = []
  let running = 0

  for (const tx of allTx) {
    if (fromDate && tx.date < fromDate) {
      openingBalance = round2(openingBalance + tx.debit - tx.credit)
    }
  }

  running = openingBalance

  for (const tx of allTx) {
    if (fromDate && tx.date < fromDate) continue
    if (toDate && tx.date > toDate) continue

    running = round2(running + tx.debit - tx.credit)
    periodDebits = round2(periodDebits + tx.debit)
    periodCredits = round2(periodCredits + tx.credit)

    lines.push({
      date: tx.date,
      type: tx.type,
      ref: tx.ref,
      bookingId: tx.bookingId,
      description: tx.description,
      debit: tx.debit,
      credit: tx.credit,
      runningBalance: running,
    })
  }

  const closingBalance = round2(openingBalance + periodDebits - periodCredits)

  // Overall customer stats across all bookings
  let totalBookedRevenue = 0
  let totalCollected = 0
  let totalOutstanding = 0
  let totalCancellationFees = 0
  let activeBookingsCount = 0
  let cancelledBookingsCount = 0

  for (const b of bookings || []) {
    const fin = calculateBookingFinancials(b)
    if (fin.isCancelled) {
      cancelledBookingsCount++
      totalCancellationFees = round2(totalCancellationFees + fin.cancellationFeesRetained)
      totalCollected = round2(totalCollected + fin.collected)
    } else {
      activeBookingsCount++
      totalBookedRevenue = round2(totalBookedRevenue + fin.bookedRevenue)
      totalCollected = round2(totalCollected + fin.collected)
      totalOutstanding = round2(totalOutstanding + fin.outstanding)
    }
  }

  return Object.freeze({
    customer: Object.freeze({
      id: customer._id ? customer._id.toString() : (customer.id || ""),
      name: customer.name || "Valued Customer",
      phone: customer.phone || "",
      email: customer.email || "",
      city: customer.city || "",
      address: customer.address || "",
      gstin: customer.gstin || "",
    }),
    period: Object.freeze({
      from: fromDate,
      to: toDate,
      asOf: toDateString(new Date()),
    }),
    openingBalance,
    closingBalance,
    totalDebits: periodDebits,
    totalCredits: periodCredits,
    netChange: round2(periodDebits - periodCredits),
    lines: Object.freeze(lines),
    summary: Object.freeze({
      totalBookingsCount: (bookings || []).length,
      activeBookingsCount,
      cancelledBookingsCount,
      totalBookedRevenue,
      totalCollected,
      totalOutstanding,
      totalCancellationFees,
    }),
  })
}
