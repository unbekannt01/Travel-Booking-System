/**
 * YatraHub (TBS) — Pure Shared Profit & Loss Engine (Part 4b)
 * Plain JavaScript ESM module with zero external dependencies.
 * Shared between backend (reports/routes) and frontend (Analytics/Journeys/Expenses).
 *
 * DEFINITIONS & ACCOUNTING RULES:
 * 1. Booked Basis (Accrual):
 *    - Booked Revenue: Sum of totalAmount for all non-cancelled bookings.
 *    - Cancellation Fees Retained: Fees retained by the operator upon booking cancellation.
 *    - Expenses Total: Sum of all active expenses (paid + pending).
 *    - Booked Profit: (Booked Revenue + Cancellation Fees Retained) - Expenses Total.
 *    - Operating Margin %: (Booked Profit / Booked Revenue) * 100 (null if Booked Revenue == 0).
 *
 * 2. Cash Basis:
 *    - Collected: Actual cash/UPI/bank payments received net of refunds (active payments + retained cancellation fees).
 *    - Expenses Paid: Sum of active expenses with status === 'paid'.
 *    - Cash Profit: Collected - Expenses Paid.
 *
 * 3. Outstanding Balance:
 *    - Outstanding: Uncollected balance due strictly across active (non-cancelled) bookings.
 *    - Cancelled bookings have zero balance due.
 *
 * 4. Unit Economics:
 *    - Average Ticket Price: Booked Revenue / non-cancelled passengers (0 if 0 passengers).
 *    - Cost Per Passenger: Expenses Total / non-cancelled passengers (null if 0 passengers).
 *    - Break-Even Seats: Math.ceil(Expenses Total / Average Ticket Price) (null if Average Ticket Price == 0).
 *    - Seats to Break-Even: Math.max(0, Break-Even Seats - Passengers Sold) (null if Break-Even Seats == null).
 *
 * 4. General Expenses:
 *    - Expenses not linked to any tour or departure are placed in a 'General' bucket.
 *    - General expenses are tracked separately and subtracted in Overall Business Profit.
 */

import { round2, sumAmounts } from "./expenses.js"
import { calculateCancellationRefund, computeLedgerTotals } from "./businessLogic.js"

/**
 * Checks if a booking is cancelled (case-insensitive for safety).
 * @param {{ status?: string }} booking
 * @returns {boolean}
 */
export function isBookingCancelled(booking) {
  const s = String(booking?.status || "").toLowerCase().trim()
  return s === "cancelled" || s === "canceled"
}

/**
 * Classifies a tourRef string into tourName and departureKey.
 * Departure key format: `<tourName>___<dateKey>___<bus>`
 *
 * @param {string|null|undefined} value
 * @returns {{
 *   tourName: string|null,
 *   departureKey: string|null,
 *   dateKey?: string|null,
 *   bus?: string|null,
 *   isDeparture: boolean,
 *   isGeneral: boolean
 * }}
 */
export function parseTourRef(value) {
  if (!value || typeof value !== "string" || !value.trim()) {
    return {
      tourName: null,
      departureKey: null,
      dateKey: null,
      bus: null,
      isDeparture: false,
      isGeneral: true,
    }
  }

  const trimmed = value.trim()
  if (trimmed.toLowerCase() === "general") {
    return {
      tourName: null,
      departureKey: null,
      dateKey: null,
      bus: null,
      isDeparture: false,
      isGeneral: true,
    }
  }

  if (trimmed.includes("___")) {
    const parts = trimmed.split("___")
    const tourName = parts[0] || null
    const dateKey = parts[1] || null
    const bus = parts[2] || null
    return {
      tourName,
      departureKey: trimmed,
      dateKey,
      bus,
      isDeparture: true,
      isGeneral: false,
    }
  }

  return {
    tourName: trimmed,
    departureKey: null,
    dateKey: null,
    bus: null,
    isDeparture: false,
    isGeneral: false,
  }
}

/**
 * Resolves coach capacity based on busType string.
 * @param {string|null|undefined} busType
 * @returns {number}
 */
export function getBusCapacity(busType) {
  if (typeof busType === "string" && busType.trim().startsWith("2x2")) {
    return 40
  }
  return 36
}

/**
 * Formats a Date object or string into YYYY-MM-DD.
 * @param {Date|string|number} d
 * @returns {string}
 */
