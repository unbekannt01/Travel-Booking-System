/**
 * YatraHub - Shared Payment Summary Engine
 *
 * Generates accurate per-passenger financial breakdown (fare, paid, balance)
 * and payment history for single bookings and multi-passenger group bookings.
 *
 * Requirements & Features:
 * - Consistent 1px solid #000 borders on every cell (th, td, tfoot td).
 * - Exact table-layout: fixed with explicit <colgroup> column widths.
 * - Totals row uses colspan spanning leading columns with white-space: nowrap so "TOTALS" is never clipped.
 * - Signatures block and disclaimer notes completely removed; clean small footer only.
 * - Suppressed browser headers/footers via @page { size: A4 portrait; margin: 0; } and 12mm padding on wrapper.
 * - Multi-page support: repeating thead with slim running header, no row splitting, tfoot kept together.
 * - Integer paise arithmetic to eliminate floating-point rounding errors.
 * - Color-independent bold indicators for non-zero balance in B&W print.
 * - Automatically treats any booking with >1 passenger as a group summary.
 */

import { escapeHtml } from "./escapeHtml.js"
import { toPaise, fromPaise } from "./groupPayments.js"
import {
  formatSeatDisplayName,
  resolveSeatId,
  layoutKeyForBusType,
  formatShortPassengerName,
  isUpperBerthSeat,
} from "./seatLayouts.js"
import { isGroupBooking, getGroupInfo } from "./groupHelpers.js"
import { getPassengerScriptDisplayName } from "./gujaratiTransliteration.js"

export const PAYMENT_SUMMARY_I18N = Object.freeze({
  en: {
    title: "PAYMENT SUMMARY",
    groupTitle: "GROUP PAYMENT SUMMARY",
    subtitle: "Passenger-wise Fare & Collection Breakdown",
    route: "Route / Tour",
    date: "Travel Date",
    busNo: "Bus Number",
    busType: "Bus Type",
    bookingRef: "Booking Ref",
    groupRef: "Group Ref",
    customer: "Contact Person",
    totalSeats: "Total Seats",
    srNo: "Sr",
    passengerName: "Passenger Name",
    seatNo: "Seat",
    fare: "Fare (₹)",
    paid: "Paid (₹)",
    balance: "Balance (₹)",
    status: "Status",
    statusPaid: "PAID",
    statusDue: "DUE",
    statusPartial: "PARTIAL",
    totals: "TOTALS",
    paymentHistory: "Payment History",
    paymentDate: "Date",
    amount: "Amount (₹)",
    mode: "Payment Mode",
    reference: "Txn / Ref No",
    receivedBy: "Received By / Payer",
    notes: "Notes",
    noPayments: "No payment transactions recorded yet.",
    generatedOn: "Generated on",
  },
  hi: {
    title: "भुगतान सारांश",
    groupTitle: "समूह भुगतान सारांश",
    subtitle: "यात्री-वार किराया एवं भुगतान विवरण",
    route: "मार्ग / यात्रा",
    date: "यात्रा दिनांक",
    busNo: "बस नंबर",
    busType: "बस प्रकार",
    bookingRef: "बुकिंग संदर्भ",
    groupRef: "समूह संदर्भ",
    customer: "संपर्क व्यक्ति",
    totalSeats: "कुल सीटें",
    srNo: "क्र.",
    passengerName: "यात्री का नाम",
    seatNo: "सीट",
    fare: "किराया (₹)",
    paid: "जमा (₹)",
    balance: "बकाया (₹)",
    status: "स्थिति",
    statusPaid: "पूर्ण भुगतान",
    statusDue: "बकाया",
    statusPartial: "आंशिक",
    totals: "कुल योग",
    paymentHistory: "भुगतान इतिहास",
    paymentDate: "दिनांक",
    amount: "राशि (₹)",
    mode: "भुगतान माध्यम",
    reference: "संदर्भ नं.",
    receivedBy: "प्राप्तकर्ता / भुगतानकर्ता",
    notes: "विवरण",
    noPayments: "अभी तक कोई भुगतान दर्ज नहीं है।",
    generatedOn: "जारी दिनांक",
  },
  gu: {
    title: "ચુકવણી સારાંશ",
    groupTitle: "ગ્રુપ ચુકવણી સારાંશ",
    subtitle: "મુસાફર મુજબ ભાડું અને જમા રકમ વિગત",
    route: "રૂટ / પ્રવાસ",
    date: "પ્રવાસ તારીખ",
    busNo: "બસ નંબર",
    busType: "બસ પ્રકાર",
    bookingRef: "બુકિંગ સંદર્ભ",
    groupRef: "ગ્રુપ સંદર્ભ",
    customer: "સંપર્ક વ્યક્તિ",
    totalSeats: "કુલ સીટો",
    srNo: "ક્રમ",
    passengerName: "મુસાફરનું નામ",
    seatNo: "સીટ",
    fare: "ભાડું (₹)",
    paid: "ચૂકવેલ (₹)",
    balance: "બાકી (₹)",
    status: "સ્થિતિ",
    statusPaid: "સંપૂર્ણ ચૂકવેલ",
    statusDue: "બાકી",
    statusPartial: "અંશતઃ",
    totals: "કુલ સરવાળો",
    paymentHistory: "ચુકવણી ઇતિહાસ",
    paymentDate: "તારીખ",
    amount: "રકમ (₹)",
    mode: "ચુકવણી પદ્ધતિ",
    reference: "સંદર્ભ નં.",
    receivedBy: "સ્વીકારનાર / આપનાર",
    notes: "નોંધ",
    noPayments: "હજુ સુધી કોઈ ચુકવણી નોંધાયેલ નથી.",
    generatedOn: "તૈયાર કર્યા તારીખ",
  },
})

/**
 * Format currency with Indian grouping
 * @param {number} num
 * @returns {string}
 */
export function formatRupees(num) {
  const val = Number(num || 0)
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val)
}

/**
 * Calculate per-passenger financial breakdown using integer paise.
 * Handles single bookings (with 1 or more passengers) and explicit group bookings.
 *
 * @param {Object} params
 * @param {Object} [params.booking]
 * @param {Object} [params.group]
 * @param {Array} [params.payments]
 * @param {Array} [params.groupPayments]
 * @param {Array} [params.memberBookings]
 * @returns {{
 *   passengers: Array<{
 *     srNo: number,
 *     name: string,
 *     seat: string,
 *     farePaise: number,
 *     paidPaise: number,
 *     balancePaise: number,
 *     status: string,
 *     bookingRef: string
 *   }>,
 *   totalFarePaise: number,
 *   totalPaidPaise: number,
 *   totalBalancePaise: number
 * }}
 */
