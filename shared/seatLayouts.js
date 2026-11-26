/**
 * Pure ESM Bus Seat Layouts and Definitions (Part 6S-2b)
 *
 * Configurable bus seat layouts for YatraHub based on owner reference design.
 * Zero external dependencies, pure ESM, safe for backend and frontend.
 *
 * Final Supported Bus Layouts:
 * 1. sleeper-2x1-38: 2x1 sleeper, 38 berths (6 main rows + 2 rear seats B1, B2)
 * 2. sleeper-2x2-48: 2x2 sleeper, 48 berths (6 rows x 4 berth boxes x 2 seats)
 * 3. sleeper-2x2-40: 2x2 sleeper, 40 berths (5 rows x 4 berth boxes x 2 seats)
 * 4. seater-2x3-60: 2+3 seater, 60 seats (12 rows x 5 seats, numbered 1..60)
 *
 * Final Canonical Seat ID Convention:
 * - Sleeper Main:
 *   Left Lower:  left-L{row}-{slot}   (e.g. left-L1-1, left-L1-2)
 *   Left Upper:  left-U{row}-{slot}   (e.g. left-U1-1, left-U1-2)
 *   Right Lower: right-L{row}-{slot}  (e.g. right-L1-1, right-L1-2)
 *   Right Upper: right-U{row}-{slot}  (e.g. right-U1-1, right-U1-2)
 * - Sleeper Rear (2x1 only):
 *   rear-B1 (Rear B1)
 *   rear-B2 (Rear B2)
 * - Seater:
 *   seat-1 .. seat-60 (Display: "Seat 1" .. "Seat 60")
 *
 * Seat Numbering Rule (1..N):
 * - Generated row-by-row from front to back:
 *   1. Left Lower seats (1, 2)
 *   2. Left Upper seats (1, 2)
 *   3. Right Lower seats (1, 2)
 *   4. Right Upper seats (1, 2)
 * - Followed by Rear seats: Rear B1, Rear B2.
 */

/*
 * ---------------------------------------------------------------------------------------------------------------------
 * LEGACY TO CANONICAL SEAT ID MAPPING TABLE (resolveSeatId)
 * ---------------------------------------------------------------------------------------------------------------------
 * Raw Format Example             | Layout Context        | Meaning / Logic                          | Canonical ID Target
 * ---------------------------------------------------------------------------------------------------------------------
 * left-L1-1, right-U3-2, rear-B1 | Any Sleeper           | Already canonical new format             | Match verbatim
 * seat-12, 12                    | Seater 60             | Canonical seat ID or numeric seat index  | seat-12
 * lower-L2-1, upper-R3-2 (OLD)   | 2x2 Sleeper (40/48)   | Direct deck+side+row+slot notation       | left-L2-1, right-U3-2
 * lower-L1, upper-R3 (6S-1)      | 2x2 Sleeper (40/48)   | Cabin index n without -slot:             | n=1 -> left-L1-1
 *                                |                       | row=ceil(n/2), slot=((n-1)%2)+1          | n=3 -> left-L2-1
 * lower-L1, upper-L3 (OLD/6S-1)  | 2x1 Sleeper (38)      | Single left berth                        | left-L1-1, left-U3-1
 * lower-R1-1, upper-R2-2 (OLD)   | 2x1 Sleeper (38)      | Right double berths                      | right-L1-1, right-U2-2
 * lower-L7, upper-L7 (6S-1 guess)| 2x1 Sleeper (38)      | 6S-1 guessed rear cabin                  | rear-B1, rear-B2
 * lower-L1-1, upper-L1-1 (OLD)   | 2x1 Sleeper (38)      | Single left berth with redundant -1      | left-L1-1, left-U1-1
 * L2-1, U3-1                     | 2x1 Sleeper (38)      | Shorthand side-box-slot (e.g. from scan) | left-L2-1, left-U3-1
 * R2-1, R2-2                     | 2x1 Sleeper (38)      | Shorthand right double berth             | right-L2-1, right-L2-2
 * 1L, 2L, 1U                     | 2x1 Sleeper (38)      | Old desktop shorthand                    | left-L1-1, left-L2-1, left-U1-1
 * 1..N (numeric)                 | Any Layout            | Matches seat.number                      | seat with seat.number == N
 * ---------------------------------------------------------------------------------------------------------------------
 */

