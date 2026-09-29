/**
 * Auto-assigns free seats to passengers based on deck preference and coach layout.
 *
 * @param {Object} params
 * @param {Array} params.passengers - List of passengers in the booking
 * @param {Array} params.bookedSeats - List of already occupied/blocked seats [{ seatId }]
 * @param {string} [params.deckPreference='any'] - 'any' | 'lower' | 'upper'
 * @param {string} [params.layout='2x1'] - '2x1' | '2x2'
 * @returns {Object} { assignments: [{ passengerIndex, passengerName, proposedSeatId }], unassignedCount: number, allAvailable: string[] }
 */
export function autoAssignSeats({
  passengers = [],
  bookedSeats = [],
  deckPreference = "any",
  layout = "2x1",
}) {
  const is2x2 = layout.startsWith("2x2")
  const occupied = new Set(bookedSeats.map((b) => b.seatId).filter(Boolean))

  // Also include seats already assigned to passengers in this booking
  passengers.forEach((p) => {
    if (p.seatId) occupied.add(p.seatId)
  })

  // Generate candidate seats in logical proximity order
  const generateDeckSeats = (deck) => {
    const list = []
    if (is2x2) {
      // 5 rows, L1-1, L1-2, R1-1, R1-2
      for (let r = 1; r <= 5; r++) {
        list.push(`${deck}-L${r}-1`, `${deck}-L${r}-2`, `${deck}-R${r}-1`, `${deck}-R${r}-2`)
      }
    } else {
      // 2x1 layout: 6 rows, R-1, R-2 (couples/pairs), then L (single)
      for (let r = 1; r <= 6; r++) {
        list.push(`${deck}-R${r}-1`, `${deck}-R${r}-2`, `${deck}-L${r}`)
      }
    }
    return list
  }

  let seatOrder = []
  if (deckPreference === "lower") {
    seatOrder = [...generateDeckSeats("lower"), ...generateDeckSeats("upper")]
  } else if (deckPreference === "upper") {
    seatOrder = [...generateDeckSeats("upper"), ...generateDeckSeats("lower")]
  } else {
    // any: prioritize lower deck first, then upper
    seatOrder = [...generateDeckSeats("lower"), ...generateDeckSeats("upper")]
  }

  const availableSeats = seatOrder.filter((seatId) => !occupied.has(seatId))

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
