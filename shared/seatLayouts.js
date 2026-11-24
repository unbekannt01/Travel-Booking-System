/**
 * Pure ESM Bus Seat Layouts and Definitions
 *
 * Configurable bus seat layouts for YatraHub.
 * Zero external dependencies, pure ESM, safe for backend and frontend.
 *
 * Supported Bus Layouts:
 * 1. sleeper-2x1-38: 2x1 sleeper, 38 seats (6 full rows of 3 + 2 extra berths in Row 7)
 * 2. sleeper-2x2-48: 2x2 sleeper, 48 seats (6 rows x 4 berths per deck: L1..L12, R1..R12)
 * 3. sleeper-2x2-40: 2x2 sleeper, 40 seats (5 rows x 4 berths per deck: L1..L10, R1..R10)
 * 4. seater-2x3-60: 2+3 seater, 60 seats (12 rows x 5 seats, numbered 1..60)
 */

function buildSleeper2x1_38() {
  const seats = []
  let seatNumber = 1

  // Lower Deck: 19 seats (Rows 1-6: Left 1 + Right 2; Row 7: Left 1)
  // Row 1-6: L1..L6 (col 1), R1-1 (col 3), R1-2 (col 4)
  for (let r = 1; r <= 6; r++) {
    // Left cabin L{r} (single berth)
    seats.push({
      id: `lower-L${r}`,
      name: `Left L${r} Lower`,
      number: seatNumber++,
      side: "left",
      deck: "lower",
      row: r,
      col: 1,
      cabin: `L${r}`,
      kind: null,
      pairId: null,
    })
    // Right cabin R{r} aisle
    seats.push({
      id: `lower-R${r}-1`,
      name: `Right R${r} Lower Aisle`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 3,
      cabin: `R${r}`,
      kind: null,
      pairId: `lower-R${r}-2`,
    })
    // Right cabin R{r} window
    seats.push({
      id: `lower-R${r}-2`,
      name: `Right R${r} Lower Window`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 4,
      cabin: `R${r}`,
      kind: null,
      pairId: `lower-R${r}-1`,
    })
  }

  // Row 7 Lower: extra berth Left L7 (back row)
  seats.push({
    id: `lower-L7`,
    name: `Left L7 Lower`,
    number: seatNumber++,
    side: "left",
    deck: "lower",
    row: 7,
    col: 1,
    cabin: `L7`,
    kind: null,
    pairId: null,
  })

  // Upper Deck: 19 seats (Rows 1-6: Left 1 + Right 2; Row 7: Left 1)
  for (let r = 1; r <= 6; r++) {
    // Left cabin L{r} (single berth)
    seats.push({
      id: `upper-L${r}`,
      name: `Left L${r} Upper`,
      number: seatNumber++,
      side: "left",
      deck: "upper",
      row: r,
      col: 1,
      cabin: `L${r}`,
      kind: null,
      pairId: null,
    })
    // Right cabin R{r} aisle
    seats.push({
      id: `upper-R${r}-1`,
      name: `Right R${r} Upper Aisle`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 3,
      cabin: `R${r}`,
      kind: null,
      pairId: `upper-R${r}-2`,
    })
    // Right cabin R{r} window
    seats.push({
      id: `upper-R${r}-2`,
      name: `Right R${r} Upper Window`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 4,
      cabin: `R${r}`,
      kind: null,
      pairId: `upper-R${r}-1`,
    })
  }

  // Row 7 Upper: extra berth Left L7 (back row)
  seats.push({
    id: `upper-L7`,
    name: `Left L7 Upper`,
    number: seatNumber++,
    side: "left",
    deck: "upper",
    row: 7,
    col: 1,
    cabin: `L7`,
    kind: null,
    pairId: null,
  })

  return {
    key: "sleeper-2x1-38",
    label: "2x1 Sleeper (38 Berths)",
    shortLabel: "2x1 Sleeper 38",
    category: "sleeper",
    totalSeats: 38,
    grid: {
      decks: ["lower", "upper"],
      rows: 7,
      cols: 4, // col 1: Left window, col 2: Aisle, col 3: Right aisle, col 4: Right window
      aisleCol: 2,
    },
    seats: Object.freeze(seats),
  }
}