function buildSleeper2x1_38() {
  const seats = []
  let seatNumber = 1

  // 6 main rows: Left boxes hold 1 seat; Right boxes hold 2 seats
  for (let r = 1; r <= 6; r++) {
    // 1. Left Lower (1 seat)
    seats.push({
      id: `left-L${r}-1`,
      name: `Left L${r}-1`,
      number: seatNumber++,
      side: "left",
      deck: "lower",
      row: r,
      col: 1,
      box: `L${r}`,
      slot: 1,
      section: "main",
      kind: null,
      pairId: null,
    })

    // 2. Left Upper (1 seat)
    seats.push({
      id: `left-U${r}-1`,
      name: `Left U${r}-1`,
      number: seatNumber++,
      side: "left",
      deck: "upper",
      row: r,
      col: 2,
      box: `U${r}`,
      slot: 1,
      section: "main",
      kind: null,
      pairId: null,
    })

    // 3. Right Lower (2 seats: slot 1, slot 2)
    seats.push({
      id: `right-L${r}-1`,
      name: `Right L${r}-1`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 3,
      box: `L${r}`,
      slot: 1,
      section: "main",
      kind: null,
      pairId: `right-L${r}-2`,
    })
    seats.push({
      id: `right-L${r}-2`,
      name: `Right L${r}-2`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 3,
      box: `L${r}`,
      slot: 2,
      section: "main",
      kind: null,
      pairId: `right-L${r}-1`,
    })

    // 4. Right Upper (2 seats: slot 1, slot 2)
    seats.push({
      id: `right-U${r}-1`,
      name: `Right U${r}-1`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 4,
      box: `U${r}`,
      slot: 1,
      section: "main",
      kind: null,
      pairId: `right-U${r}-2`,
    })
    seats.push({
      id: `right-U${r}-2`,
      name: `Right U${r}-2`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 4,
      box: `U${r}`,
      slot: 2,
      section: "main",
      kind: null,
      pairId: `right-U${r}-1`,
    })
  }

  // Rear section: two wide boxes B1 and B2, each with one seat
  seats.push({
    id: `rear-B1`,
    name: `Rear B1`,
    number: seatNumber++,
    side: "rear",
    deck: "lower",
    row: 7,
    col: 1,
    box: `B1`,
    slot: 1,
    section: "rear",
    kind: null,
    pairId: null,
  })
  seats.push({
    id: `rear-B2`,
    name: `Rear B2`,
    number: seatNumber++,
    side: "rear",
    deck: "upper",
    row: 7,
    col: 2,
    box: `B2`,
    slot: 1,
    section: "rear",
    kind: null,
    pairId: null,
  })

  return {
    key: "sleeper-2x1-38",
    label: "2x1 Sleeper Luxury (38 berths)",
    shortLabel: "2x1 Sleeper 38",
    category: "sleeper",
    totalSeats: 38,
    grid: {
      decks: ["lower", "upper"],
      rows: 6,
      cols: 4,
      aisleCol: 2,
      hasRear: true,
    },
    seats: Object.freeze(seats),
  }
}