export function calculatePassengerBreakdown({
  booking = null,
  group = null,
  payments = [],
  groupPayments = [],
  memberBookings = [],
  lowerPrice = 0,
  upperPrice = 0,
  discount = 0,
}) {
  const paxList = []
  const lPrice = Number(lowerPrice || group?.lowerPrice || booking?.lowerPrice || memberBookings[0]?.lowerPrice || 0)
  const uPrice = Number(upperPrice || group?.upperPrice || booking?.upperPrice || memberBookings[0]?.upperPrice || 0)
  const groupDiscount = Math.max(0, Number(discount || group?.discount || booking?.discount || 0))

  // Case A: Explicit Group Booking breakdown
  if (group || memberBookings.length > 0) {
    const members = memberBookings.length > 0 ? memberBookings : group?.members || []
    let sr = 1

    for (const m of members) {
      const bRef = m.invoiceNo || m.bookingRef || ""
      const mPaxList = m.passengers || (m.name ? [{ name: m.name, seatId: m.seatId || m.seat }] : [])
      const paxCount = Math.max(1, mPaxList.length)
      const memberTotalFarePaise = toPaise(m.totalAmount ?? m.fare ?? 0)

      let memberPaidPaise = toPaise(m.advanceReceived ?? 0)
      if (memberPaidPaise === 0 && Array.isArray(m.payments) && m.payments.length > 0) {
        memberPaidPaise = m.payments.reduce((acc, p) => acc + toPaise(p.amount || 0), 0)
      }

      if (memberPaidPaise === 0 && Array.isArray(groupPayments) && groupPayments.length > 0) {
        for (const gp of groupPayments) {
          const alloc = (gp.allocations || []).find(
            (a) => String(a.bookingId) === String(m._id || m.id || m.bookingId),
          )
          if (alloc) {
            memberPaidPaise += toPaise(alloc.allocatedRupees ?? fromPaise(alloc.allocatedPaise ?? 0))
          }
        }
      }

      const cappedPaidPaise = Math.min(memberTotalFarePaise, Math.max(0, memberPaidPaise))

      // 1. Calculate passenger fares based on Upper vs Lower pricing
      const expectedFarePaiseList = mPaxList.map((p) => {
        if (p.fare !== undefined && p.fare !== null && Number(p.fare) > 0) {
          return toPaise(p.fare)
        }
        const isUp = isUpperBerthSeat(p.seatId || p.seat)
        if (isUp && uPrice > 0) return toPaise(uPrice)
        if (!isUp && lPrice > 0) return toPaise(lPrice)
        return 0
      })
      const sumExpectedPaise = expectedFarePaiseList.reduce((a, c) => a + c, 0)
      let pFarePaiseList = []

      if (sumExpectedPaise > 0 && sumExpectedPaise === memberTotalFarePaise) {
        pFarePaiseList = expectedFarePaiseList
      } else if (sumExpectedPaise > 0 && memberTotalFarePaise > 0) {
        let assignedPaise = 0
        pFarePaiseList = expectedFarePaiseList.map((fPaise) => {
          const scaled = Math.floor((memberTotalFarePaise * fPaise) / sumExpectedPaise)
          assignedPaise += scaled
          return scaled
        })
        let remPaise = memberTotalFarePaise - assignedPaise
        let idx = 0
        while (remPaise > 0 && idx < pFarePaiseList.length * 2) {
          const add = remPaise >= 100 ? 100 : remPaise
          pFarePaiseList[idx % pFarePaiseList.length] += add
          remPaise -= add
          idx++
        }
      } else {
        const isWholeRupees = memberTotalFarePaise % 100 === 0
        const step = isWholeRupees ? 100 : 1
        const basePaise = Math.floor(memberTotalFarePaise / paxCount / step) * step
        let fareRem = memberTotalFarePaise - basePaise * paxCount
        pFarePaiseList = mPaxList.map(() => {
          const f = basePaise + (fareRem > 0 ? step : 0)
          if (fareRem > 0) fareRem -= step
          return f
        })
      }

      // 2. Allocate payments (cappedPaidPaise) proportionally or by explicit passenger payments
      let pPaidPaiseList = []
      const hasExplicitPassengerPaid = mPaxList.some((p) => p.paid !== undefined && p.paid !== null)

      if (hasExplicitPassengerPaid) {
        pPaidPaiseList = mPaxList.map((p, idx) => {
          if (p.paid !== undefined && p.paid !== null) {
            return Math.min(pFarePaiseList[idx], toPaise(p.paid))
          }
          return 0
        })
        const allocatedExplicit = pPaidPaiseList.reduce((a, c) => a + c, 0)
        let unallocatedPaid = Math.max(0, cappedPaidPaise - allocatedExplicit)
        if (unallocatedPaid > 0) {
          for (let i = 0; i < pPaidPaiseList.length && unallocatedPaid > 0; i++) {
            const room = pFarePaiseList[i] - pPaidPaiseList[i]
            if (room > 0) {
              const add = Math.min(room, unallocatedPaid)
              pPaidPaiseList[i] += add
              unallocatedPaid -= add
            }
          }
        }
      } else if (cappedPaidPaise >= memberTotalFarePaise && memberTotalFarePaise > 0) {
        pPaidPaiseList = pFarePaiseList.slice()
      } else if (cappedPaidPaise > 0 && memberTotalFarePaise > 0) {
        const isWhole = memberTotalFarePaise % 100 === 0 && cappedPaidPaise % 100 === 0
        if (isWhole) {
          const totRupees = Math.round(memberTotalFarePaise / 100)
          const paidRupees = Math.round(cappedPaidPaise / 100)
          const fRupeesList = pFarePaiseList.map((fp) => Math.round(fp / 100))
          let assignedRupees = 0
          const pPaidRupees = fRupeesList.map((f) => {
            const pd = Math.min(f, Math.floor((paidRupees * f) / totRupees))
            assignedRupees += pd
            return pd
          })
          let remRupees = paidRupees - assignedRupees
          let idx = 0
          while (remRupees > 0 && idx < pPaidRupees.length * 2) {
            const currIdx = idx % pPaidRupees.length
            if (pPaidRupees[currIdx] < fRupeesList[currIdx]) {
              pPaidRupees[currIdx] += 1
              remRupees -= 1
            }
            idx++
          }
          pPaidPaiseList = pPaidRupees.map((r) => r * 100)
        } else {
          let assignedPaidPaise = 0
          pPaidPaiseList = pFarePaiseList.map((fPaise) => {
            const pd = Math.min(fPaise, Math.floor((cappedPaidPaise * fPaise) / memberTotalFarePaise))
            assignedPaidPaise += pd
            return pd
          })
          let remPaidPaise = cappedPaidPaise - assignedPaidPaise
          let idx = 0
          while (remPaidPaise > 0 && idx < pPaidPaiseList.length * 2) {
            const currIdx = idx % pPaidPaiseList.length
            if (pPaidPaiseList[currIdx] < pFarePaiseList[currIdx]) {
              pPaidPaiseList[currIdx] += 1
              remPaidPaise -= 1
            }
            idx++
          }
        }
      } else {
        pPaidPaiseList = mPaxList.map(() => 0)
      }

      for (let i = 0; i < mPaxList.length; i++) {
        const p = mPaxList[i]
        const pFarePaise = pFarePaiseList[i]
        const pPaidPaise = pPaidPaiseList[i]
        const pBalPaise = Math.max(0, pFarePaise - pPaidPaise)
        const status = pBalPaise === 0 ? "PAID" : pPaidPaise > 0 ? "PARTIAL" : "DUE"

        paxList.push({
          srNo: sr++,
          name: p.name || m.contactName || m.name || "Traveler",
          seat: p.seatId || p.seat || "",
          farePaise: pFarePaise,
          paidPaise: pPaidPaise,
          balancePaise: pBalPaise,
          status,
          bookingRef: bRef,
        })
      }
    }
  } else if (booking) {
    // Case B: Single Booking (1 pax or multi-pax treated as group)
    const bPaxList = booking.passengers || [
      { name: booking.contactName || "Traveler", seatId: booking.seatId || "" },
    ]
    const paxCount = Math.max(1, bPaxList.length)
    const bookingTotalFarePaise = toPaise(booking.totalAmount || 0)

    let bookingPaidPaise = toPaise(booking.advanceReceived || 0)
    if (bookingPaidPaise === 0 && Array.isArray(payments) && payments.length > 0) {
      bookingPaidPaise = payments
        .filter((p) => !p.isVoid && p.type !== "refund")
        .reduce((sum, p) => sum + toPaise(p.amount || 0), 0)
    }

    const cappedPaidPaise = Math.min(bookingTotalFarePaise, Math.max(0, bookingPaidPaise))

    // 1. Calculate passenger fares based on Lower vs Upper pricing
    const expectedFarePaiseList = bPaxList.map((p) => {
      if (p.fare !== undefined && p.fare !== null && Number(p.fare) > 0) {
        return toPaise(p.fare)
      }
      const isUp = isUpperBerthSeat(p.seatId || p.seat)
      if (isUp && uPrice > 0) return toPaise(uPrice)
      if (!isUp && lPrice > 0) return toPaise(lPrice)
      return 0
    })
    const sumExpectedPaise = expectedFarePaiseList.reduce((a, c) => a + c, 0)
    let pFarePaiseList = []

    if (sumExpectedPaise > 0 && sumExpectedPaise === bookingTotalFarePaise) {
      pFarePaiseList = expectedFarePaiseList
    } else if (sumExpectedPaise > 0 && bookingTotalFarePaise > 0) {
      let assignedPaise = 0
      pFarePaiseList = expectedFarePaiseList.map((fPaise) => {
        const scaled = Math.floor((bookingTotalFarePaise * fPaise) / sumExpectedPaise)
        assignedPaise += scaled
        return scaled
      })
      let remPaise = bookingTotalFarePaise - assignedPaise
      let idx = 0
      while (remPaise > 0 && idx < pFarePaiseList.length * 2) {
        const add = remPaise >= 100 ? 100 : remPaise
        pFarePaiseList[idx % pFarePaiseList.length] += add
        remPaise -= add
        idx++
      }
    } else {
      const isWholeRupees = bookingTotalFarePaise % 100 === 0
      const step = isWholeRupees ? 100 : 1
      const basePaise = Math.floor(bookingTotalFarePaise / paxCount / step) * step
      let fareRem = bookingTotalFarePaise - basePaise * paxCount
      pFarePaiseList = bPaxList.map(() => {
        const f = basePaise + (fareRem > 0 ? step : 0)
        if (fareRem > 0) fareRem -= step
        return f
      })
    }

    // 2. Allocate payments (cappedPaidPaise) proportionally or by explicit passenger payments
    let pPaidPaiseList = []
    const hasExplicitPassengerPaid = bPaxList.some((p) => p.paid !== undefined && p.paid !== null)

    if (hasExplicitPassengerPaid) {
      pPaidPaiseList = bPaxList.map((p, idx) => {
        if (p.paid !== undefined && p.paid !== null) {
          return Math.min(pFarePaiseList[idx], toPaise(p.paid))
        }
        return 0
      })
      const allocatedExplicit = pPaidPaiseList.reduce((a, c) => a + c, 0)
      let unallocatedPaid = Math.max(0, cappedPaidPaise - allocatedExplicit)
      if (unallocatedPaid > 0) {
        for (let i = 0; i < pPaidPaiseList.length && unallocatedPaid > 0; i++) {
          const room = pFarePaiseList[i] - pPaidPaiseList[i]
          if (room > 0) {
            const add = Math.min(room, unallocatedPaid)
            pPaidPaiseList[i] += add
            unallocatedPaid -= add
          }
        }
      }
    } else if (cappedPaidPaise >= bookingTotalFarePaise && bookingTotalFarePaise > 0) {
      pPaidPaiseList = pFarePaiseList.slice()
    } else if (cappedPaidPaise > 0 && bookingTotalFarePaise > 0) {
      const isWhole = bookingTotalFarePaise % 100 === 0 && cappedPaidPaise % 100 === 0
      if (isWhole) {
        const totRupees = Math.round(bookingTotalFarePaise / 100)
        const paidRupees = Math.round(cappedPaidPaise / 100)
        const fRupeesList = pFarePaiseList.map((fp) => Math.round(fp / 100))
        let assignedRupees = 0
        const pPaidRupees = fRupeesList.map((f) => {
          const pd = Math.min(f, Math.floor((paidRupees * f) / totRupees))
          assignedRupees += pd
          return pd
        })
        let remRupees = paidRupees - assignedRupees
        let idx = 0
        while (remRupees > 0 && idx < pPaidRupees.length * 2) {
          const currIdx = idx % pPaidRupees.length
          if (pPaidRupees[currIdx] < fRupeesList[currIdx]) {
            pPaidRupees[currIdx] += 1
            remRupees -= 1
          }
          idx++
        }
        pPaidPaiseList = pPaidRupees.map((r) => r * 100)
      } else {
        let assignedPaidPaise = 0
        pPaidPaiseList = pFarePaiseList.map((fPaise) => {
          const pd = Math.min(fPaise, Math.floor((cappedPaidPaise * fPaise) / bookingTotalFarePaise))
          assignedPaidPaise += pd
          return pd
        })
        let remPaidPaise = cappedPaidPaise - assignedPaidPaise
        let idx = 0
        while (remPaidPaise > 0 && idx < pPaidPaiseList.length * 2) {
          const currIdx = idx % pPaidPaiseList.length
          if (pPaidPaiseList[currIdx] < pFarePaiseList[currIdx]) {
            pPaidPaiseList[currIdx] += 1
            remPaidPaise -= 1
          }
          idx++
        }
      }
    } else {
      pPaidPaiseList = bPaxList.map(() => 0)
    }

    for (let i = 0; i < bPaxList.length; i++) {
      const p = bPaxList[i]
      const pFarePaise = pFarePaiseList[i]
      const pPaidPaise = pPaidPaiseList[i]
      const pBalPaise = Math.max(0, pFarePaise - pPaidPaise)
      const status = pBalPaise === 0 ? "PAID" : pPaidPaise > 0 ? "PARTIAL" : "DUE"

      paxList.push({
        srNo: i + 1,
        name: p.name || booking.contactName || "Traveler",
        seat: p.seatId || p.seat || "",
        farePaise: pFarePaise,
        paidPaise: pPaidPaise,
        balancePaise: pBalPaise,
        status,
        bookingRef: booking.invoiceNo || "",
      })
    }
  }

  const lowerPax = paxList.filter((p) => !isUpperBerthSeat(p.seat))
  const upperPax = paxList.filter((p) => isUpperBerthSeat(p.seat))
  const hasDecks = lowerPax.length > 0 && upperPax.length > 0

  const lowerFarePaise = lowerPax.reduce((sum, p) => sum + p.farePaise, 0)
  const lowerPaidPaise = lowerPax.reduce((sum, p) => sum + p.paidPaise, 0)
  let lowerBalPaise = lowerPax.reduce((sum, p) => sum + p.balancePaise, 0)

  const upperFarePaise = upperPax.reduce((sum, p) => sum + p.farePaise, 0)
  const upperPaidPaise = upperPax.reduce((sum, p) => sum + p.paidPaise, 0)
  let upperBalPaise = upperPax.reduce((sum, p) => sum + p.balancePaise, 0)

  const totalFarePaise = paxList.reduce((sum, p) => sum + p.farePaise, 0)
  const totalPaidPaise = paxList.reduce((sum, p) => sum + p.paidPaise, 0)
  const discountPaise = toPaise(groupDiscount)
  const netFarePaise = Math.max(0, totalFarePaise - discountPaise)
  const totalBalancePaise = Math.max(0, netFarePaise - totalPaidPaise)

  // Attribute discount proportionally to deck dues
  if (discountPaise > 0 && totalFarePaise > 0) {
    const lowerDisc = Math.floor((discountPaise * lowerFarePaise) / totalFarePaise)
    const upperDisc = discountPaise - lowerDisc
    lowerBalPaise = Math.max(0, lowerBalPaise - lowerDisc)
    upperBalPaise = Math.max(0, upperBalPaise - upperDisc)
  }

  return {
    passengers: paxList,
    totalFarePaise,
    discountPaise,
    netFarePaise,
    totalPaidPaise,
    totalBalancePaise,
    deckBreakdown: {
      hasDecks,
      lower: {
        count: lowerPax.length,
        farePaise: lowerFarePaise,
        paidPaise: lowerPaidPaise,
        balancePaise: lowerBalPaise,
      },
      upper: {
        count: upperPax.length,
        farePaise: upperFarePaise,
        paidPaise: upperPaidPaise,
        balancePaise: upperBalPaise,
      },
      overall: {
        count: paxList.length,
        farePaise: totalFarePaise,
        discountPaise,
        netFarePaise,
        paidPaise: totalPaidPaise,
        balancePaise: totalBalancePaise,
      },
    },
  }
}

