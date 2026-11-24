import { getSeatLayout, layoutKeyForBusType, resolveSeatId, DEFAULT_LAYOUT_KEY } from "../../shared/seatLayouts.js"

/**
 * Auto-assigns free seats to passengers based on deck preference and coach layout.
 *
 * @param {Object} params
 * @param {Array} params.passengers - List of passengers in the booking
 * @param {Array} params.bookedSeats - List of already occupied/blocked seats [{ seatId }]
 * @param {string} [params.deckPreference='any'] - 'any' | 'lower' | 'upper'
 * @param {string} [params.layout='2x1'] - Layout key or bus type string
 * @returns {Object} { assignments: [{ passengerIndex, passengerName, proposedSeatId }], unassignedCount: number, allAvailable: string[] }
 */
export function autoAssignSeats({
  passengers = [],
  bookedSeats = [],
  deckPreference = "any",
  layout = "2x1",
}) {
  const layoutKey = layoutKeyForBusType(layout)
  const layoutDef = getSeatLayout(layoutKey) || getSeatLayout(DEFAULT_LAYOUT_KEY)

  const occupied = new Set(
    bookedSeats
      .map((b) => (b.seatId ? resolveSeatId(layoutKey, b.seatId) : null))
      .filter(Boolean),
  )

  // Also include seats already assigned to passengers in this booking
  passengers.forEach((p) => {
    if (p.seatId) {
      occupied.add(resolveSeatId(layoutKey, p.seatId))
    }
  })

  // Order candidate seats based on layout and deckPreference
  let seatList = [...layoutDef.seats]
  if (layoutDef.decks && layoutDef.decks.length > 1) {
    if (deckPreference === "lower") {
      seatList = [
        ...layoutDef.seats.filter((s) => s.deck === "lower"),
        ...layoutDef.seats.filter((s) => s.deck === "upper"),
      ]
    } else if (deckPreference === "upper") {
      seatList = [
        ...layoutDef.seats.filter((s) => s.deck === "upper"),
        ...layoutDef.seats.filter((s) => s.deck === "lower"),
      ]
    }
  }

  const availableSeats = seatList
    .map((s) => s.id)
    .filter((seatId) => !occupied.has(seatId))

  const assignments = []
  let availIdx = 0

  passengers.forEach((p, idx) => {
    if (!p.seatId) {
      if (availIdx < availableSeats.length) {
        const seat = availableSeats[availIdx++]
        assignments.push({
          passengerIndex: idx,
          passengerName: p.name || `Passenger ${idx + 1}`,
          proposedSeatId: seat,
        })
      }
    }
  })

  return {
    assignments,
    unassignedCount: passengers.filter((p) => !p.seatId).length - assignments.length,
    allAvailable: availableSeats,
  }
}