function buildSleeper2x2(rows, key, label, shortLabel) {
  const seats = []
  let seatNumber = 1

  // Rows from front to back
  for (let r = 1; r <= rows; r++) {
    // 1. Left Lower (2 seats: slot 1, slot 2)
    seats.push({
      id: `left-L${r}-1`,
      name: `Left L${r}-1`,
      number: seatNumber++,
      side: "left",
      deck: "lower",
      row: r,
      col: 1,
      box: `L${r}`,
      slot: 1,
      section: "main",
      kind: null,
      pairId: `left-L${r}-2`,
    })
    seats.push({
      id: `left-L${r}-2`,
      name: `Left L${r}-2`,
      number: seatNumber++,
      side: "left",
      deck: "lower",
      row: r,
      col: 1,
      box: `L${r}`,
      slot: 2,
      section: "main",
      kind: null,
      pairId: `left-L${r}-1`,
    })

    // 2. Left Upper (2 seats: slot 1, slot 2)
    seats.push({
      id: `left-U${r}-1`,
      name: `Left U${r}-1`,
      number: seatNumber++,
      side: "left",
      deck: "upper",
      row: r,
      col: 2,
      box: `U${r}`,
      slot: 1,
      section: "main",
      kind: null,
      pairId: `left-U${r}-2`,
    })
    seats.push({
      id: `left-U${r}-2`,
      name: `Left U${r}-2`,
      number: seatNumber++,
      side: "left",
      deck: "upper",
      row: r,
      col: 2,
      box: `U${r}`,
      slot: 2,
      section: "main",
      kind: null,
      pairId: `left-U${r}-1`,
    })

    // 3. Right Lower (2 seats: slot 1, slot 2)
    seats.push({
      id: `right-L${r}-1`,
      name: `Right L${r}-1`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 3,
      box: `L${r}`,
      slot: 1,
      section: "main",
      kind: null,
      pairId: `right-L${r}-2`,
    })
    seats.push({
      id: `right-L${r}-2`,
      name: `Right L${r}-2`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 3,
      box: `L${r}`,
      slot: 2,
      section: "main",
      kind: null,
      pairId: `right-L${r}-1`,
    })

    // 4. Right Upper (2 seats: slot 1, slot 2)
    seats.push({
      id: `right-U${r}-1`,
      name: `Right U${r}-1`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 4,
      box: `U${r}`,
      slot: 1,
      section: "main",
      kind: null,
      pairId: `right-U${r}-2`,
    })
    seats.push({
      id: `right-U${r}-2`,
      name: `Right U${r}-2`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 4,
      box: `U${r}`,
      slot: 2,
      section: "main",
      kind: null,
      pairId: `right-U${r}-1`,
    })
  }

  return {
    key,
    label,
    shortLabel,
    category: "sleeper",
    totalSeats: rows * 8,
    grid: {
      decks: ["lower", "upper"],
      rows,
      cols: 4,
      aisleCol: 2,
      hasRear: false,
    },
    seats: Object.freeze(seats),
  }
}

function buildSeater2x3_60() {
  const seats = []
  let seatNumber = 1

  // 12 rows, 5 seats per row (2 Left + 3 Right, central aisle)
  // Numbered row-by-row, left-to-right 1..60
  for (let r = 1; r <= 12; r++) {
    // Col 1: Left Window
    const s1 = seatNumber++
    seats.push({
      id: `seat-${s1}`,
      name: `Seat ${s1}`,
      number: s1,
      side: "left",
      deck: "main",
      row: r,
      col: 1,
      box: `Row ${r}`,
      slot: 1,
      section: "main",
      kind: null,
      pairId: `seat-${s1 + 1}`,
    })
    // Col 2: Left Aisle
    const s2 = seatNumber++
    seats.push({
      id: `seat-${s2}`,
      name: `Seat ${s2}`,
      number: s2,
      side: "left",
      deck: "main",
      row: r,
      col: 2,
      box: `Row ${r}`,
      slot: 2,
      section: "main",
      kind: null,
      pairId: `seat-${s1}`,
    })
    // Col 4: Right Aisle
    const s3 = seatNumber++
    seats.push({
      id: `seat-${s3}`,
      name: `Seat ${s3}`,
      number: s3,
      side: "right",
      deck: "main",
      row: r,
      col: 4,
      box: `Row ${r}`,
      slot: 3,
      section: "main",
      kind: null,
      pairId: null,
    })
    // Col 5: Right Middle
    const s4 = seatNumber++
    seats.push({
      id: `seat-${s4}`,
      name: `Seat ${s4}`,
      number: s4,
      side: "right",
      deck: "main",
      row: r,
      col: 5,
      box: `Row ${r}`,
      slot: 4,
      section: "main",
      kind: null,
      pairId: null,
    })
    // Col 6: Right Window
    const s5 = seatNumber++
    seats.push({
      id: `seat-${s5}`,
      name: `Seat ${s5}`,
      number: s5,
      side: "right",
      deck: "main",
      row: r,
      col: 6,
      box: `Row ${r}`,
      slot: 5,
      section: "main",
      kind: null,
      pairId: null,
    })
  }

  return {
    key: "seater-2x3-60",
    label: "2+3 Seater (60 Seats)",
    shortLabel: "2+3 Seater 60",
    category: "seater",
    totalSeats: 60,
    grid: {
      decks: ["main"],
      rows: 12,
      cols: 6,
      aisleCol: 3,
      hasRear: false,
    },
    seats: Object.freeze(seats),
  }
}

