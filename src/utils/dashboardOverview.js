import { toDateInputValue } from "./date.js"
import { calculateBookingFinancials } from "../../shared/profitLoss.js"
import { layoutKeyForBusType, getSeatLayout } from "../../shared/seatLayouts.js"

/**
 * Pure helper utilities for the Dashboard Overview & Payment Tracker summary cards.
 * Kept JSX-free so they can be unit-tested directly with node:test.
 */

/**
 * Returns total coach berth/seat capacity for a given busType string.
 * Uses layout definition from shared/seatLayouts.js.
 * @param {string | undefined | null} busType
 * @returns {number}
 */
export function getBusCapacity(busType) {
  const key = layoutKeyForBusType(busType)
  const def = getSeatLayout(key)
  return def ? def.totalSeats : 38
}

/**
 * Checks whether a booking is cancelled.
 * @param {{ status?: string }} booking
 * @returns {boolean}
 */
export function isBookingCancelled(booking) {
  const s = (booking?.status || "").toLowerCase()
  return s === "cancelled" || s === "canceled"
}

/**
 * Computes remaining balance for a booking using authoritative ledger financials (never negative).
 * @param {{ totalAmount?: number, advanceReceived?: number, payments?: Array }} booking
 * @returns {number}
 */
export function getBookingBalance(booking) {
  if (!booking) return 0
  const fin = calculateBookingFinancials(booking)
  return fin.outstanding
}

/**
 * Computes total paid amount for a booking using authoritative ledger financials.
 * @param {{ totalAmount?: number, advanceReceived?: number, payments?: Array }} booking
 * @returns {number}
 */
export function getBookingPaidAmount(booking) {
  if (!booking) return 0
  const fin = calculateBookingFinancials(booking)
  return fin.collected
}

/**
 * Resolves the canonical payment/lifecycle StatusPill value for a booking.
 * @param {{ status?: string, isPaid?: boolean, totalAmount?: number, advanceReceived?: number, payments?: Array }} booking
 * @returns {"Cancelled" | "Paid" | "Partial" | "Pending"}
 */
export function getBookingPaymentStatus(booking) {
  if (isBookingCancelled(booking)) return "Cancelled"
  const fin = calculateBookingFinancials(booking)
  if (booking?.isPaid || fin.outstanding === 0) return "Paid"
  if (fin.collected > 0) return "Partial"
  return "Pending"
}

/**
 * Computes occupancy percentage clamped to 0..100.
 * @param {number} bookedCount
 * @param {number} capacity
 * @returns {number}
 */
export function calculateOccupancyPercent(bookedCount, capacity) {
  const cap = Number(capacity) || 0
  const booked = Math.max(0, Number(bookedCount) || 0)
  if (cap <= 0) return 0
  return Math.min(100, Math.round((booked / cap) * 100))
}

/**
 * Computes KPI and daily operations metrics from bookings and tours.
 * @param {Array<Object>} bookings
 * @param {Array<Object>} tours
 * @param {Date} [now]
 */
export function computeOverviewMetrics(bookings = [], tours = [], now = new Date()) {
  const todayStr = toDateInputValue(now)

  const activeBookings = bookings.filter((b) => !isBookingCancelled(b))
  const todayActiveBookings = activeBookings.filter(
    (b) => toDateInputValue(b.journeyDate) === todayStr,
  )

  const todayTours = [...new Set(todayActiveBookings.map((b) => b.tourName))].filter(Boolean)
  const todayPax = todayActiveBookings.reduce((sum, b) => sum + (b.passengers?.length || 0), 0)
  const todayCheckedIn = todayActiveBookings.reduce(
    (sum, b) => sum + (b.passengers?.filter((p) => p.checkedIn)?.length || 0),
    0,
  )
  const todayDue = todayActiveBookings.reduce((sum, b) => sum + getBookingBalance(b), 0)

  let pendingDuesCount = 0
  let pendingDuesAmount = 0
  let activeRevenue = 0
  let totalTravelers = 0

  activeBookings.forEach((b) => {
    activeRevenue += Number(b.totalAmount) || 0
    totalTravelers += b.passengers?.length || 0
    const due = getBookingBalance(b)
    if (due > 0 && !b.isPaid) {
      pendingDuesCount += 1
      pendingDuesAmount += due
    }
  })

  const unassignedSeatBookings = activeBookings.filter((b) =>
    (b.passengers || []).some((p) => !p.seatId),
  )
  const unassignedPaxTotal = unassignedSeatBookings.reduce(
    (sum, b) => sum + (b.passengers || []).filter((p) => !p.seatId).length,
    0,
  )

  return {
    todayStr,
    todayDeparturesCount: todayActiveBookings.length,
    todayTours,
    todayPax,
    todayCheckedIn,
    todayDue,
    activeBookingsCount: activeBookings.length,
    activeRevenue,
    totalTravelers,
    destinationsCount: tours.length,
    pendingDuesCount,
    pendingDuesAmount,
    unassignedSeatBookings,
    unassignedPaxTotal,
  }
}

/**
 * Groups upcoming departures within `daysAhead` days (inclusive) by tourName + journeyDate.
 * Enriches each group with busType, capacity, occupancyPct, boardedCount, and pendingDue.
 * @param {Array<Object>} bookings
 * @param {Array<Object>} [tours]
 * @param {Date} [now]
 * @param {number} [daysAhead]
 */