/**
 * Format a date nicely
 * @param {string|Date} dateVal
 * @returns {string}
 */
function formatDate(dateVal) {
  if (!dateVal) return "—"
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return String(dateVal)
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return String(dateVal)
  }
}

/**
 * Renders complete, standalone, sandboxed printable HTML for Output 1 (Payment Summary).
 *
 * @param {Object} options
 * @param {Object} [options.booking]
 * @param {Object} [options.group]
 * @param {Array} [options.memberBookings]
 * @param {Array} [options.payments]
 * @param {Array} [options.groupPayments]
 * @param {Object} [options.companyInfo]
 * @param {string} [options.language='en']
 * @returns {string} Clean HTML string with Content-Security-Policy
 */
export function renderPaymentSummaryHtml({
  booking = null,
  group = null,
  memberBookings = [],
  payments = [],
  groupPayments = [],
  companyInfo = {},
  language = "en",
  nameScript = "en",
  showDeckBreakdown = true,
  showTotalsSummary = true,
  discount = 0,
}) {
  const lang = ["en", "hi", "gu"].includes(language) ? language : "en"
  const t = PAYMENT_SUMMARY_I18N[lang] || PAYMENT_SUMMARY_I18N.en

  const companyName = companyInfo.companyName || "YATRA HUB"
  const companyPhone = companyInfo.companyPhone || companyInfo.phone || ""
  const companyAddress = companyInfo.companyAddress || companyInfo.address || ""

  // Treat as group summary if explicit group OR booking with 2+ passengers
  const isMultiPax = Boolean(booking?.passengers && booking.passengers.length > 1)
  const isGroup = Boolean(group || memberBookings.length > 0 || isMultiPax || isGroupBooking(booking))

  const groupInfo = booking ? getGroupInfo(booking) : null
  const effectiveDiscount = Number(discount || group?.discount || booking?.discount || 0)

  const breakdown = calculatePassengerBreakdown({
    booking,
    group,
    memberBookings,
    payments,
    groupPayments,
    lowerPrice: group?.lowerPrice || booking?.lowerPrice || memberBookings[0]?.lowerPrice || 0,
    upperPrice: group?.upperPrice || booking?.upperPrice || memberBookings[0]?.upperPrice || 0,
    discount: effectiveDiscount,
  })

  // Header metadata
  const tourName =
    booking?.tourName ||
    group?.tourName ||
    (memberBookings[0] && memberBookings[0].tourName) ||
    "Tour Journey"
  const journeyDate = formatDate(
    booking?.journeyDate || group?.journeyDate || (memberBookings[0] && memberBookings[0].journeyDate),
  )
  const busNumber =
    booking?.busNumber ||
    group?.busNumber ||
    companyInfo.busNumber ||
    booking?.busPlateNo ||
    ""
  const busType =
    booking?.busType ||
    group?.busType ||
    (memberBookings[0] && memberBookings[0].busType) ||
    ""
  const layoutKey =
    booking?.seatLayoutKey ||
    group?.seatLayoutKey ||
    (memberBookings[0] && memberBookings[0].seatLayoutKey) ||
    layoutKeyForBusType(busType)

  const docRef = isGroup
    ? group?.groupCode || group?.name || booking?.groupName || groupInfo?.groupName || "GROUP"
    : booking?.invoiceNo || "INV"

  const contactName = isGroup
    ? group?.name || group?.contactName || booking?.groupName || groupInfo?.groupName || (memberBookings[0] && memberBookings[0].contactName) || booking?.contactName || "Group"
    : booking?.contactName || "Customer"

  const contactPhone = isGroup
    ? group?.contactPhone || booking?.contactPhone || (memberBookings[0] && memberBookings[0].contactPhone) || ""
    : booking?.contactPhone || ""

  const totalPaxCount = breakdown.passengers.length

  // Build combined payment history transactions
  const historyList = []
  const recordedKeys = new Set()

  // 1. Group-level payments (e.g. recorded via GroupPayment)
  if (Array.isArray(groupPayments) && groupPayments.length > 0) {
    for (const gp of groupPayments) {
      if (gp.status === "cancelled" || gp.isVoid) continue
      const ref = gp.groupPaymentId || gp.reference || gp.transactionId || gp.receiptNo || ""
      const key = `gp-${gp._id || ref || Math.random()}`
      if (recordedKeys.has(key)) continue
      recordedKeys.add(key)
      historyList.push({
        date: formatDate(gp.paymentDate || gp.date || gp.createdAt),
        amount: fromPaise(gp.amountPaise ?? toPaise(gp.amountRupees ?? gp.amount ?? 0)),
        mode: (gp.paymentMode || gp.mode || "Cash").toUpperCase(),
        reference: gp.reference || gp.transactionId || gp.receiptNo || gp.groupPaymentId || "—",
        payer: gp.paidBy || gp.recordedBy || contactName,
        notes: gp.notes || "",
      })
    }
  }

  // 2. Direct ledger payments passed via payments prop
  if (Array.isArray(payments) && payments.length > 0) {
    for (const p of payments) {
      if (p.isVoid || p.type === "refund") continue
      // Avoid duplicate if already covered by a groupPayment
      if (p.groupPaymentId && groupPayments?.some((gp) => gp.groupPaymentId === p.groupPaymentId)) {
        continue
      }
      const ref = p.receiptNo || p.reference || p.transactionId || ""
      const key = `pay-${p._id || ref || Math.random()}`
      if (recordedKeys.has(key)) continue
      recordedKeys.add(key)
      historyList.push({
        date: formatDate(p.paymentDate || p.date || p.createdAt),
        amount: Number(p.amount || 0),
        mode: (p.paymentMode || p.mode || "Cash").toUpperCase(),
        reference: p.receiptNo || p.reference || p.transactionId || "—",
        payer: p.receivedFrom || p.payerName || contactName,
        notes: p.notes || "",
      })
    }
  }

  // 3. Member bookings payments / advance (when viewing group summary)
  if (isGroup && Array.isArray(memberBookings) && memberBookings.length > 0) {
    for (const m of memberBookings) {
      if (Array.isArray(m.payments) && m.payments.length > 0) {
        for (const p of m.payments) {
          if (p.isVoid || p.type === "refund") continue
          if (p.groupPaymentId && groupPayments?.some((gp) => gp.groupPaymentId === p.groupPaymentId)) {
            continue
          }
          const ref = p.receiptNo || p.reference || p.transactionId || ""
          const key = `pay-${p._id || ref || Math.random()}`
          if (recordedKeys.has(key)) continue
          recordedKeys.add(key)
          historyList.push({
            date: formatDate(p.paymentDate || p.date || p.createdAt),
            amount: Number(p.amount || 0),
            mode: (p.paymentMode || p.mode || "Cash").toUpperCase(),
            reference: p.receiptNo || p.reference || m.invoiceNo || "—",
            payer: p.receivedFrom || p.payerName || m.contactName || contactName,
            notes: p.notes || (m.invoiceNo ? `Booking #${m.invoiceNo}` : ""),
          })
        }
      } else if (m.advanceReceived && Number(m.advanceReceived) > 0) {
        // If booking has advanceReceived and no granular payment was added yet for it
        const key = `adv-${m._id || m.invoiceNo || Math.random()}`
        if (!recordedKeys.has(key) && historyList.length === 0) {
          recordedKeys.add(key)
          historyList.push({
            date: formatDate(m.createdAt || m.date),
            amount: Number(m.advanceReceived),
            mode: (m.paymentMode || "Cash").toUpperCase(),
            reference: m.invoiceNo || "Advance Booking",
            payer: m.contactName || contactName,
            notes: `Advance payment for ${m.invoiceNo || "booking"}`,
          })
        }
      }
    }
  }

  // 4. Single booking fallback
  if (historyList.length === 0 && booking) {
    if (Array.isArray(booking.payments) && booking.payments.length > 0) {
      for (const p of booking.payments) {
        if (p.isVoid || p.type === "refund") continue
        const ref = p.receiptNo || p.reference || p.transactionId || ""
        const key = `pay-${p._id || ref || Math.random()}`
        if (recordedKeys.has(key)) continue
        recordedKeys.add(key)
        historyList.push({
          date: formatDate(p.paymentDate || p.date || p.createdAt),
          amount: Number(p.amount || 0),
          mode: (p.paymentMode || p.mode || "Cash").toUpperCase(),
          reference: p.receiptNo || p.reference || "—",
          payer: p.receivedFrom || p.payerName || contactName,
          notes: p.notes || "",
        })
      }
    } else if (booking.advanceReceived && Number(booking.advanceReceived) > 0) {
      historyList.push({
        date: formatDate(booking.date || booking.createdAt),
        amount: Number(booking.advanceReceived),
        mode: (booking.paymentMode || "Cash").toUpperCase(),
        reference: booking.invoiceNo || "Advance Booking",
        payer: contactName,
        notes: isGroup ? "Advance payment allocated across group members" : "Advance received at booking",
      })
    }
  }

  const hasMultipleBookings = isGroup && memberBookings.length > 1

  // Passenger Rows HTML
  const passengerRowsHtml = breakdown.passengers
    .map((p) => {
      const fareRupees = fromPaise(p.farePaise)
      const isUp = isUpperBerthSeat(p.seat)
      const seatDisplay = p.seat ? escapeHtml(formatSeatDisplayName(layoutKey, p.seat)) : "—"
      const deckTag = isUp
        ? `<span class="seat-deck-tag tag-upper">UPPER</span>`
        : `<span class="seat-deck-tag tag-lower">LOWER</span>`
      const displayName = getPassengerScriptDisplayName(p, nameScript) || p.name || "Traveler"

      if (isGroup) {
        return `<tr>
        <td class="text-center font-bold">${p.srNo}</td>
        <td class="cell-wrap"><strong>${escapeHtml(displayName)}</strong>${hasMultipleBookings && p.bookingRef ? ` <span class="ref-sub">(${escapeHtml(p.bookingRef)})</span>` : ""}</td>
        <td class="seat-cell">${seatDisplay}</td>
        <td class="text-center">${deckTag}</td>
        <td class="text-right font-bold">₹${formatRupees(fareRupees)}</td>
      </tr>`
      }

      const paidRupees = fromPaise(p.paidPaise)
      const balanceRupees = fromPaise(p.balancePaise)
      const isDue = p.balancePaise > 0

      const balanceCellHtml = isDue
        ? `<strong class="text-due">₹${formatRupees(balanceRupees)}</strong>`
        : `<span class="paid-marker">₹0</span>`

      const statusLabel =
        p.status === "PAID" ? t.statusPaid : p.status === "PARTIAL" ? t.statusPartial : t.statusDue
      const statusBadge = isDue
        ? `<span class="badge-due">${escapeHtml(statusLabel)}</span>`
        : `<span class="badge-paid">${escapeHtml(statusLabel)}</span>`

      return `<tr>
        <td class="text-center font-bold">${p.srNo}</td>
        <td class="cell-wrap"><strong>${escapeHtml(displayName)}</strong></td>
        <td class="seat-cell">${seatDisplay} ${deckTag}</td>
        <td class="text-right font-medium">₹${formatRupees(fareRupees)}</td>
        <td class="text-right font-bold text-paid">₹${formatRupees(paidRupees)}</td>
        <td class="text-right">${balanceCellHtml}</td>
        <td class="text-center">${statusBadge}</td>
      </tr>`
    })
    .join("\n")

  const totalFare = fromPaise(breakdown.totalFarePaise)
  const totalPaid = fromPaise(breakdown.totalPaidPaise)
  const totalBalance = fromPaise(breakdown.totalBalancePaise)
  const hasTotalDue = breakdown.totalBalancePaise > 0

  // Passenger Table tfoot with Upper vs Lower subtotal rows and full group settlement
  let passengerTfootHtml = ""
  if (isGroup) {
    if (showDeckBreakdown && breakdown.deckBreakdown?.hasDecks) {
      const l = breakdown.deckBreakdown.lower
      const u = breakdown.deckBreakdown.upper
      passengerTfootHtml += `<tr class="deck-subtotal-row">
      <td colspan="4" class="text-right font-bold totals-label">🛏️ Lower Berths (${l.count} pax) — Fare ₹${formatRupees(fromPaise(l.farePaise))} | Paid ₹${formatRupees(fromPaise(l.paidPaise))} | Balance Due:</td>
      <td class="text-right font-bold ${l.balancePaise > 0 ? "text-due" : "text-paid"}">₹${formatRupees(fromPaise(l.balancePaise))}</td>
    </tr>`
      passengerTfootHtml += `<tr class="deck-subtotal-row">
      <td colspan="4" class="text-right font-bold totals-label">🛏️ Upper Berths (${u.count} pax) — Fare ₹${formatRupees(fromPaise(u.farePaise))} | Paid ₹${formatRupees(fromPaise(u.paidPaise))} | Balance Due:</td>
      <td class="text-right font-bold ${u.balancePaise > 0 ? "text-due" : "text-paid"}">₹${formatRupees(fromPaise(u.balancePaise))}</td>
    </tr>`
    }
    if (showTotalsSummary) {
      passengerTfootHtml += `<tr>
      <td colspan="4" class="text-right font-bold totals-label">Total Group Berth Fare (${totalPaxCount} pax):</td>
      <td class="text-right font-bold">₹${formatRupees(totalFare)}</td>
    </tr>`
      if (breakdown.discountPaise > 0) {
        passengerTfootHtml += `<tr>
        <td colspan="4" class="text-right font-bold totals-label" style="color: #16a34a;">Group Discount:</td>
        <td class="text-right font-bold" style="color: #16a34a;">-₹${formatRupees(fromPaise(breakdown.discountPaise))}</td>
      </tr>`
        passengerTfootHtml += `<tr>
        <td colspan="4" class="text-right font-bold totals-label">Net Payable Amount:</td>
        <td class="text-right font-bold">₹${formatRupees(fromPaise(breakdown.netFarePaise))}</td>
      </tr>`
      }
      passengerTfootHtml += `<tr>
      <td colspan="4" class="text-right font-bold totals-label text-paid">Total Group Advance Paid:</td>
      <td class="text-right font-bold text-paid">₹${formatRupees(totalPaid)}</td>
    </tr>`
      passengerTfootHtml += `<tr class="grand-totals-row">
      <td colspan="4" class="text-right font-black totals-label" style="white-space: nowrap; font-size: 11px;">👥 REMAINING GROUP BALANCE DUE:</td>
      <td class="text-right font-black ${hasTotalDue ? "text-due" : "text-paid"}" style="font-size: 13px;">₹${formatRupees(totalBalance)}</td>
    </tr>`
    }
  } else {
    if (showTotalsSummary) {
      passengerTfootHtml = `<tr>
      <td colspan="3" class="text-right font-bold totals-label" style="white-space: nowrap; padding-right: 8px;">${escapeHtml(t.totals)}:</td>
      <td class="text-right font-bold">₹${formatRupees(totalFare)}</td>
      <td class="text-right font-bold text-paid">₹${formatRupees(totalPaid)}</td>
      <td class="text-right font-bold ${hasTotalDue ? "text-due" : "text-paid"}">₹${formatRupees(totalBalance)}</td>
      <td class="text-center font-bold">${hasTotalDue ? `<span class="badge-due">${escapeHtml(t.statusDue)}</span>` : `<span class="badge-paid">${escapeHtml(t.statusPaid)}</span>`}</td>
    </tr>`
    }
  }

  // Payment History Rows HTML
  const historyRowsHtml =
    historyList.length > 0
      ? historyList
          .map(
            (h, idx) => `<tr>
        <td class="text-center font-bold">${idx + 1}</td>
        <td>${escapeHtml(h.date)}</td>
        <td class="text-right font-bold">₹${formatRupees(h.amount)}</td>
        <td class="text-center"><span class="mode-pill">${escapeHtml(h.mode)}</span></td>
        <td class="font-mono text-xs cell-wrap">${escapeHtml(h.reference)}</td>
        <td class="cell-wrap">${escapeHtml(h.payer)}${h.notes ? ` <span class="ref-sub">(${escapeHtml(h.notes)})</span>` : ""}</td>
      </tr>`,
          )
          .join("\n")
      : `<tr><td colspan="6" class="text-center text-muted py-3 font-bold">${escapeHtml(t.noPayments)}</td></tr>`

  const documentHeading = isGroup ? t.groupTitle : t.title

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:;"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(documentHeading)} - ${escapeHtml(docRef)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

  @page {
    size: A4 portrait;
    margin: 0; /* Suppresses browser print headers/footers */
  }

  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Devanagari", "Noto Sans Gujarati", Roboto, Arial, sans-serif;
    background: #ffffff;
    color: #000000;
    font-size: 10px;
    line-height: 1.35;
    padding: 16px 20px;
    box-sizing: border-box;
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
  }

  @media print {
    body {
      padding: 10mm;
      background: #ffffff;
      font-size: 10px;
      max-width: 100%;
    }
    .no-print { display: none !important; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; page-break-inside: avoid; break-inside: avoid; }
    tr.running-header-row { display: table-row !important; }
  }

  .summary-wrapper {
    width: 100%;
    margin: 0 auto;
  }

  .header-card {
    border-bottom: 2px solid #000000;
    padding-bottom: 8px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .company-title {
    font-size: 18px;
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
  .doc-badge-container {
    text-align: right;
  }
  .doc-badge {
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
  .doc-ref {
    font-size: 12px;
    font-weight: 800;
    font-family: monospace;
    color: #000000;
    margin-top: 2px;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: 1.1fr 1fr 1.4fr 1.2fr;
    gap: 4px 10px;
    background: #f8fafc;
    border: 1px solid #000000;
    border-radius: 3px;
    padding: 6px 10px;
    margin-bottom: 10px;
  }
  .meta-cell {
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
  .meta-value {
    font-size: 10.5px;
    font-weight: 900;
    color: #000000;
    margin-top: 1px;
  }

  .section-title {
    font-size: 10.5px;
    font-weight: 900;
    color: #000000;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Single consistent table design with 1px black borders */
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-bottom: 12px;
    font-size: 10px;
    border: 1px solid #000000;
  }
  table.data-table th,
  table.data-table td {
    border: 1px solid #000000;
    padding: 4px 6px;
    vertical-align: middle;
    box-sizing: border-box;
  }
  table.data-table th {
    background: #f1f5f9;
    color: #000000;
    font-weight: 900;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  table.data-table tbody tr:nth-child(even) {
    background: #fafafa;
  }

  table.data-table tfoot td {
    background: #e2e8f0;
    font-weight: 900;
    font-size: 10.5px;
    border: 1px solid #000000;
  }

  tr.running-header-row {
    display: none;
  }
  tr.running-header-row th {
    background: #ffffff;
    font-size: 8px;
    font-weight: normal;
    text-transform: none;
    color: #444444;
    padding: 2px 4px;
    border-top: none;
    border-left: none;
    border-right: none;
    border-bottom: 1px solid #000000;
  }

  .totals-label {
    letter-spacing: 0.04em;
    font-size: 11px;
  }

  .text-center { text-align: center; }
  .text-left { text-align: left; }
  .text-right { text-align: right; }
  .font-mono { font-family: monospace, Consolas, sans-serif; }
  .font-bold { font-weight: 900; }
  .font-medium { font-weight: 700; }
  .text-muted { color: #666666; }
  .ref-sub { font-size: 8.5px; color: #444444; font-weight: normal; }

  .seat-cell {
    white-space: nowrap !important;
    font-family: monospace, Consolas, sans-serif;
    font-weight: 800;
    text-align: center;
    letter-spacing: -0.01em;
  }

  .due-amount {
    color: #000000;
    font-weight: 900;
  }

  .cell-wrap {
    word-break: break-word;
    overflow-wrap: break-word;
  }

  /* Standout B&W Markers */
  .due-marker {
    color: #000000;
    font-weight: 900;
  }
  .due-badge {
    display: inline-block;
    border: 1px solid #000000;
    color: #000000;
    font-weight: 900;
    font-size: 7.5px;
    padding: 0 2px;
    border-radius: 2px;
    margin-left: 2px;
  }
  .paid-marker {
    color: #15803d;
    font-weight: 800;
  }
  .badge-due {
    display: inline-block;
    border: 1px solid #000000;
    background: #000000;
    color: #ffffff;
    font-weight: 900;
    font-size: 8px;
    padding: 1px 4px;
    border-radius: 2px;
    text-transform: uppercase;
  }
  .badge-paid {
    display: inline-block;
    border: 1px solid #16a34a;
    background: #dcfce7;
    color: #166534;
    font-weight: 800;
    font-size: 8px;
    padding: 1px 4px;
    border-radius: 2px;
    text-transform: uppercase;
  }
  .mode-pill {
    background: #f1f5f9;
    color: #000000;
    font-size: 8.5px;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid #cbd5e1;
  }

  .seat-deck-tag {
    display: inline-block;
    font-size: 7.5px;
    font-weight: 800;
    padding: 0 3px;
    border-radius: 2px;
    border: 1px solid #000000;
    margin-left: 2px;
    vertical-align: middle;
  }
  .tag-lower {
    background: #e0f2fe;
    color: #0369a1;
  }
  .tag-upper {
    background: #ede9fe;
    color: #6d28d9;
  }
  .deck-pricing-box {
    border: 1px solid #000000;
    background: #f8fafc;
    border-radius: 3px;
    padding: 6px 10px;
    margin-bottom: 12px;
  }
  .deck-pricing-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px dashed #cbd5e1;
    padding-bottom: 4px;
    margin-bottom: 6px;
  }
  .deck-pricing-title {
    font-size: 9.5px;
    font-weight: 900;
    color: #000000;
    letter-spacing: 0.02em;
  }
  .deck-pricing-subtitle {
    font-size: 8px;
    color: #475569;
    font-weight: 700;
  }
  .deck-cards-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1.15fr;
    gap: 8px;
  }
  .deck-card {
    border: 1px solid #000000;
    border-radius: 3px;
    padding: 5px 8px;
    background: #ffffff;
  }
  .deck-card-lower {
    background: #f0f9ff;
  }
  .deck-card-upper {
    background: #faf5ff;
  }
  .deck-card-total {
    background: #f1f5f9;
  }
  .deck-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    padding-bottom: 3px;
    border-bottom: 1px solid #cbd5e1;
  }
  .deck-pill {
    font-size: 8px;
    font-weight: 900;
    padding: 1px 4px;
    border-radius: 2px;
    border: 1px solid #000000;
  }
  .deck-pill-lower {
    background: #bae6fd;
    color: #0369a1;
  }
  .deck-pill-upper {
    background: #ddd6fe;
    color: #6d28d9;
  }
  .deck-pill-total {
    background: #000000;
    color: #ffffff;
  }
  .deck-count {
    font-size: 9px;
    color: #0f172a;
  }
  .deck-stats-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 9px;
  }
  .deck-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .deck-balance-row {
    margin-top: 2px;
    padding-top: 2px;
    border-top: 1px dashed #cbd5e1;
  }
  .stat-lbl {
    color: #475569;
    font-size: 8.5px;
  }
  .stat-val {
    color: #000000;
  }
  .font-black {
    font-weight: 900 !important;
  }
  .deck-subtotal-row td {
    background: #f8fafc !important;
    font-size: 9.5px;
    font-weight: 700;
  }
  .grand-totals-row td {
    background: #e2e8f0 !important;
    font-weight: 900;
    font-size: 10.5px;
  }

  .footer-notice {
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
<div class="summary-wrapper">

  <!-- Top Header -->
  <div class="header-card">
    <div>
      <div class="company-title">${escapeHtml(companyName)}</div>
      <div class="company-sub">
        ${companyPhone ? `<span>Tel: ${escapeHtml(companyPhone)}</span> • ` : ""}
        ${companyAddress ? `<span>${escapeHtml(companyAddress)}</span>` : ""}
      </div>
    </div>
    <div class="doc-badge-container">
      <div class="doc-badge">${escapeHtml(documentHeading)}</div>
      <div class="doc-ref">${escapeHtml(docRef)}</div>
    </div>
  </div>

  <!-- Metadata Grid -->
  <div class="meta-grid">
    <div class="meta-cell">
      <span class="meta-label">${escapeHtml(t.route)}</span>
      <span class="meta-value">${escapeHtml(tourName)}</span>
    </div>
    <div class="meta-cell">
      <span class="meta-label">${escapeHtml(t.date)}</span>
      <span class="meta-value">${escapeHtml(journeyDate)}</span>
    </div>
    <div class="meta-cell">
      <span class="meta-label">${escapeHtml(t.busNo)} / ${escapeHtml(t.busType)}</span>
      <span class="meta-value">${escapeHtml(busNumber || "—")} ${busType ? `(${escapeHtml(busType)})` : ""}</span>
    </div>
    <div class="meta-cell">
      <span class="meta-label">${isGroup ? escapeHtml(t.groupRef) : escapeHtml(t.customer)}</span>
      <span class="meta-value">${escapeHtml(contactName)}${contactPhone ? ` (${escapeHtml(contactPhone)})` : ""}</span>
    </div>
  </div>

  ${
    showDeckBreakdown && breakdown.deckBreakdown?.hasDecks
      ? `<!-- Upper & Lower Berth Pricing Breakdown -->
  <div class="deck-pricing-box">
    <div class="deck-pricing-header">
      <span class="deck-pricing-title">🛏️ UPPER &amp; LOWER BERTH PRICING BREAKDOWN</span>
      <span class="deck-pricing-subtitle">Independent Deck Collections &amp; Group Balances</span>
    </div>
    <div class="deck-cards-grid" style="${showTotalsSummary ? "" : "grid-template-columns: 1fr 1fr;"}">
      <!-- Lower Deck Card -->
      <div class="deck-card deck-card-lower">
        <div class="deck-card-top">
          <span class="deck-pill deck-pill-lower">LOWER BERTHS</span>
          <span class="deck-count font-bold">${breakdown.deckBreakdown.lower.count} Berths</span>
        </div>
        <div class="deck-stats-list">
          <div class="deck-stat-row">
            <span class="stat-lbl">Total Fare:</span>
            <span class="stat-val font-bold">₹${formatRupees(fromPaise(breakdown.deckBreakdown.lower.farePaise))}</span>
          </div>
          <div class="deck-stat-row">
            <span class="stat-lbl">Advance Paid:</span>
            <span class="stat-val font-bold text-paid">₹${formatRupees(fromPaise(breakdown.deckBreakdown.lower.paidPaise))}</span>
          </div>
          <div class="deck-stat-row deck-balance-row">
            <span class="stat-lbl font-bold">Balance Due:</span>
            <span class="stat-val font-black ${breakdown.deckBreakdown.lower.balancePaise > 0 ? "text-due" : "text-paid"}">₹${formatRupees(fromPaise(breakdown.deckBreakdown.lower.balancePaise))}</span>
          </div>
        </div>
      </div>

      <!-- Upper Deck Card -->
      <div class="deck-card deck-card-upper">
        <div class="deck-card-top">
          <span class="deck-pill deck-pill-upper">UPPER BERTHS</span>
          <span class="deck-count font-bold">${breakdown.deckBreakdown.upper.count} Berths</span>
        </div>
        <div class="deck-stats-list">
          <div class="deck-stat-row">
            <span class="stat-lbl">Total Fare:</span>
            <span class="stat-val font-bold">₹${formatRupees(fromPaise(breakdown.deckBreakdown.upper.farePaise))}</span>
          </div>
          <div class="deck-stat-row">
            <span class="stat-lbl">Advance Paid:</span>
            <span class="stat-val font-bold text-paid">₹${formatRupees(fromPaise(breakdown.deckBreakdown.upper.paidPaise))}</span>
          </div>
          <div class="deck-stat-row deck-balance-row">
            <span class="stat-lbl font-bold">Balance Due:</span>
            <span class="stat-val font-black ${breakdown.deckBreakdown.upper.balancePaise > 0 ? "text-due" : "text-paid"}">₹${formatRupees(fromPaise(breakdown.deckBreakdown.upper.balancePaise))}</span>
          </div>
        </div>
      </div>

      ${
        showTotalsSummary
          ? `<!-- Combined Group Total Card -->
      <div class="deck-card deck-card-total">
        <div class="deck-card-top">
          <span class="deck-pill deck-pill-total">GROUP OVERALL</span>
          <span class="deck-count font-bold">${totalPaxCount} Berths</span>
        </div>
        <div class="deck-stats-list">
          <div class="deck-stat-row">
            <span class="stat-lbl">Total Fare:</span>
            <span class="stat-val font-bold">₹${formatRupees(totalFare)}</span>
          </div>
          ${
            breakdown.discountPaise > 0
              ? `<div class="deck-stat-row">
            <span class="stat-lbl" style="color: #16a34a;">Discount:</span>
            <span class="stat-val font-bold" style="color: #16a34a;">-₹${formatRupees(fromPaise(breakdown.discountPaise))}</span>
          </div>
          <div class="deck-stat-row">
            <span class="stat-lbl">Net Fare:</span>
            <span class="stat-val font-bold">₹${formatRupees(fromPaise(breakdown.netFarePaise))}</span>
          </div>`
              : ""
          }
          <div class="deck-stat-row">
            <span class="stat-lbl">Total Paid:</span>
            <span class="stat-val font-bold text-paid">₹${formatRupees(totalPaid)}</span>
          </div>
          <div class="deck-stat-row deck-balance-row">
            <span class="stat-lbl font-bold">Group Balance:</span>
            <span class="stat-val font-black ${hasTotalDue ? "text-due" : "text-paid"}">₹${formatRupees(totalBalance)}</span>
          </div>
        </div>
      </div>`
          : ""
      }
    </div>
  </div>`
      : ""
  }

  <!-- Passenger Breakdown Section -->
  <div class="section-title">
    <span>👤 ${escapeHtml(t.subtitle)} (${totalPaxCount} ${escapeHtml(t.totalSeats)})</span>
  </div>

  ${
    isGroup
      ? `<table class="data-table">
    <colgroup>
      <col style="width: 36px;"/>
      <col style="width: auto;"/>
      <col style="width: 105px;"/>
      <col style="width: 95px;"/>
      <col style="width: 115px;"/>
    </colgroup>
    <thead>
      <tr class="running-header-row">
        <th colspan="5" class="text-left">
          ${escapeHtml(tourName)} | ${escapeHtml(journeyDate)} | ${escapeHtml(documentHeading)}
        </th>
      </tr>
      <tr>
        <th class="text-center">${escapeHtml(t.srNo)}</th>
        <th class="text-left">${escapeHtml(t.passengerName)}</th>
        <th class="text-center" style="white-space: nowrap;">${escapeHtml(t.seatNo)}</th>
        <th class="text-center">Berth Deck</th>
        <th class="text-right">${escapeHtml(t.fare)}</th>
      </tr>
    </thead>
    <tbody>
      ${passengerRowsHtml}
    </tbody>
    ${passengerTfootHtml ? `<tfoot>${passengerTfootHtml}</tfoot>` : ""}
  </table>`
      : `<table class="data-table">
    <colgroup>
      <col style="width: 32px;"/>
      <col style="width: auto;"/>
      <col style="width: 95px;"/>
      <col style="width: 78px;"/>
      <col style="width: 78px;"/>
      <col style="width: 84px;"/>
      <col style="width: 64px;"/>
    </colgroup>
    <thead>
      <tr class="running-header-row">
        <th colspan="7" class="text-left">
          ${escapeHtml(tourName)} | ${escapeHtml(journeyDate)} | ${escapeHtml(documentHeading)}
        </th>
      </tr>
      <tr>
        <th class="text-center">${escapeHtml(t.srNo)}</th>
        <th class="text-left">${escapeHtml(t.passengerName)}</th>
        <th class="text-center" style="white-space: nowrap;">${escapeHtml(t.seatNo)}</th>
        <th class="text-right">${escapeHtml(t.fare)}</th>
        <th class="text-right">${escapeHtml(t.paid)}</th>
        <th class="text-right">${escapeHtml(t.balance)}</th>
        <th class="text-center">${escapeHtml(t.status)}</th>
      </tr>
    </thead>
    <tbody>
      ${passengerRowsHtml}
    </tbody>
    ${passengerTfootHtml ? `<tfoot>${passengerTfootHtml}</tfoot>` : ""}
  </table>`
  }

  <!-- Payment Transactions History Section -->
  <div class="section-title" style="margin-top: 14px;">
    <span>💳 ${escapeHtml(t.paymentHistory)}</span>
  </div>

  <table class="data-table">
    <colgroup>
      <col style="width: 32px;"/>
      <col style="width: 85px;"/>
      <col style="width: 85px;"/>
      <col style="width: 75px;"/>
      <col style="width: 105px;"/>
      <col style="width: auto;"/>
    </colgroup>
    <thead>
      <tr>
        <th class="text-center">#</th>
        <th class="text-left">${escapeHtml(t.paymentDate)}</th>
        <th class="text-right">${escapeHtml(t.amount)}</th>
        <th class="text-center">${escapeHtml(t.mode)}</th>
        <th class="text-left">${escapeHtml(t.reference)}</th>
        <th class="text-left">${escapeHtml(t.receivedBy)}</th>
      </tr>
    </thead>
    <tbody>
      ${historyRowsHtml}
    </tbody>
  </table>

  <!-- Clean Small Footer Notice -->
  <div class="footer-notice">
    <span>${escapeHtml(companyName)} • ${escapeHtml(documentHeading)}</span>
    <span>${escapeHtml(t.generatedOn)}: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
  </div>

</div>
</body>
</html>`
}