// Validate seat layout definition constraints
export function validateSeatLayoutDefinition(layout) {
  if (!layout || !Array.isArray(layout.seats)) {
    throw new Error(`Invalid layout definition: missing seats array`)
  }
  if (layout.seats.length !== layout.totalSeats) {
    throw new Error(
      `Layout ${layout.key} count mismatch: expected ${layout.totalSeats}, got ${layout.seats.length}`,
    )
  }
  const idSet = new Set()
  const numSet = new Set()
  for (const s of layout.seats) {
    if (!s.id || typeof s.id !== "string") {
      throw new Error(`Layout ${layout.key} has invalid seat id: ${JSON.stringify(s)}`)
    }
    if (idSet.has(s.id)) {
      throw new Error(`Layout ${layout.key} has duplicate seat id: ${s.id}`)
    }
    idSet.add(s.id)

    if (typeof s.number !== "number" || s.number < 1 || s.number > layout.totalSeats) {
      throw new Error(`Layout ${layout.key} has invalid seat number: ${s.number}`)
    }
    if (numSet.has(s.number)) {
      throw new Error(`Layout ${layout.key} has duplicate seat number: ${s.number}`)
    }
    numSet.add(s.number)
  }
  return true
}

const layoutSleeper2x1_38 = buildSleeper2x1_38()
const layoutSleeper2x2_48 = buildSleeper2x2(6, "sleeper-2x2-48", "2x2 Sleeper Luxury (48 berths)", "2x2 Sleeper 48")
const layoutSleeper2x2_40 = buildSleeper2x2(5, "sleeper-2x2-40", "2x2 Sleeper Standard (40 berths)", "2x2 Sleeper 40")
const layoutSeater2x3_60 = buildSeater2x3_60()

validateSeatLayoutDefinition(layoutSleeper2x1_38)
validateSeatLayoutDefinition(layoutSleeper2x2_48)
validateSeatLayoutDefinition(layoutSleeper2x2_40)
validateSeatLayoutDefinition(layoutSeater2x3_60)

export const SEAT_LAYOUTS = Object.freeze({
  "sleeper-2x1-38": Object.freeze(layoutSleeper2x1_38),
  "sleeper-2x2-48": Object.freeze(layoutSleeper2x2_48),
  "sleeper-2x2-40": Object.freeze(layoutSleeper2x2_40),
  "seater-2x3-60": Object.freeze(layoutSeater2x3_60),
})

export const DEFAULT_LAYOUT_KEY = "sleeper-2x1-38"

export const STANDARD_BUS_TYPES = Object.freeze([
  "2x1 Sleeper Luxury (38 berths)",
  "2x2 Sleeper Luxury (48 berths)",
  "2x2 Sleeper Standard (40 berths)",
  "2x3 Seater Express (60 seats)",
])