export function groupUpcomingDepartures(bookings = [], tours = [], now = new Date(), daysAhead = 7) {
  const todayStr = toDateInputValue(now)
  const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
  const endStr = toDateInputValue(endDate)

  const tourByName = new Map()
  ;(tours || []).forEach((t) => {
    if (t?.name) tourByName.set(t.name, t)
  })

  const groups = new Map()

  bookings.forEach((b) => {
    if (isBookingCancelled(b)) return
    const dateKey = toDateInputValue(b.journeyDate)
    if (!dateKey || dateKey < todayStr || dateKey > endStr) return

    const key = `${b.tourName || "Unnamed Tour"}__${dateKey}`
    if (!groups.has(key)) {
      const matchedTour = tourByName.get(b.tourName)
      const busType = b.busType || matchedTour?.busType || "2x1 Sleeper Luxury"
      const capacity = getBusCapacity(busType)
      groups.set(key, {
        key,
        tourName: b.tourName || "Unnamed Tour",
        journeyDate: b.journeyDate,
        dateKey,
        busType,
        capacity,
        pax: 0,
        seatedCount: 0,
        boardedCount: 0,
        pendingDue: 0,
        bookingsCount: 0,
      })
    }

    const g = groups.get(key)
    const paxList = Array.isArray(b.passengers) ? b.passengers : []
    g.pax += paxList.length
    g.seatedCount += paxList.filter((p) => Boolean(p.seatId)).length
    g.boardedCount += paxList.filter((p) => Boolean(p.checkedIn)).length
    if (!b.isPaid) {
      g.pendingDue += getBookingBalance(b)
    }
    g.bookingsCount += 1
  })

  return Array.from(groups.values())
    .map((g) => ({
      ...g,
      occupancyPct: calculateOccupancyPercent(g.pax, g.capacity),
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.tourName.localeCompare(b.tourName))
}

/**
 * Filters recent bookings by status chip and optional local search text.
 * Intended to run on top of Dashboard's `filteredBookings` so the shell top-bar global search
 * and local overview filter compose cleanly.
 * @param {Array<Object>} bookings
 * @param {{ statusFilter?: "all" | "paid" | "pending" | "cancelled", localSearch?: string }} [options]
 */
export function filterRecentBookings(
  bookings = [],
  { statusFilter = "all", localSearch = "" } = {},
) {
  const q = (localSearch || "").toLowerCase().trim()

  return bookings.filter((b) => {
    const isCancelled = isBookingCancelled(b)
    const balance = getBookingBalance(b)
    const isPaid = !isCancelled && (b.isPaid || balance === 0)
    const isPending = !isCancelled && !isPaid

    if (statusFilter === "paid" && !isPaid) return false
    if (statusFilter === "pending" && !isPending) return false
    if (statusFilter === "cancelled" && !isCancelled) return false

    if (q) {
      const matchesInvoice = b.invoiceNo?.toLowerCase().includes(q)
      const matchesName = b.contactName?.toLowerCase().includes(q)
      const matchesPhone = b.contactPhone?.toLowerCase().includes(q)
      const matchesTour = b.tourName?.toLowerCase().includes(q)
      if (!matchesInvoice && !matchesName && !matchesPhone && !matchesTour) {
        return false
      }
    }

    return true
  })
}

/**
 * Classifies pending-payment urgency into clear text, icon key, and semantic badge variant.
 * Keeps the existing <3 days (red/urgent) and 3-10 days (yellow/follow-up) buckets while
 * explicitly distinguishing overdue (<0 days) and due on boarding (0-2 days).
 * @param {number} daysUntilJourney
 * @returns {{
 *   bucket: "red" | "yellow" | "green",
 *   variant: "danger" | "warning" | "info",
 *   iconName: "AlertCircle" | "Clock" | "CalendarClock",
 *   label: string,
 *   countdownLabel: string,
 * }}
 */
export function getPaymentUrgencyMeta(daysUntilJourney) {
  const days = Number.isFinite(Number(daysUntilJourney)) ? Number(daysUntilJourney) : 0

  if (days < 0) {
    const overdueDays = Math.abs(days)
    return {
      bucket: "red",
      variant: "danger",
      iconName: "AlertCircle",
      label: "Overdue",
      countdownLabel: overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`,
    }
  }
  if (days === 0) {
    return {
      bucket: "red",
      variant: "danger",
      iconName: "AlertCircle",
      label: "Due on boarding",
      countdownLabel: "Departing today",
    }
  }
  if (days < 3) {
    return {
      bucket: "red",
      variant: "danger",
      iconName: "AlertCircle",
      label: "Due on boarding",
      countdownLabel: days === 1 ? "In 1 day" : `In ${days} days`,
    }
  }
  if (days < 10) {
    return {
      bucket: "yellow",
      variant: "warning",
      iconName: "Clock",
      label: "Due soon",
      countdownLabel: `In ${days} days`,
    }
  }
  return {
    bucket: "green",
    variant: "info",
    iconName: "CalendarClock",
    label: "Scheduled",
    countdownLabel: `In ${days} days`,
  }
}