function buildSleeper2x2_48() {
  const seats = []
  let seatNumber = 1

  // 6 rows, 4 berths per row per deck (2 Left + 2 Right)
  // Left cabins L1..L12 (2 per row), Right cabins R1..R12 (2 per row)
  // Lower deck: 24 berths (seats 1..24)
  for (let r = 1; r <= 6; r++) {
    const leftCabin1 = (r - 1) * 2 + 1
    const leftCabin2 = (r - 1) * 2 + 2
    const rightCabin1 = (r - 1) * 2 + 1
    const rightCabin2 = (r - 1) * 2 + 2

    // Col 1: Left Window
    seats.push({
      id: `lower-L${leftCabin1}`,
      name: `Left L${leftCabin1} Lower`,
      number: seatNumber++,
      side: "left",
      deck: "lower",
      row: r,
      col: 1,
      cabin: `L${leftCabin1}`,
      kind: null,
      pairId: `lower-L${leftCabin2}`,
    })
    // Col 2: Left Aisle
    seats.push({
      id: `lower-L${leftCabin2}`,
      name: `Left L${leftCabin2} Lower`,
      number: seatNumber++,
      side: "left",
      deck: "lower",
      row: r,
      col: 2,
      cabin: `L${leftCabin2}`,
      kind: null,
      pairId: `lower-L${leftCabin1}`,
    })
    // Col 4: Right Aisle
    seats.push({
      id: `lower-R${rightCabin1}`,
      name: `Right R${rightCabin1} Lower`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 4,
      cabin: `R${rightCabin1}`,
      kind: null,
      pairId: `lower-R${rightCabin2}`,
    })
    // Col 5: Right Window
    seats.push({
      id: `lower-R${rightCabin2}`,
      name: `Right R${rightCabin2} Lower`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 5,
      cabin: `R${rightCabin2}`,
      kind: null,
      pairId: `lower-R${rightCabin1}`,
    })
  }

  // Upper deck: 24 berths (seats 25..48)
  for (let r = 1; r <= 6; r++) {
    const leftCabin1 = (r - 1) * 2 + 1
    const leftCabin2 = (r - 1) * 2 + 2
    const rightCabin1 = (r - 1) * 2 + 1
    const rightCabin2 = (r - 1) * 2 + 2

    // Col 1: Left Window
    seats.push({
      id: `upper-L${leftCabin1}`,
      name: `Left L${leftCabin1} Upper`,
      number: seatNumber++,
      side: "left",
      deck: "upper",
      row: r,
      col: 1,
      cabin: `L${leftCabin1}`,
      kind: null,
      pairId: `upper-L${leftCabin2}`,
    })
    // Col 2: Left Aisle
    seats.push({
      id: `upper-L${leftCabin2}`,
      name: `Left L${leftCabin2} Upper`,
      number: seatNumber++,
      side: "left",
      deck: "upper",
      row: r,
      col: 2,
      cabin: `L${leftCabin2}`,
      kind: null,
      pairId: `upper-L${leftCabin1}`,
    })
    // Col 4: Right Aisle
    seats.push({
      id: `upper-R${rightCabin1}`,
      name: `Right R${rightCabin1} Upper`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 4,
      cabin: `R${rightCabin1}`,
      kind: null,
      pairId: `upper-R${rightCabin2}`,
    })
    // Col 5: Right Window
    seats.push({
      id: `upper-R${rightCabin2}`,
      name: `Right R${rightCabin2} Upper`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 5,
      cabin: `R${rightCabin2}`,
      kind: null,
      pairId: `upper-R${rightCabin1}`,
    })
  }

  return {
    key: "sleeper-2x2-48",
    label: "2x2 Sleeper (48 Berths)",
    shortLabel: "2x2 Sleeper 48",
    category: "sleeper",
    totalSeats: 48,
    grid: {
      decks: ["lower", "upper"],
      rows: 6,
      cols: 5, // col 1: Left window, col 2: Left aisle, col 3: Gangway, col 4: Right aisle, col 5: Right window
      aisleCol: 3,
    },
    seats: Object.freeze(seats),
  }
}