export const LEGACY_BUS_TYPES = Object.freeze([
  "2x1 Sleeper Luxury",
  "2x2 Sleeper Luxury",
  "2x1 Sleeper Luxury (36 berths)",
  "2x2 Sleeper Luxury (40 berths)",
  "2x1",
  "2x2",
  "2x1 Sleeper",
  "2x2 Sleeper",
  "2x2 Semi-Sleeper",
  "2x1 Luxury Sleeper",
  "2x2 Luxury Sleeper",
  "2x1 Luxury AC Sleeper",
  "AC Sleeper 2+1",
  "2+3 Seater (60 Seats)",
  "2+3 Seater",
  "2x3 Seater Express",
  "BharatBenz 2+1 AC Sleeper Coach (GJ-03-BX-9988)",
])

export const ALLOWED_BUS_TYPES = Object.freeze([
  ...STANDARD_BUS_TYPES,
  ...LEGACY_BUS_TYPES,
])

/**
 * Validates whether a busType string is recognized (standard or legacy).
 * @param {string|null|undefined} busType
 * @returns {boolean}
 */
export function isValidBusType(busType) {
  if (!busType || typeof busType !== "string") return false
  const trimmed = busType.trim()
  if (!trimmed) return false
  return ALLOWED_BUS_TYPES.some((allowed) => allowed.toLowerCase() === trimmed.toLowerCase())
}

/**
 * Normalizes a busType to its exact canonical string in ALLOWED_BUS_TYPES if matched.
 * @param {string|null|undefined} busType
 * @returns {string|null}
 */
export function normalizeBusType(busType) {
  if (!busType || typeof busType !== "string") return null
  const trimmed = busType.trim()
  const matched = ALLOWED_BUS_TYPES.find((allowed) => allowed.toLowerCase() === trimmed.toLowerCase())
  return matched || trimmed
}

/**
 * Returns layout definition for a given key.
 * @param {string} key
 * @returns {object|null}
 */
export function getSeatLayout(key) {
  if (!key || typeof key !== "string") return null
  return SEAT_LAYOUTS[key] || null
}

/**
 * Resolves appropriate layout key for any busType string.
 * Backward compatible with existing strings like "2x1", "2x2", "2x1 Sleeper Luxury", etc.
 *
 * @param {string|null|undefined} busType
 * @returns {string}
 */
export function layoutKeyForBusType(busType) {
  if (!busType || typeof busType !== "string") return DEFAULT_LAYOUT_KEY
  const normalized = busType.trim().toLowerCase()

  if (normalized.includes("60") || normalized.includes("2+3") || normalized.includes("seater")) {
    return "seater-2x3-60"
  }
  if (normalized.includes("48")) {
    return "sleeper-2x2-48"
  }
  if (normalized.includes("40")) {
    return "sleeper-2x2-40"
  }
  if (normalized.startsWith("2x2")) {
    return "sleeper-2x2-40"
  }
  if (normalized.includes("38") || normalized.startsWith("2x1") || normalized.includes("sleeper")) {
    return "sleeper-2x1-38"
  }

  // Safe fallback to default
  return DEFAULT_LAYOUT_KEY
}

/**
 * Normalizes and resolves any raw/historical seat ID into the canonical ID
 * of the target layout.
 *
 * @param {string} layoutKey
 * @param {string|number} rawId
 * @returns {string} canonical seatId or trimmed rawId if unrecognized
 */