export function toDateKey(d) {
  if (!d) return ""
  if (typeof d === "string") {
    const match = d.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  const dateObj = new Date(d)
  if (isNaN(dateObj.getTime())) return ""
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, "0")
  const day = String(dateObj.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Calculates authoritative financial figures for a single booking.
 * Shared between the P&L engine, Customer summary, Receivables, and Statements.
 *
 * RULES:
 * 1. Cancelled bookings contribute:
 *    - 0 passengers
 *    - 0 booked revenue
 *    - 0 outstanding
 *    - Collected revenue = cancellation charge from calculateCancellationRefund capped at total paid
 *    - Cancellation fees retained = cancellation charge capped at total paid
 *    - Refunds paid = total paid - cancellation fee
 * 2. Active bookings contribute:
 *    - passengers: number of passengers
 *    - bookedRevenue: totalAmount
 *    - collected: payments ledger authoritative (or advanceReceived fallback)
 *    - outstanding: Math.max(0, totalAmount - paid)
 *    - cancellationFee: 0
 *
 * @param {Object} b - Booking record
 * @returns {{
 *   isCancelled: boolean,
 *   passengers: number,
 *   bookedRevenue: number,
 *   collected: number,
 *   outstanding: number,
 *   cancellationFeesRetained: number,
 *   refundsPaid: number,
 *   totalPaid: number,
 * }}
 */
export function calculateBookingFinancials(b) {
  if (!b) {
    return {
      isCancelled: false,
      passengers: 0,
      bookedRevenue: 0,
      collected: 0,
      outstanding: 0,
      cancellationFeesRetained: 0,
      refundsPaid: 0,
      totalPaid: 0,
    }
  }

  const isCancelled = isBookingCancelled(b)
  if (isCancelled) {
    // 1. Authoritative payment resolution: payments array vs advanceReceived
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

    // 2. Cancellation fee and refund determination (source of truth: calculateCancellationRefund capped at totalPaid)
    let fee = 0
    let refundAmount = 0

    if (b.cancellationCharge !== undefined && b.cancellationCharge !== null && b.cancellationCharge !== "") {
      const charge = round2(b.cancellationCharge)
      fee = Math.min(totalPaid, Math.max(0, charge))
      refundAmount =
        b.refundAmount !== undefined && b.refundAmount !== null && b.refundAmount !== ""
          ? Math.min(totalPaid, Math.max(0, round2(b.refundAmount)))
          : round2(totalPaid - fee)
    } else if (b.refundAmount !== undefined && b.refundAmount !== null && b.refundAmount !== "") {
      refundAmount = Math.min(totalPaid, Math.max(0, round2(b.refundAmount)))
      fee = round2(totalPaid - refundAmount)
    } else {
      try {
        const calc = calculateCancellationRefund({ totalPaid, cancellationCharge: 0 })
        fee = calc.cancellationCharge
        refundAmount = calc.refundAmount
      } catch {
        fee = 0
        refundAmount = totalPaid
      }
    }

    return {
      isCancelled: true,
      passengers: 0,
      bookedRevenue: 0,
      collected: fee,
      outstanding: 0,
      balanceDue: 0,
      cancellationFeesRetained: fee,
      retainedFees: fee,
      refundsPaid: refundAmount,
      totalPaid,
    }
  }

  // Active booking
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

  return {
    isCancelled: false,
    passengers: paxCount,
    bookedRevenue: total,
    collected: paid,
    outstanding: balance,
    balanceDue: balance,
    cancellationFeesRetained: 0,
    retainedFees: 0,
    refundsPaid: 0,
    totalPaid: paid,
  }
}

/**
 * Computes comprehensive Tour-wise and Departure-wise Profit/Loss metrics.
 *
 * @param {Object} params
 * @param {Array<Object>} params.bookings - Array of booking records
 * @param {Array<Object>} params.expenses - Array of expense records (active, non-deleted)
 * @param {Object} [params.capacities] - Optional map of departureKey -> capacity number
 * @param {Object} [params.filters] - Filter criteria: { from, to, tourName, departureKey, groupBy }
 * @returns {Object} Structured P&L report
 */
export function calculateProfitLoss({
  bookings = [],
  expenses = [],
  capacities = {},
  filters = {},
} = {}) {
  const { from, to, tourName: filterTour, departureKey: filterDep } = filters || {}

  // 1. Filter bookings by date and tour if provided
  const filteredBookings = (bookings || []).filter((b) => {
    if (b.deletedAt) return false

    // Date filtering: use journeyDate if available, fallback to booking date
    const bDate = toDateKey(b.journeyDate || b.date || b.createdAt)
    if (from && bDate && bDate < from) return false
    if (to && bDate && bDate > to) return false

    // Tour filtering
    if (filterTour && filterTour !== "all" && b.tourName !== filterTour) {
      return false
    }

    // Departure key filtering
    if (filterDep && filterDep !== "all") {
      const bus = b.busType || "2x1 Sleeper Luxury"
      const depKey = `${b.tourName}___${bDate}___${bus}`
      if (depKey !== filterDep) return false
    }

    return true
  })

  // 2. Filter expenses by date and tour if provided
  const activeExpenses = (expenses || []).filter((e) => {
    if (e.deletedAt) return false

    const eDate = toDateKey(e.date || e.createdAt)
    if (from && eDate && eDate < from) return false
    if (to && eDate && eDate > to) return false

    const parsed = parseTourRef(e.tourRef || e.departureKey || e.tourName)
    const resolvedTour = e.tourName || parsed.tourName
    const resolvedDep = e.departureKey || (parsed.isDeparture ? parsed.departureKey : null)

    if (filterTour && filterTour !== "all") {
      if (filterTour === "general") {
        if (!parsed.isGeneral) return false
      } else if (resolvedTour !== filterTour) {
        return false
      }
    }

    if (filterDep && filterDep !== "all") {
      if (resolvedDep !== filterDep) return false
    }

    return true
  })

  // 3. Separate general expenses from tour-linked expenses
  const generalExpensesList = []
  const tourExpensesList = []

  for (const exp of activeExpenses) {
    const parsed = parseTourRef(exp.tourRef || exp.departureKey || exp.tourName)
    const isGeneral = !exp.tourName && parsed.isGeneral
    if (isGeneral) {
      generalExpensesList.push(exp)
    } else {
      tourExpensesList.push({
        ...exp,
        _resolvedTourName: exp.tourName || parsed.tourName,
        _resolvedDepartureKey: exp.departureKey || (parsed.isDeparture ? parsed.departureKey : null),
      })
    }
  }

  // General expenses metrics
  const generalExpensesPaid = sumAmounts(generalExpensesList.filter((e) => e.status === "paid"))
  const generalExpensesPending = sumAmounts(generalExpensesList.filter((e) => e.status === "pending"))
  const generalExpensesTotal = sumAmounts(generalExpensesList)

  // 4. Group by Departure
  const departureMap = new Map()

  // Helper to ensure departure entry
  const getOrCreateDeparture = (depKey, tourName, journeyDate, busType) => {
    if (!departureMap.has(depKey)) {
      const dateStr = toDateKey(journeyDate)
      const bus = busType || "2x1 Sleeper Luxury"
      const cap = capacities[depKey] || getBusCapacity(bus)

      departureMap.set(depKey, {
        departureKey: depKey,
        tourName,
        journeyDate,
        dateStr,
        busType: bus,
        capacity: cap,
        bookings: [],
        expenses: [],
        passengers: 0,
        bookedRevenue: 0,
        collected: 0,
        outstanding: 0,
        cancellationFeesRetained: 0,
        refundsPaid: 0,
        expensesPaid: 0,
        expensesPending: 0,
        expensesTotal: 0,
        profitBooked: 0,
        profitCash: 0,
        marginPercent: null,
        occupancyPercent: null,
        avgTicketPrice: 0,
        costPerPassenger: null,
        breakEvenSeats: null,
        seatsToBreakEvenRemaining: null,
      })
    }
    return departureMap.get(depKey)
  }

  // Add bookings to departures
  for (const b of filteredBookings) {
    const dateStr = toDateKey(b.journeyDate || b.date)
    const bus = b.busType || "2x1 Sleeper Luxury"
    const depKey = `${b.tourName}___${dateStr}___${bus}`
    const dep = getOrCreateDeparture(depKey, b.tourName, b.journeyDate || b.date, bus)
    dep.bookings.push(b)

    const fin = calculateBookingFinancials(b)
    if (fin.isCancelled) {
      dep.cancellationFeesRetained = round2(dep.cancellationFeesRetained + fin.cancellationFeesRetained)
      dep.collected = round2(dep.collected + fin.collected)
      dep.refundsPaid = round2(dep.refundsPaid + fin.refundsPaid)
    } else {
      dep.passengers += fin.passengers
      dep.bookedRevenue = round2(dep.bookedRevenue + fin.bookedRevenue)
      dep.collected = round2(dep.collected + fin.collected)
      dep.outstanding = round2(dep.outstanding + fin.outstanding)
    }
  }

  // Add expenses to departures or tour-level
  const tourLevelExpensesMap = new Map() // tourName -> expenses array

  for (const exp of tourExpensesList) {
    const depKey = exp._resolvedDepartureKey
    const tourName = exp._resolvedTourName

    if (depKey) {
      const parsed = parseTourRef(depKey)
      const dep = getOrCreateDeparture(depKey, tourName || parsed.tourName, parsed.dateKey, parsed.bus)
      dep.expenses.push(exp)
    } else if (tourName) {
      if (!tourLevelExpensesMap.has(tourName)) {
        tourLevelExpensesMap.set(tourName, [])
      }
      tourLevelExpensesMap.get(tourName).push(exp)
    }
  }

  // Calculate departure economics
  for (const dep of departureMap.values()) {
    dep.expensesPaid = sumAmounts(dep.expenses.filter((e) => e.status === "paid"))
    dep.expensesPending = sumAmounts(dep.expenses.filter((e) => e.status === "pending"))
    dep.expensesTotal = sumAmounts(dep.expenses)

    // Booked profit = Booked Revenue + Retained Cancellation Fees - Total Expenses
    dep.profitBooked = round2(dep.bookedRevenue + dep.cancellationFeesRetained - dep.expensesTotal)

    // Cash profit = Cash Collected - Cash Expenses Paid
    dep.profitCash = round2(dep.collected - dep.expensesPaid)

    dep.marginPercent = dep.bookedRevenue > 0 ? round2((dep.profitBooked / dep.bookedRevenue) * 100) : null
    dep.occupancyPercent = dep.capacity > 0 ? round2(Math.min(100, (dep.passengers / dep.capacity) * 100)) : null

    dep.avgTicketPrice = dep.passengers > 0 ? round2(dep.bookedRevenue / dep.passengers) : 0
    dep.costPerPassenger = dep.passengers > 0 ? round2(dep.expensesTotal / dep.passengers) : null

    dep.breakEvenSeats = dep.avgTicketPrice > 0 ? Math.ceil(dep.expensesTotal / dep.avgTicketPrice) : null
    dep.seatsToBreakEvenRemaining =
      dep.breakEvenSeats !== null ? Math.max(0, dep.breakEvenSeats - dep.passengers) : null
  }

  const departureList = Object.freeze(
    Array.from(departureMap.values()).sort((a, b) => (b.dateStr || "").localeCompare(a.dateStr || "")),
  )

  // 5. Group by Tour
  const tourMap = new Map()

  // Collect all unique tours from departures, bookings, and expenses
  const allTourNames = new Set([
    ...departureList.map((d) => d.tourName).filter(Boolean),
    ...filteredBookings.map((b) => b.tourName).filter(Boolean),
    ...Array.from(tourLevelExpensesMap.keys()).filter(Boolean),
  ])

  for (const tName of allTourNames) {
    const departuresOfTour = departureList.filter((d) => d.tourName === tName)
    const unallocatedTourExpenses = tourLevelExpensesMap.get(tName) || []

    let passengers = 0
    let bookedRevenue = 0
    let collected = 0
    let outstanding = 0
    let cancellationFeesRetained = 0
    let refundsPaid = 0
    let departureExpensesPaid = 0
    let departureExpensesPending = 0
    let departureExpensesTotal = 0
    let totalCapacity = 0

    for (const d of departuresOfTour) {
      passengers += d.passengers
      bookedRevenue = round2(bookedRevenue + d.bookedRevenue)
      collected = round2(collected + d.collected)
      outstanding = round2(outstanding + d.outstanding)
      cancellationFeesRetained = round2(cancellationFeesRetained + d.cancellationFeesRetained)
      refundsPaid = round2(refundsPaid + d.refundsPaid)
      departureExpensesPaid = round2(departureExpensesPaid + d.expensesPaid)
      departureExpensesPending = round2(departureExpensesPending + d.expensesPending)
      departureExpensesTotal = round2(departureExpensesTotal + d.expensesTotal)
      totalCapacity += d.capacity || 0
    }

    const unallocPaid = sumAmounts(unallocatedTourExpenses.filter((e) => e.status === "paid"))
    const unallocPending = sumAmounts(unallocatedTourExpenses.filter((e) => e.status === "pending"))
    const unallocTotal = sumAmounts(unallocatedTourExpenses)

    const expensesPaid = round2(departureExpensesPaid + unallocPaid)
    const expensesPending = round2(departureExpensesPending + unallocPending)
    const expensesTotal = round2(departureExpensesTotal + unallocTotal)

    const profitBooked = round2(bookedRevenue + cancellationFeesRetained - expensesTotal)
    const profitCash = round2(collected - expensesPaid)
    const marginPercent = bookedRevenue > 0 ? round2((profitBooked / bookedRevenue) * 100) : null
    const occupancyPercent = totalCapacity > 0 ? round2(Math.min(100, (passengers / totalCapacity) * 100)) : null

    const avgTicketPrice = passengers > 0 ? round2(bookedRevenue / passengers) : 0
    const costPerPassenger = passengers > 0 ? round2(expensesTotal / passengers) : null
    const breakEvenSeats = avgTicketPrice > 0 ? Math.ceil(expensesTotal / avgTicketPrice) : null
    const seatsToBreakEvenRemaining =
      breakEvenSeats !== null ? Math.max(0, breakEvenSeats - passengers) : null

    tourMap.set(tName, {
      tourName: tName,
      departuresCount: departuresOfTour.length,
      departures: departuresOfTour,
      unallocatedExpenses: unallocatedTourExpenses,
      passengers,
      capacity: totalCapacity,
      occupancyPercent,
      bookedRevenue,
      collected,
      outstanding,
      cancellationFeesRetained,
      refundsPaid,
      expensesPaid,
      expensesPending,
      expensesTotal,
      profitBooked,
      profitCash,
      marginPercent,
      avgTicketPrice,
      costPerPassenger,
      breakEvenSeats,
      seatsToBreakEvenRemaining,
    })
  }

  const tourList = Object.freeze(
    Array.from(tourMap.values()).sort((a, b) => b.bookedRevenue - a.bookedRevenue),
  )

  // 6. Overall Aggregated Totals
  let totalPassengers = 0
  let totalCapacity = 0
  let totalBookedRevenue = 0
  let totalCollected = 0
  let totalOutstanding = 0
  let totalCancellationFees = 0
  let totalRefundsPaid = 0
  let totalTourExpensesPaid = 0
  let totalTourExpensesPending = 0
  let totalTourExpenses = 0

  for (const t of tourList) {
    totalPassengers += t.passengers
    totalCapacity += t.capacity || 0
    totalBookedRevenue = round2(totalBookedRevenue + t.bookedRevenue)
    totalCollected = round2(totalCollected + t.collected)
    totalOutstanding = round2(totalOutstanding + t.outstanding)
    totalCancellationFees = round2(totalCancellationFees + t.cancellationFeesRetained)
    totalRefundsPaid = round2(totalRefundsPaid + t.refundsPaid)
    totalTourExpensesPaid = round2(totalTourExpensesPaid + t.expensesPaid)
    totalTourExpensesPending = round2(totalTourExpensesPending + t.expensesPending)
    totalTourExpenses = round2(totalTourExpenses + t.expensesTotal)
  }

  const tourProfitBooked = round2(totalBookedRevenue + totalCancellationFees - totalTourExpenses)
  const tourProfitCash = round2(totalCollected - totalTourExpensesPaid)
  const tourMarginPercent =
    totalBookedRevenue > 0 ? round2((tourProfitBooked / totalBookedRevenue) * 100) : null
  const overallOccupancyPercent =
    totalCapacity > 0 ? round2(Math.min(100, (totalPassengers / totalCapacity) * 100)) : null

  // Overall business profit including general overhead expenses
  const allExpensesPaid = round2(totalTourExpensesPaid + generalExpensesPaid)
  const allExpensesPending = round2(totalTourExpensesPending + generalExpensesPending)
  const allExpensesTotal = round2(totalTourExpenses + generalExpensesTotal)

  const overallBusinessProfitBooked = round2(totalBookedRevenue + totalCancellationFees - allExpensesTotal)
  const overallBusinessProfitCash = round2(totalCollected - allExpensesPaid)
  const overallBusinessMarginPercent =
    totalBookedRevenue > 0 ? round2((overallBusinessProfitBooked / totalBookedRevenue) * 100) : null

  return Object.freeze({
    summary: Object.freeze({
      bookedRevenue: totalBookedRevenue,
      collected: totalCollected,
      outstanding: totalOutstanding,
      cancellationFeesRetained: totalCancellationFees,
      refundsPaid: totalRefundsPaid,
      tourExpensesPaid: totalTourExpensesPaid,
      tourExpensesPending: totalTourExpensesPending,
      tourExpensesTotal: totalTourExpenses,
      tourProfitBooked,
      tourProfitCash,
      tourMarginPercent,
      generalExpensesPaid,
      generalExpensesPending,
      generalExpensesTotal,
      generalExpensesCount: generalExpensesList.length,
      allExpensesPaid,
      allExpensesPending,
      allExpensesTotal,
      overallBusinessProfitBooked,
      overallBusinessProfitCash,
      overallBusinessMarginPercent,
      passengers: totalPassengers,
      capacity: totalCapacity,
      occupancyPercent: overallOccupancyPercent,
      toursCount: tourList.length,
      departuresCount: departureList.length,
    }),
    tours: tourList,
    departures: departureList,
    generalExpenses: Object.freeze(generalExpensesList),
  })
}