function buildSleeper2x2_40() {
  const seats = []
  let seatNumber = 1

  // 5 rows, 4 berths per row per deck (2 Left + 2 Right)
  // Left cabins L1..L10 (2 per row), Right cabins R1..R10 (2 per row)
  // Lower deck: 20 berths (seats 1..20)
  for (let r = 1; r <= 5; r++) {
    const leftCabin1 = (r - 1) * 2 + 1
    const leftCabin2 = (r - 1) * 2 + 2
    const rightCabin1 = (r - 1) * 2 + 1
    const rightCabin2 = (r - 1) * 2 + 2

    // Col 1: Left Window
    seats.push({
      id: `lower-L${leftCabin1}`,
      name: `Left L${leftCabin1} Lower`,
      number: seatNumber++,
      side: "left",
      deck: "lower",
      row: r,
      col: 1,
      cabin: `L${leftCabin1}`,
      kind: null,
      pairId: `lower-L${leftCabin2}`,
    })
    // Col 2: Left Aisle
    seats.push({
      id: `lower-L${leftCabin2}`,
      name: `Left L${leftCabin2} Lower`,
      number: seatNumber++,
      side: "left",
      deck: "lower",
      row: r,
      col: 2,
      cabin: `L${leftCabin2}`,
      kind: null,
      pairId: `lower-L${leftCabin1}`,
    })
    // Col 4: Right Aisle
    seats.push({
      id: `lower-R${rightCabin1}`,
      name: `Right R${rightCabin1} Lower`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 4,
      cabin: `R${rightCabin1}`,
      kind: null,
      pairId: `lower-R${rightCabin2}`,
    })
    // Col 5: Right Window
    seats.push({
      id: `lower-R${rightCabin2}`,
      name: `Right R${rightCabin2} Lower`,
      number: seatNumber++,
      side: "right",
      deck: "lower",
      row: r,
      col: 5,
      cabin: `R${rightCabin2}`,
      kind: null,
      pairId: `lower-R${rightCabin1}`,
    })
  }

  // Upper deck: 20 berths (seats 21..40)
  for (let r = 1; r <= 5; r++) {
    const leftCabin1 = (r - 1) * 2 + 1
    const leftCabin2 = (r - 1) * 2 + 2
    const rightCabin1 = (r - 1) * 2 + 1
    const rightCabin2 = (r - 1) * 2 + 2

    // Col 1: Left Window
    seats.push({
      id: `upper-L${leftCabin1}`,
      name: `Left L${leftCabin1} Upper`,
      number: seatNumber++,
      side: "left",
      deck: "upper",
      row: r,
      col: 1,
      cabin: `L${leftCabin1}`,
      kind: null,
      pairId: `upper-L${leftCabin2}`,
    })
    // Col 2: Left Aisle
    seats.push({
      id: `upper-L${leftCabin2}`,
      name: `Left L${leftCabin2} Upper`,
      number: seatNumber++,
      side: "left",
      deck: "upper",
      row: r,
      col: 2,
      cabin: `L${leftCabin2}`,
      kind: null,
      pairId: `upper-L${leftCabin1}`,
    })
    // Col 4: Right Aisle
    seats.push({
      id: `upper-R${rightCabin1}`,
      name: `Right R${rightCabin1} Upper`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 4,
      cabin: `R${rightCabin1}`,
      kind: null,
      pairId: `upper-R${rightCabin2}`,
    })
    // Col 5: Right Window
    seats.push({
      id: `upper-R${rightCabin2}`,
      name: `Right R${rightCabin2} Upper`,
      number: seatNumber++,
      side: "right",
      deck: "upper",
      row: r,
      col: 5,
      cabin: `R${rightCabin2}`,
      kind: null,
      pairId: `upper-R${rightCabin1}`,
    })
  }

  return {
    key: "sleeper-2x2-40",
    label: "2x2 Sleeper (40 Berths)",
    shortLabel: "2x2 Sleeper 40",
    category: "sleeper",
    totalSeats: 40,
    grid: {
      decks: ["lower", "upper"],
      rows: 5,
      cols: 5,
      aisleCol: 3,
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
      id: `${s1}`,
      name: `${s1}`,
      number: s1,
      side: "left",
      deck: null,
      row: r,
      col: 1,
      cabin: `Row ${r}`,
      kind: null,
      pairId: `${s1 + 1}`,
    })
    // Col 2: Left Aisle
    const s2 = seatNumber++
    seats.push({
      id: `${s2}`,
      name: `${s2}`,
      number: s2,
      side: "left",
      deck: null,
      row: r,
      col: 2,
      cabin: `Row ${r}`,
      kind: null,
      pairId: `${s1}`,
    })
    // Col 4: Right Aisle
    const s3 = seatNumber++
    seats.push({
      id: `${s3}`,
      name: `${s3}`,
      number: s3,
      side: "right",
      deck: null,
      row: r,
      col: 4,
      cabin: `Row ${r}`,
      kind: null,
      pairId: null,
    })
    // Col 5: Right Middle
    const s4 = seatNumber++
    seats.push({
      id: `${s4}`,
      name: `${s4}`,
      number: s4,
      side: "right",
      deck: null,
      row: r,
      col: 5,
      cabin: `Row ${r}`,
      kind: null,
      pairId: null,
    })
    // Col 6: Right Window
    const s5 = seatNumber++
    seats.push({
      id: `${s5}`,
      name: `${s5}`,
      number: s5,
      side: "right",
      deck: null,
      row: r,
      col: 6,
      cabin: `Row ${r}`,
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
      cols: 6, // col 1: Left Window, col 2: Left Aisle, col 3: Gangway, col 4: Right Aisle, col 5: Right Middle, col 6: Right Window
      aisleCol: 3,
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
const layoutSleeper2x2_48 = buildSleeper2x2_48()
const layoutSleeper2x2_40 = buildSleeper2x2_40()
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
 * Supported historical formats:
 * - Direct canonical IDs: "lower-L1", "lower-R1-1", "upper-L3", "lower-L2"
 * - 2x1 mismatch IDs: "lower-L1-1" -> "lower-L1" (single Left berth)
 * - 2x2 legacy IDs: "lower-L1-1" -> "lower-L1", "lower-L1-2" -> "lower-L2"
 * - Short tags: "1L" -> "lower-L1", "2L" -> "lower-L2", "1R1" -> "lower-R1-1"
 * - Plain number strings: "1", "12", "38" -> mapped via seat.number
 * - Plain uppercase tags: "L1" -> "lower-L1", "U1" -> "upper-L1"
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

  // 1. Direct match with canonical id (case-insensitive)
  const canonicalMatch = layout.seats.find(
    (s) => s.id.toLowerCase() === str.toLowerCase(),
  )
  if (canonicalMatch) return canonicalMatch.id

  // 2. Numeric match (e.g. 1..N)
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10)
    const numMatch = layout.seats.find((s) => s.number === num)
    if (numMatch) return numMatch.id
  }

  // 3. Layout-specific legacy transformations
  if (layout.key === "sleeper-2x1-38") {
    // 2x1 Left single berth mismatch: "lower-L1-1" -> "lower-L1"
    const leftMismatch = str.match(/^(lower|upper)-L(\d+)-1$/i)
    if (leftMismatch) {
      const candidate = `${leftMismatch[1].toLowerCase()}-L${leftMismatch[2]}`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }

    // Short forms like "1L" -> "lower-L1", "2L" -> "lower-L2"
    const shortLeft = str.match(/^(\d+)L$/i)
    if (shortLeft) {
      const candidate = `lower-L${shortLeft[1]}`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }

    // Short forms like "L1" -> "lower-L1", "U1" -> "upper-L1"
    const cabinLeft = str.match(/^([LU])(\d+)$/i)
    if (cabinLeft) {
      const deck = cabinLeft[1].toUpperCase() === "L" ? "lower" : "upper"
      const candidate = `${deck}-L${cabinLeft[2]}`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }
  } else if (layout.key === "sleeper-2x2-40" || layout.key === "sleeper-2x2-48") {
    // 2x2 legacy row notation:
    // lower-L{row}-1 -> lower-L{(row-1)*2 + 1}
    // lower-L{row}-2 -> lower-L{(row-1)*2 + 2}
    // lower-R{row}-1 -> lower-R{(row-1)*2 + 1}
    // lower-R{row}-2 -> lower-R{(row-1)*2 + 2}
    const legacy2x2 = str.match(/^(lower|upper)-([LR])(\d+)-([12])$/i)
    if (legacy2x2) {
      const deck = legacy2x2[1].toLowerCase()
      const side = legacy2x2[2].toUpperCase()
      const row = parseInt(legacy2x2[3], 10)
      const sub = parseInt(legacy2x2[4], 10)
      const cabinNum = (row - 1) * 2 + sub
      const candidate = `${deck}-${side}${cabinNum}`
      if (layout.seats.some((s) => s.id === candidate)) return candidate
    }
  } else if (layout.key === "seater-2x3-60") {
    // For seater, "Seat 1" or "S1" -> "1"
    const cleanNum = str.replace(/[^0-9]/g, "")
    if (cleanNum && layout.seats.some((s) => s.id === cleanNum)) {
      return cleanNum
    }
  }

  // Return original trimmed string if no mapping matched
  return str
}

/**
 * Returns human-friendly display label for a seat in a layout.
 * e.g. "Left L1 Lower (#1)" or "Seat 12"
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

  const seat = layout.seats.find((s) => s.id === canonicalId)
  if (seat) {
    return layout.category === "seater" ? `Seat ${seat.number}` : `${seat.name} (#${seat.number})`
  }
  return String(rawId)
}
