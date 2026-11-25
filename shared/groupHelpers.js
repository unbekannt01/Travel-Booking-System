/**
 * YatraHub - Shared Group Booking Helpers
 *
 * Single source of truth for group booking detection and metadata.
 * A booking is treated as a group booking if:
 * 1. It belongs to an explicit BookingGroup (b.groupId is set), OR
 * 2. It has more than 1 passenger (b.passengers.length > 1).
 *
 * A booking with exactly 1 passenger and no groupId stays a normal single booking.
 */

/**
 * Returns true if the booking is treated as a group booking.
 * @param {Object} booking
 * @returns {boolean}
 */
export function isGroupBooking(booking) {
  if (!booking || typeof booking !== "object") return false
  if (booking.groupId) return true
  if (Array.isArray(booking.passengers) && booking.passengers.length > 1) return true
  return false
}

/**
 * Returns standardized group information for a booking.
 * @param {Object} booking
 * @returns {{
 *   isGroup: boolean,
 *   groupId: string|null,
 *   groupName: string,
 *   paxCount: number,
 *   isMultiPaxBooking: boolean
 * }}
 */
export function getGroupInfo(booking) {
  if (!isGroupBooking(booking)) {
    const count = (booking?.passengers && Array.isArray(booking.passengers)) ? booking.passengers.length : 1
    return {
      isGroup: false,
      groupId: null,
      groupName: "",
      paxCount: count,
      isMultiPaxBooking: false,
    }
  }

  const pax = Array.isArray(booking?.passengers) ? booking.passengers : []
  const count = pax.length || 1
  const leadName = pax[0]?.name || booking?.contactName || "Traveler"
  const defaultGroupName = count > 1 ? `${leadName} + ${count - 1}` : leadName

  const groupName =
    booking?.groupName?.trim() ||
    booking?.group?.name?.trim() ||
    defaultGroupName

  const isMultiPaxBooking = Boolean(!booking?.groupId && count > 1)
  const groupId = booking?.groupId ? String(booking.groupId) : isMultiPaxBooking ? `booking-group-${booking?._id || booking?.invoiceNo}` : null

  return {
    isGroup: true,
    groupId,
    groupName,
    paxCount: count,
    isMultiPaxBooking,
  }
}

/**
 * Calculate total passengers and total groups for a departure's bookings.
 * Counts each unique explicit groupId once, and each standalone 2+ passenger booking once.
 *
 * @param {Array<Object>} bookings
 * @returns {{ totalPax: number, groupCount: number, singleCount: number }}
 */
export function calculateDepartureGroupStats(bookings = []) {
  let totalPax = 0
  const countedGroupIds = new Set()
  let groupCount = 0
  let singleCount = 0

  for (const b of bookings) {
    if (b.status === "Cancelled" || b.status === "cancelled" || b.deletedAt) continue
    const paxList = Array.isArray(b.passengers) ? b.passengers : []
    const count = Math.max(1, paxList.length)
    totalPax += count

    if (b.groupId) {
      const gIdStr = String(b.groupId)
      if (!countedGroupIds.has(gIdStr)) {
        countedGroupIds.add(gIdStr)
        groupCount++
      }
    } else if (count > 1) {
      groupCount++
    } else {
      singleCount++
    }
  }

  return {
    totalPax,
    groupCount,
    singleCount,
  }
}