export function resolveSeatId(layoutKey, rawId) {
  if (rawId === undefined || rawId === null) return ""
  const str = String(rawId).trim()
  if (!str) return ""

  const layout = getSeatLayout(layoutKey) || SEAT_LAYOUTS[DEFAULT_LAYOUT_KEY]
  if (!layout) return str

  // 1. Direct match with canonical id in layout (case-insensitive)
  const canonicalMatch = layout.seats.find(
    (s) => s.id.toLowerCase() === str.toLowerCase(),
  )
  if (canonicalMatch) return canonicalMatch.id

  const is2x1 = layout.key === "sleeper-2x1-38"
  const is2x2 = layout.key === "sleeper-2x2-48" || layout.key === "sleeper-2x2-40"
  const isSeater = layout.key === "seater-2x3-60"

  // 2. Seater format: numbers or "Seat N" or "seat-N"
  if (isSeater) {
    const numMatch = str.match(/(?:seat\s*|s)?(\d+)/i)
    if (numMatch) {
      const n = parseInt(numMatch[1], 10)
      const cand = `seat-${n}`
      if (layout.seats.some((s) => s.id === cand)) return cand
    }
  }

  // 3. Numeric match (e.g. 1..N index matching seat.number)
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10)
    const numMatch = layout.seats.find((s) => s.number === num)
    if (numMatch) return numMatch.id
  }

  // 4. OLD 2x2 format WITH slot suffix: lower-L{row}-{slot} / upper-R{row}-{slot}
  // Maps directly: lower-L2-1 -> left-L2-1, upper-R3-2 -> right-U3-2
  const oldSlotMatch = str.match(/^(lower|upper)-([LR])(\d+)-([12])$/i)
  if (oldSlotMatch) {
    const deckLetter = oldSlotMatch[1].toUpperCase() === "LOWER" ? "L" : "U"
    const side = oldSlotMatch[2].toUpperCase() === "L" ? "left" : "right"
    const row = oldSlotMatch[3]
    const slot = oldSlotMatch[4]
    const candidate = `${side}-${deckLetter}${row}-${slot}`
    if (layout.seats.some((s) => s.id === candidate)) return candidate
  }

  // 5. 6S-1 2x2 format WITHOUT slot suffix: lower-L{n} / upper-R{n} (n = cabin 1..12)
  // Rule: cabin n -> row ceil(n/2), slot ((n-1)%2)+1
  const s1_2x2Match = str.match(/^(lower|upper)-([LR])(\d+)$/i)
  if (s1_2x2Match && is2x2) {
    const deckLetter = s1_2x2Match[1].toUpperCase() === "LOWER" ? "L" : "U"
    const side = s1_2x2Match[2].toUpperCase() === "L" ? "left" : "right"
    const n = parseInt(s1_2x2Match[3], 10)
    const row = Math.ceil(n / 2)
    const slot = ((n - 1) % 2) + 1
    const candidate = `${side}-${deckLetter}${row}-${slot}`
    if (layout.seats.some((s) => s.id === candidate)) return candidate
  }

  // 6. 2x1 formats
  if (is2x1) {
    // 6S-1 guessed rear cabin: lower-L7 -> rear-B1, upper-L7 -> rear-B2
    if (/^lower-L7$/i.test(str)) return "rear-B1"
    if (/^upper-L7$/i.test(str)) return "rear-B2"

    // Single Left berth: lower-L{r} -> left-L{r}-1, upper-L{r} -> left-U{r}-1
    const leftSingle = str.match(/^(lower|upper)-L(\d+)$/i)
    if (leftSingle) {
      const deckLetter = leftSingle[1].toUpperCase() === "LOWER" ? "L" : "U"
      const row = leftSingle[2]
      const candidate = `left-${deckLetter}${row}-1`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }

    // Right double berths: lower-R{r}-{slot} -> right-L{r}-{slot}, upper-R{r}-{slot} -> right-U{r}-{slot}
    const rightDouble = str.match(/^(lower|upper)-R(\d+)-([12])$/i)
    if (rightDouble) {
      const deckLetter = rightDouble[1].toUpperCase() === "LOWER" ? "L" : "U"
      const row = rightDouble[2]
      const slot = rightDouble[3]
      const candidate = `right-${deckLetter}${row}-${slot}`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }

    // Redundant slot on left: lower-L{r}-1 -> left-L{r}-1, upper-L{r}-1 -> left-U{r}-1
    const leftRedundant = str.match(/^(lower|upper)-L(\d+)-1$/i)
    if (leftRedundant) {
      const deckLetter = leftRedundant[1].toUpperCase() === "LOWER" ? "L" : "U"
      const row = leftRedundant[2]
      const candidate = `left-${deckLetter}${row}-1`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }

    // Shorthand from DB scan: "L2-1" or "U3-1" (without lower/upper deck prefix)
    const shortSlot = str.match(/^([LU])(\d+)-([12])$/i)
    if (shortSlot) {
      const deckLetter = shortSlot[1].toUpperCase()
      const row = shortSlot[2]
      const slot = shortSlot[3]
      const candidate = `left-${deckLetter}${row}-${slot}`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }

    // Shorthand: "1L", "2L", "1U"
    const numDeck = str.match(/^(\d+)([LU])$/i)
    if (numDeck) {
      const row = numDeck[1]
      const deckLetter = numDeck[2].toUpperCase()
      const candidate = `left-${deckLetter}${row}-1`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }

    // Shorthand: "L1", "U2"
    const deckNum = str.match(/^([LU])(\d+)$/i)
    if (deckNum) {
      const deckLetter = deckNum[1].toUpperCase()
      const row = deckNum[2]
      const candidate = `left-${deckLetter}${row}-1`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }
  }

  // Return original trimmed string if no mapping matched
  return str
}

