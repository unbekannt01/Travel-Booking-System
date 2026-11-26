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
import { formatSeatDisplayName, resolveSeatId, layoutKeyForBusType } from "./seatLayouts.js"
import { isGroupBooking, getGroupInfo } from "./groupHelpers.js"

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
}) {
  const paxList = []

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

      const isWholeRupees = (memberTotalFarePaise % 100 === 0) && (cappedPaidPaise % 100 === 0)
      let baseFarePaise, fareRemainder
      let basePaidPaise, paidRemainder
      let step = 1

      if (isWholeRupees) {
        step = 100
        const fareRupees = Math.round(memberTotalFarePaise / 100)
        const baseFareRupees = Math.floor(fareRupees / paxCount)
        fareRemainder = (fareRupees - baseFareRupees * paxCount) * 100
        baseFarePaise = baseFareRupees * 100

        const paidRupees = Math.round(cappedPaidPaise / 100)
        const basePaidRupees = Math.floor(paidRupees / paxCount)
        paidRemainder = (paidRupees - basePaidRupees * paxCount) * 100
        basePaidPaise = basePaidRupees * 100
      } else {
        baseFarePaise = Math.floor(memberTotalFarePaise / paxCount)
        fareRemainder = memberTotalFarePaise - baseFarePaise * paxCount

        basePaidPaise = Math.floor(cappedPaidPaise / paxCount)
        paidRemainder = cappedPaidPaise - basePaidPaise * paxCount
      }

      for (let i = 0; i < mPaxList.length; i++) {
        const p = mPaxList[i]
        const pFarePaise = p.fare ? toPaise(p.fare) : baseFarePaise + (fareRemainder > 0 ? step : 0)
        if (!p.fare && fareRemainder > 0) fareRemainder -= step

        const pPaidPaise = Math.min(
          pFarePaise,
          p.paid !== undefined ? toPaise(p.paid) : basePaidPaise + (paidRemainder > 0 ? step : 0),
        )
        if (p.paid === undefined && paidRemainder > 0) paidRemainder -= step

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

    const isWholeRupees = (bookingTotalFarePaise % 100 === 0) && (cappedPaidPaise % 100 === 0)
    let baseFarePaise, fareRemainder
    let basePaidPaise, paidRemainder
    let step = 1

    if (isWholeRupees) {
      step = 100
      const fareRupees = Math.round(bookingTotalFarePaise / 100)
      const baseFareRupees = Math.floor(fareRupees / paxCount)
      fareRemainder = (fareRupees - baseFareRupees * paxCount) * 100
      baseFarePaise = baseFareRupees * 100

      const paidRupees = Math.round(cappedPaidPaise / 100)
      const basePaidRupees = Math.floor(paidRupees / paxCount)
      paidRemainder = (paidRupees - basePaidRupees * paxCount) * 100
      basePaidPaise = basePaidRupees * 100
    } else {
      baseFarePaise = Math.floor(bookingTotalFarePaise / paxCount)
      fareRemainder = bookingTotalFarePaise - baseFarePaise * paxCount

      basePaidPaise = Math.floor(cappedPaidPaise / paxCount)
      paidRemainder = cappedPaidPaise - basePaidPaise * paxCount
    }

    for (let i = 0; i < bPaxList.length; i++) {
      const p = bPaxList[i]
      const pFarePaise = p.fare ? toPaise(p.fare) : baseFarePaise + (fareRemainder > 0 ? step : 0)
      if (!p.fare && fareRemainder > 0) fareRemainder -= step

      const pPaidPaise = Math.min(
        pFarePaise,
        p.paid !== undefined ? toPaise(p.paid) : basePaidPaise + (paidRemainder > 0 ? step : 0),
      )
      if (p.paid === undefined && paidRemainder > 0) paidRemainder -= step

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

  const totalFarePaise = paxList.reduce((sum, p) => sum + p.farePaise, 0)
  const totalPaidPaise = paxList.reduce((sum, p) => sum + p.paidPaise, 0)
  const totalBalancePaise = Math.max(0, totalFarePaise - totalPaidPaise)

  return {
    passengers: paxList,
    totalFarePaise,
    totalPaidPaise,
    totalBalancePaise,
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

  const breakdown = calculatePassengerBreakdown({
    booking,
    group,
    memberBookings,
    payments,
    groupPayments,
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

  // Passenger Rows HTML
  const passengerRowsHtml = breakdown.passengers
    .map((p) => {
      const fareRupees = fromPaise(p.farePaise)
      const paidRupees = fromPaise(p.paidPaise)
      const balanceRupees = fromPaise(p.balancePaise)
      const isDue = p.balancePaise > 0

      const balanceCellHtml = isDue
        ? `<span class="due-marker"><strong>₹${formatRupees(balanceRupees)}</strong> <span class="due-badge">[DUE]</span></span>`
        : `<span class="paid-marker">₹0</span>`

      const statusLabel =
        p.status === "PAID" ? t.statusPaid : p.status === "PARTIAL" ? t.statusPartial : t.statusDue
      const statusBadge = isDue
        ? `<span class="badge-due">${escapeHtml(statusLabel)}</span>`
        : `<span class="badge-paid">${escapeHtml(statusLabel)}</span>`

      const seatDisplay = p.seat ? escapeHtml(formatSeatDisplayName(layoutKey, p.seat)) : "—"

      return `<tr>
        <td class="text-center font-bold">${p.srNo}</td>
        <td class="cell-wrap"><strong>${escapeHtml(p.name)}</strong>${isGroup && p.bookingRef ? ` <span class="ref-sub">(${escapeHtml(p.bookingRef)})</span>` : ""}</td>
        <td class="text-center font-mono font-bold">${seatDisplay}</td>
        <td class="text-right">₹${formatRupees(fareRupees)}</td>
        <td class="text-right font-medium">₹${formatRupees(paidRupees)}</td>
        <td class="text-right">${balanceCellHtml}</td>
        <td class="text-center">${statusBadge}</td>
      </tr>`
    })
    .join("\n")

  const totalFare = fromPaise(breakdown.totalFarePaise)
  const totalPaid = fromPaise(breakdown.totalPaidPaise)
  const totalBalance = fromPaise(breakdown.totalBalancePaise)
  const hasTotalDue = breakdown.totalBalancePaise > 0

  // Passenger Table tfoot using colspan for leading columns
  const passengerTfootHtml = `<tr>
    <td colspan="3" class="text-right font-bold totals-label" style="white-space: nowrap; padding-right: 8px;">${escapeHtml(t.totals)}</td>
    <td class="text-right font-bold">₹${formatRupees(totalFare)}</td>
    <td class="text-right font-bold">₹${formatRupees(totalPaid)}</td>
    <td class="text-right font-bold ${hasTotalDue ? "text-due" : "text-paid"}">₹${formatRupees(totalBalance)}</td>
    <td class="text-center font-bold">${hasTotalDue ? `<span class="badge-due">${escapeHtml(t.statusDue)}</span>` : `<span class="badge-paid">${escapeHtml(t.statusPaid)}</span>`}</td>
  </tr>`

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
    font-size: 10.5px;
    line-height: 1.35;
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
    grid-template-columns: repeat(4, 1fr);
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

  .totals-summary-box {
    margin-left: auto;
    width: 260px;
    border: 1px solid #000000;
    border-radius: 3px;
    background: #f8fafc;
    padding: 6px 10px;
    margin-bottom: 12px;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    font-size: 10.5px;
  }
  .totals-row.grand {
    border-top: 1px solid #000000;
    margin-top: 3px;
    padding-top: 4px;
    font-size: 11.5px;
    font-weight: 900;
  }
  .total-due-text {
    color: #000000;
    font-weight: 900;
  }
  .total-paid-text {
    color: #15803d;
    font-weight: 900;
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

  <!-- Passenger Breakdown Section -->
  <div class="section-title">
    <span>👤 ${escapeHtml(t.subtitle)} (${totalPaxCount} ${escapeHtml(t.totalSeats)})</span>
  </div>

  <table class="data-table">
    <colgroup>
      <col style="width: 36px;"/>
      <col style="width: auto;"/>
      <col style="width: 58px;"/>
      <col style="width: 82px;"/>
      <col style="width: 82px;"/>
      <col style="width: 92px;"/>
      <col style="width: 72px;"/>
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
        <th class="text-center">${escapeHtml(t.seatNo)}</th>
        <th class="text-right">${escapeHtml(t.fare)}</th>
        <th class="text-right">${escapeHtml(t.paid)}</th>
        <th class="text-right">${escapeHtml(t.balance)}</th>
        <th class="text-center">${escapeHtml(t.status)}</th>
      </tr>
    </thead>
    <tbody>
      ${passengerRowsHtml}
    </tbody>
    <tfoot>
      ${passengerTfootHtml}
    </tfoot>
  </table>

  <!-- Overall Financial Summary Box -->
  <div class="totals-summary-box">
    <div class="totals-row">
      <span class="font-bold">${escapeHtml(t.fare)}:</span>
      <span class="font-bold">₹${formatRupees(totalFare)}</span>
    </div>
    <div class="totals-row">
      <span class="font-bold">${escapeHtml(t.paid)}:</span>
      <span class="total-paid-text">₹${formatRupees(totalPaid)}</span>
    </div>
    <div class="totals-row grand">
      <span class="font-bold">${escapeHtml(t.balance)}:</span>
      <span class="total-due-text">₹${formatRupees(totalBalance)}</span>
    </div>
  </div>

  <!-- Payment Transactions History Section -->
  <div class="section-title">
    <span>💳 ${escapeHtml(t.paymentHistory)}</span>
  </div>

  <table class="data-table">
    <colgroup>
      <col style="width: 36px;"/>
      <col style="width: 85px;"/>
      <col style="width: 95px;"/>
      <col style="width: 90px;"/>
      <col style="width: 110px;"/>
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