/**
 * Returns human-friendly display label for a seat in a layout.
 * e.g. "Left L1-1", "Right U3-2", "Rear B1", or "Seat 12"
 *
 * @param {string} layoutKey
 * @param {string|number} rawId
 * @returns {string}
 */
export function formatSeatDisplayName(layoutKey, rawId) {
  if (!rawId) return "Unassigned"
  const canonicalId = resolveSeatId(layoutKey, rawId)
  const layout = getSeatLayout(layoutKey) || SEAT_LAYOUTS[DEFAULT_LAYOUT_KEY]
  if (!layout) return String(rawId)

  const seat = layout.seats.find((s) => s.id.toLowerCase() === canonicalId.toLowerCase())
  if (seat) {
    return seat.name
  }

  // Graceful fallback for canonical-like shapes if layout lookup didn't match
  const match = canonicalId.match(/^(left|right)-([LU]\d+)-([12])$/i)
  if (match) {
    const side = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
    return `${side} ${match[2].toUpperCase()}-${match[3]}`
  }
  if (/^rear-B[12]$/i.test(canonicalId)) {
    return `Rear ${canonicalId.slice(-2).toUpperCase()}`
  }
  if (/^seat-\d+$/i.test(canonicalId)) {
    return `Seat ${canonicalId.slice(5)}`
  }

  return String(rawId)
}

/**
 * Formats a passenger name to show Last Name + First Name (e.g. "Ghetiya Bipinbhai").
 * Does NOT use the middle name.
 * e.g., "Ghetiya Bipinchandra Devrajbhai" -> "Ghetiya Bipinchandra"
 * e.g., "Hansaliya Sarojben Gandubhai"   -> "Hansaliya Sarojben"
 * e.g., "Ghetiya Bipinbhai"              -> "Ghetiya Bipinbhai"
 *
 * @param {string | null | undefined} fullName
 * @returns {string}
 */
export function formatShortPassengerName(fullName) {
  if (!fullName || typeof fullName !== "string") return ""
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] || ""
  return `${parts[0]} ${parts[1]}`
}

/**
 * Checks whether a given seat ID or seat label corresponds to an Upper berth.
 * @param {string|null|undefined} seatId
 * @returns {boolean}
 */
export function isUpperBerthSeat(seatId) {
  if (!seatId) return false
  const s = String(seatId).toLowerCase().trim()
  return (
    s.startsWith("upper") ||
    s.startsWith("u") ||
    s.includes("-u") ||
    /\bu\d+/i.test(s) ||
    s === "rear-b2" ||
    s === "b2"
  )
}

