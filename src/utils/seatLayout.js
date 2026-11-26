import { escapeHtml, sanitizeHexColor } from "./escapeHtml.js"
import { getSeatLayout, layoutKeyForBusType, resolveSeatId } from "../../shared/seatLayouts.js"
import { formatShortPassengerName } from "./seatFormatting.js"

export { formatShortPassengerName }
/**
 * Bus Seat Layout and Manifest Generation Utilities
 * Supports standard Indian sleeper coaches and seater layouts
 * with separate Upper and Lower Deck mapping.
 */

export const BUS_LAYOUT_TYPES = {
  "2x1": {
    id: "2x1",
    label: "2x1 Sleeper (38 Berths)",
    rows: 7,
    deckSeats: 19,
    totalCapacity: 38,
  },
  "2x2": {
    id: "2x2",
    label: "2x2 Sleeper (48 Berths)",
    rows: 6,
    deckSeats: 24,
    totalCapacity: 48,
  },
}

/**
 * Generates seat definitions for a given deck and layout type.
 * @param {'lower' | 'upper'} deck
 * @param {string} layoutType
 * @returns {Array<{ id: string, label: string, row: number, side: 'left' | 'right', col: number }>}
 */
export const getDeckPhysicalSeats = (deck = "lower", layoutType = "2x1") => {
  const layoutKey = layoutKeyForBusType(layoutType)
  const layout = getSeatLayout(layoutKey)
  if (!layout) return []
  const filtered = layout.seats.filter((s) => !s.deck || s.deck === deck)
  return filtered.map((s) => ({
    id: s.id,
    label: s.name,
    shortLabel: s.name.replace(/\s+/g, ""),
    row: s.row,
    side: s.side,
    col: s.col,
    deck: s.deck || deck,
    number: s.number,
  }))
}

/**
 * Normalizes seat identifier for robust matching.
 * e.g. "lower-L1" -> "lower-l1", "u1" -> "upper-l1"
 */
export const normalizeSeatId = (seatId) => {
  if (!seatId) return ""
  return String(seatId).trim().toLowerCase()
}

/**
 * Maps all physical seats on a coach with actual booked passenger data.
 * Filters out soft-deleted bookings and cancelled bookings.
 */
export const mapCoachSeatManifest = ({
  departure,
  bookings = [],
  layoutType = "2x1",
}) => {
  const effectiveLayout = departure?.busType || layoutType || "2x1"
  const layoutKey = layoutKeyForBusType(effectiveLayout)

  // 1. Gather active non-cancelled bookings matching this departure
  const activeBookings = bookings.filter((b) => {
    if (b.deletedAt) return false
    if (b.status === "cancelled") return false
    // If departure object provided, match tour and date
    if (departure) {
      const bTour = (b.tourName || "").trim().toLowerCase()
      const dTour = (departure.tourName || "").trim().toLowerCase()
      if (bTour && dTour && bTour !== dTour) return false

      const bDate = (b.journeyDate || "").substring(0, 10)
      const dDate = (departure.journeyDate || "").substring(0, 10)
      if (bDate && dDate && bDate !== dDate) return false
    }
    return true
  })

  // 2. Build passenger lookup map keyed by normalized seat ID
  const seatPassengerMap = new Map()
  const unassignedPassengers = []

  activeBookings.forEach((b) => {
    (b.passengers || []).forEach((p, idx) => {
      const passengerEntry = {
        ...p,
        passengerIndex: idx,
        bookingId: b._id || b.id,
        invoiceNo: b.invoiceNo,
        contactName: b.contactName,
        contactPhone: b.contactPhone,
        journeyDate: b.journeyDate,
        tourName: b.tourName,
        busNumber: b.busNumber || departure?.busNumber || "Coach",
        isPaid: (b.advanceReceived || 0) >= (b.totalAmount || 0),
        balanceDue: Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0)),
        checkedIn: Boolean(p.checkedIn),
      }

      if (p.seatId) {
        const canonicalId = resolveSeatId(layoutKey, p.seatId)
        seatPassengerMap.set(canonicalId, passengerEntry)
        seatPassengerMap.set(normalizeSeatId(p.seatId), passengerEntry)
        // Also map simplified versions like "l1" or "u1"
        const cleanId = p.seatId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
        seatPassengerMap.set(cleanId, passengerEntry)
      } else {
        unassignedPassengers.push(passengerEntry)
      }
    })
  })

  // 3. Map physical seats for Lower Deck
  const lowerPhysical = getDeckPhysicalSeats("lower", effectiveLayout)
  const lowerMapped = lowerPhysical.map((seat) => {
    const match =
      seatPassengerMap.get(normalizeSeatId(seat.id)) ||
      seatPassengerMap.get(seat.id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()) ||
      seatPassengerMap.get(seat.label.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())

    if (match) {
      return {
        ...seat,
        status: "booked",
        passenger: match,
      }
    }
    return {
      ...seat,
      status: "available",
      passenger: null,
    }
  })

  // 4. Map physical seats for Upper Deck
  const upperPhysical = getDeckPhysicalSeats("upper", effectiveLayout)
  const upperMapped = upperPhysical.map((seat) => {
    const match =
      seatPassengerMap.get(normalizeSeatId(seat.id)) ||
      seatPassengerMap.get(seat.id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()) ||
      seatPassengerMap.get(seat.label.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())

    if (match) {
      return {
        ...seat,
        status: "booked",
        passenger: match,
      }
    }
    return {
      ...seat,
      status: "available",
      passenger: null,
    }
  })

  // 5. Calculate statistics
  const totalPhysicalSeats = lowerMapped.length + upperMapped.length
  const lowerBookedCount = lowerMapped.filter((s) => s.status === "booked").length
  const upperBookedCount = upperMapped.filter((s) => s.status === "booked").length
  const totalBookedCount = lowerBookedCount + upperBookedCount
  const totalAvailableCount = totalPhysicalSeats - totalBookedCount
  const occupancyPercentage =
    totalPhysicalSeats > 0 ? Math.round((totalBookedCount / totalPhysicalSeats) * 100) : 0

  return {
    layoutType: effectiveLayout,
    totalCapacity: totalPhysicalSeats,
    totalBooked: totalBookedCount,
    totalAvailable: totalAvailableCount,
    occupancyPercentage,
    lowerDeck: {
      deck: "lower",
      title: "Lower Deck Layout",
      seats: lowerMapped,
      capacity: lowerMapped.length,
      bookedCount: lowerBookedCount,
      availableCount: lowerMapped.length - lowerBookedCount,
    },
    upperDeck: {
      deck: "upper",
      title: "Upper Deck Layout",
      seats: upperMapped,
      capacity: upperMapped.length,
      bookedCount: upperBookedCount,
      availableCount: upperMapped.length - upperBookedCount,
    },
    unassignedPassengers,
    activeBookingsCount: activeBookings.length,
  }
}

/**
 * Normalizes gender string for styling and badge classification.
 */
export function getPassengerGenderType(gender) {
  if (!gender) return "unknown"
  const g = String(gender).toLowerCase().trim()
  if (g === "female" || g === "f" || g === "woman" || g.includes("સ્ત્રી")) return "female"
  if (g === "male" || g === "m" || g === "man" || g.includes("પુરુષ")) return "male"
  return "other"
}

/**
 * Groups coach seats into 4 vertical berth columns:
 * 1. Left Lower (L1..L6)
 * 2. Left Upper (U1..U6)
 * 3. Right Lower (L1..L6)
 * 4. Right Upper (U1..U6)
 * Plus rear seats if present (for 2x1 sleeper B1/B2).
 */
export function groupSeatsIntoBerthColumns(manifestData) {
  const is2x1 = manifestData?.layoutType?.startsWith("2x1")
  const lowerSeats = manifestData?.lowerDeck?.seats || []
  const upperSeats = manifestData?.upperDeck?.seats || []

  const groupDeckSide = (seats, side) => {
    const map = new Map()
    seats.forEach((s) => {
      if (s.side !== side) return
      const row = s.row || 1
      if (!map.has(row)) {
        map.set(row, {
          row,
          box: s.box || `${s.deck === "lower" ? "L" : "U"}${row}`,
          deck: s.deck,
          side: s.side,
          seats: [],
        })
      }
      map.get(row).seats.push(s)
    })
    const arr = Array.from(map.values()).sort((a, b) => a.row - b.row)
    arr.forEach((item) => {
      item.seats.sort((a, b) => {
        const slotA = parseInt(String(a.id).split("-").pop(), 10) || a.slot || 1
        const slotB = parseInt(String(b.id).split("-").pop(), 10) || b.slot || 1
        return slotA - slotB
      })
    })
    return arr
  }

  const leftLower = groupDeckSide(lowerSeats, "left")
  const leftUpper = groupDeckSide(upperSeats, "left")
  const rightLower = groupDeckSide(lowerSeats, "right")
  const rightUpper = groupDeckSide(upperSeats, "right")

  const rearLower = lowerSeats.filter((s) => s.side === "rear")
  const rearUpper = upperSeats.filter((s) => s.side === "rear")

  const maxRows = Math.max(
    leftLower.length,
    leftUpper.length,
    rightLower.length,
    rightUpper.length,
    6
  )

  return {
    is2x1,
    maxRows,
    leftLower,
    leftUpper,
    rightLower,
    rightUpper,
    rearLower,
    rearUpper,
  }
}

/**
 * Builds printable HTML document for unified coach layout matching the yatriDesk reference:
 * - 4 columns: Left Lower, Left Upper, SLEEPER aisle, Right Lower, Right Upper
 * - Driver front banner: ▲ આગળ on left, ડ્રાઇવર on right
 * - Berth boxes with passenger names (first+middle only, no ticket numbers)
 * - Gender coding and compact layout fitting cleanly on a single page
 */
export const buildUnifiedCoachPrintHTML = ({
  manifestData,
  departure,
  user,
  berthFormat = "combined", // 'combined' | 'slots'
}) => {
  const companyName = escapeHtml(user?.companyName || "Yatra Tours")
  const companyPhone = escapeHtml(user?.companyPhone || "")
  const companyHQ = escapeHtml(user?.companyHeadquarters || "")
  const tourName = escapeHtml(departure?.tourName || "All Tours")
  const rawDateFormatted = departure?.journeyDate
    ? new Date(departure.journeyDate).toLocaleDateString("en-GB").replace(/\//g, "-")
    : "—"
  const totalBooked = manifestData.totalBooked || 0
  const totalCapacity = manifestData.totalCapacity || 0
  const cols = groupSeatsIntoBerthColumns(manifestData)

  const renderBerthCardHTML = (berthItem) => {
    if (!berthItem) {
      return `<div class="berth-card empty"><div class="berth-head">—</div><div class="pax-avail">ખાલી</div></div>`
    }
    const boxName = escapeHtml(berthItem.box || (berthItem.deck === "lower" ? `L${berthItem.row}` : `U${berthItem.row}`))
    const seats = berthItem.seats || []

    if (seats.length === 1) {
      const s = seats[0]
      const p = s.passenger
      const isBooked = s.status === "booked" && p
      const gType = isBooked ? getPassengerGenderType(p.gender) : "avail"
      const name = isBooked ? escapeHtml(formatShortPassengerName(p.name)) : "ખાલી (Available)"

      return `
        <div class="berth-card ${isBooked ? `booked border-${gType}` : "available"}">
          <div class="berth-head">${boxName}</div>
          <div class="berth-body single">
            <span class="pax-pill ${isBooked ? `pill-${gType}` : "pill-avail"}">
              ${name}
            </span>
          </div>
        </div>
      `
    }

    // Double berth (2 seats: slot 1 and slot 2)
    const s1 = seats[0]
    const s2 = seats[1]
    const p1 = s1?.status === "booked" ? s1.passenger : null
    const p2 = s2?.status === "booked" ? s2.passenger : null

    if (berthFormat === "slots") {
      const g1 = p1 ? getPassengerGenderType(p1.gender) : "avail"
      const g2 = p2 ? getPassengerGenderType(p2.gender) : "avail"
      const name1 = p1 ? escapeHtml(formatShortPassengerName(p1.name)) : `<span class="avail-text">ખાલી</span>`
      const name2 = p2 ? escapeHtml(formatShortPassengerName(p2.name)) : `<span class="avail-text">ખાલી</span>`

      return `
        <div class="berth-card ${p1 || p2 ? "has-booking" : "available"}">
          <div class="berth-head">${boxName}</div>
          <div class="slots-container">
            <div class="slot-row">
              <span class="slot-idx">1</span>
              <span class="slot-content pill-${g1}">${name1}</span>
            </div>
            <div class="slot-row">
              <span class="slot-idx">2</span>
              <span class="slot-content pill-${g2}">${name2}</span>
            </div>
          </div>
        </div>
      `
    }

    // Combined with "&" (User Request)
    if (p1 && p2) {
      const g1 = getPassengerGenderType(p1.gender)
      const g2 = getPassengerGenderType(p2.gender)
      const name1 = escapeHtml(formatShortPassengerName(p1.name))
      const name2 = escapeHtml(formatShortPassengerName(p2.name))

      return `
        <div class="berth-card booked">
          <div class="berth-head">${boxName}</div>
          <div class="berth-body pair">
            <span class="pax-pill pill-${g1}">${name1}</span>
            <span class="amp">&</span>
            <span class="pax-pill pill-${g2}">${name2}</span>
          </div>
        </div>
      `
    }

    if (p1 || p2) {
      const bookedP = p1 || p2
      const slotNum = p1 ? 1 : 2
      const freeNum = p1 ? 2 : 1
      const g = getPassengerGenderType(bookedP.gender)
      const name = escapeHtml(formatShortPassengerName(bookedP.name))

      return `
        <div class="berth-card partial">
          <div class="berth-head">${boxName}</div>
          <div class="berth-body pair">
            <span class="pax-pill pill-${g}">${slotNum}: ${name}</span>
            <span class="amp">&</span>
            <span class="pax-pill pill-avail">${freeNum}: ખાલી</span>
          </div>
        </div>
      `
    }

    return `
      <div class="berth-card available">
        <div class="berth-head">${boxName}</div>
        <div class="berth-body empty">
          <span class="pax-empty">ખાલી</span>
        </div>
      </div>
    `
  }

  // Generate rows
  const rowsHTML = []
  for (let r = 1; r <= cols.maxRows; r++) {
    const ll = cols.leftLower.find((b) => b.row === r)
    const lu = cols.leftUpper.find((b) => b.row === r)
    const rl = cols.rightLower.find((b) => b.row === r)
    const ru = cols.rightUpper.find((b) => b.row === r)

    rowsHTML.push(`
      <div class="coach-row">
        <div class="coach-col">${renderBerthCardHTML(ll)}</div>
        <div class="coach-col">${renderBerthCardHTML(lu)}</div>
        <div class="coach-aisle-divider"></div>
        <div class="coach-col">${renderBerthCardHTML(rl)}</div>
        <div class="coach-col">${renderBerthCardHTML(ru)}</div>
      </div>
    `)
  }

  // Rear section if 2x1 sleeper
  let rearHTML = ""
  if (cols.is2x1 && (cols.rearLower.length > 0 || cols.rearUpper.length > 0)) {
    const rl = cols.rearLower[0]
    const ru = cols.rearUpper[0]
    rearHTML = `
      <div class="rear-section">
        <div class="rear-title">REAR BERTHS</div>
        <div class="coach-row">
          <div class="coach-col col-span-2">
            ${renderBerthCardHTML(rl ? { box: "Rear B1 (Lower)", row: 7, deck: "lower", seats: [rl] } : null)}
          </div>
          <div class="coach-aisle-divider"></div>
          <div class="coach-col col-span-2">
            ${renderBerthCardHTML(ru ? { box: "Rear B2 (Upper)", row: 7, deck: "upper", seats: [ru] } : null)}
          </div>
        </div>
      </div>
    `
  }

  return `<!DOCTYPE html>
<html lang="gu">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; script-src 'none';"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Seat Layout - ${tourName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Gujarati", "Gujarati MT", Arial, sans-serif;
    background: #f8fafc;
    color: #0f172a;
    padding: 16px;
    font-size: 11px;
    line-height: 1.35;
  }
  .print-page {
    max-width: 760px;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 18px 22px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }
  /* Top Trip Title */
  .trip-header {
    text-align: center;
    margin-bottom: 14px;
  }
  .trip-title {
    font-size: 20px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .trip-sub {
    font-size: 13px;
    font-weight: 700;
    color: #475569;
    margin-top: 3px;
  }
  /* Driver Front Banner (Orange bar matching reference) */
  .driver-banner {
    background: #f59e0b;
    color: #111827;
    font-weight: 900;
    font-size: 12px;
    padding: 6px 16px;
    border-radius: 8px 8px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    letter-spacing: 0.05em;
  }
  /* Coach Box Container */
  .coach-box {
    border: 1.5px solid #94a3b8;
    border-top: none;
    border-radius: 0 0 10px 10px;
    background: #ffffff;
    overflow: hidden;
    padding-bottom: 8px;
  }
  /* Column Headers */
  .columns-head {
    display: grid;
    grid-template-columns: 1fr 1fr 34px 1fr 1fr;
    background: #f1f5f9;
    border-bottom: 1.5px solid #cbd5e1;
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    color: #1e3a8a;
  }
  .col-head-cell {
    padding: 6px 2px;
  }
  .aisle-head {
    background: #e2e8f0;
    border-left: 1px dashed #cbd5e1;
    border-right: 1px dashed #cbd5e1;
  }
  /* Grid rows */
  .coach-body {
    position: relative;
    padding: 4px 0;
  }
  .coach-row {
    display: grid;
    grid-template-columns: 1fr 1fr 34px 1fr 1fr;
    align-items: stretch;
    padding: 3px 6px;
  }
  .coach-col {
    padding: 0 3px;
  }
  .col-span-2 {
    grid-column: span 2;
  }
  /* Central Sleeper Aisle */
  .coach-aisle-divider {
    border-left: 1px dashed #cbd5e1;
    border-right: 1px dashed #cbd5e1;
    background: #f8fafc;
    min-height: 100%;
  }
  .aisle-text-vertical {
    writing-mode: vertical-rl;
    text-orientation: upright;
    letter-spacing: 0.35em;
    font-weight: 900;
    color: #94a3b8;
    font-size: 11px;
    text-align: center;
    margin: 0 auto;
    padding: 10px 0;
  }
  /* Berth Card */
  .berth-card {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    padding: 4px 6px;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  .berth-card.booked {
    border-color: #93c5fd;
    background: #f8fafc;
  }
  .berth-head {
    font-size: 11px;
    font-weight: 900;
    text-align: center;
    color: #1e293b;
    margin-bottom: 2px;
  }
  .berth-body {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 2px;
    flex: 1;
    text-align: center;
  }
  .berth-body.pair {
    line-height: 1.25;
  }
  .amp {
    font-weight: 900;
    color: #4f46e5;
    margin: 0 2px;
    font-size: 10px;
  }
  /* Passenger Badges / Pills */
  .pax-pill {
    display: inline-block;
    padding: 1.5px 5px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    white-space: normal;
    word-break: break-word;
    max-width: 100%;
  }
  .pill-male {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }
  .pill-female {
    background: #fdf2f8;
    color: #be185d;
    border: 1px solid #fbcfe8;
  }
  .pill-other {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }
  .pill-avail {
    background: #f8fafc;
    color: #94a3b8;
    border: 1px dashed #cbd5e1;
    font-style: italic;
  }
  .pax-empty {
    font-size: 9.5px;
    color: #94a3b8;
    font-style: italic;
  }
  /* Slot boxes format */
  .slots-container {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 1px;
  }
  .slot-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .slot-idx {
    font-size: 9px;
    font-weight: 900;
    color: #64748b;
    width: 10px;
    text-align: center;
    flex-shrink: 0;
  }
  .slot-content {
    flex: 1;
    min-height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1px 4px;
    border-radius: 4px;
    font-size: 9.5px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .avail-text {
    color: #94a3b8;
    font-size: 8.5px;
    font-style: italic;
  }
  /* Rear Section */
  .rear-section {
    margin-top: 6px;
    border-top: 1px dashed #cbd5e1;
    padding-top: 6px;
  }
  .rear-title {
    text-align: center;
    font-size: 8.5px;
    font-weight: 800;
    color: #94a3b8;
    letter-spacing: 0.1em;
    margin-bottom: 4px;
  }
  /* Legend Strip */
  .legend-strip {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 14px;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 700;
    color: #475569;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend-box {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    display: inline-block;
  }
  .legend-avail {
    border: 1.5px solid #94a3b8;
    background: #ffffff;
  }
  .legend-male {
    border: 1.5px solid #3b82f6;
    background: #eff6ff;
  }
  .legend-female {
    border: 1.5px solid #ec4899;
    background: #fdf2f8;
  }
  .legend-other {
    border: 1.5px solid #f59e0b;
    background: #fffbeb;
  }
  .footer-meta {
    margin-top: 10px;
    text-align: center;
    font-size: 8.5px;
    color: #94a3b8;
  }

  @page {
    size: A4 portrait;
    margin: 6mm;
  }
  @media print {
    body { background: #ffffff; padding: 0; }
    .print-page {
      box-shadow: none;
      border: none;
      padding: 0;
      margin: 0 auto;
    }
  }
</style>
</head>
<body>
  <div class="print-page">
    <div class="trip-header">
      <div class="trip-title">${tourName}</div>
      <div class="trip-sub">${rawDateFormatted} | કુલ પેસેન્જર: ${totalBooked} / ${totalCapacity}</div>
    </div>

    <div class="driver-banner">
      <span>▲ આગળ</span>
      <span>ડ્રાઇવર</span>
    </div>

    <div class="coach-box">
      <div class="columns-head">
        <div class="col-head-cell">( ડાબી નીચે )</div>
        <div class="col-head-cell">( ડાબી ઉપર )</div>
        <div class="col-head-cell aisle-head"></div>
        <div class="col-head-cell">( જમણી નીચે )</div>
        <div class="col-head-cell">( જમણી ઉપર )</div>
      </div>

      <div class="coach-body">
        <div style="position: absolute; left: 50%; transform: translateX(-50%); top: 0; bottom: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; z-index: 1;">
          <div class="aisle-text-vertical">SLEEPER</div>
        </div>
        ${rowsHTML.join("")}
        ${rearHTML}
      </div>
    </div>

    <div class="legend-strip">
      <div class="legend-item">
        <span class="legend-box legend-avail"></span>
        <span>ખાલી</span>
      </div>
      <div class="legend-item">
        <span class="legend-box legend-male"></span>
        <span>પુરુષ</span>
      </div>
      <div class="legend-item">
        <span class="legend-box legend-female"></span>
        <span>સ્ત્રી</span>
      </div>
      <div class="legend-item">
        <span class="legend-box legend-other"></span>
        <span>અન્ય</span>
      </div>
    </div>

    <div class="footer-meta">
      ${companyName} ${companyHQ ? `• ${companyHQ}` : ""} ${companyPhone ? `• ${companyPhone}` : ""}
    </div>
  </div>
</body>
</html>`
}

/**
 * Builds printable HTML document for conductor passenger seat layout.
 * Supports both unified coach layout (yatriDesk style) and separate deck layouts.
 */
export const buildSeatLayoutPrintHTML = ({
  manifestData,
  departure,
  user,
  deckFilter = "both", // 'both' | 'lower' | 'upper'
  layoutMode = "unified", // 'unified' | 'decks'
  berthFormat = "combined", // 'combined' | 'slots'
}) => {
  // If unified coach view is selected (and not specifically filtering lower/upper only), print reference coach layout
  if (layoutMode === "unified" && deckFilter === "both") {
    return buildUnifiedCoachPrintHTML({
      manifestData,
      departure,
      user,
      berthFormat,
    })
  }

  const companyName = escapeHtml(user?.companyName || "YATRA TOURS")
  const companyPhone = escapeHtml(user?.companyPhone || "")
  const companyHQ = escapeHtml(user?.companyHeadquarters || "")
  const gstNumber = escapeHtml(user?.gstNumber || "")
  const accentColor = sanitizeHexColor(user?.invoiceColor || "#4f46e5")

  const tourName = escapeHtml(departure?.tourName || "Scheduled Tour")
  const journeyDate = escapeHtml(departure?.journeyDate
    ? new Date(departure.journeyDate).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—")
  const busNumber = escapeHtml(departure?.busNumber || "AC Sleeper Coach")
  const busType = escapeHtml(departure?.busType || `${manifestData.layoutType} Luxury Sleeper`)
  const printedAt = escapeHtml(new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }))

  const primaryOrganizer = user?.organizers?.[0]
  const organizerInfo = escapeHtml(primaryOrganizer
    ? `${primaryOrganizer.name} (${primaryOrganizer.phone})`
    : user?.companyPhone || "Operator Office")

  const renderDeckSection = (deckObj) => {
    const isLower = deckObj.deck === "lower"
    const deckTitle = isLower ? "LOWER DECK SEAT LAYOUT" : "UPPER DECK SEAT LAYOUT"
    const deckSub = isLower
      ? "Ground Floor Berths • Easy Boarding & Senior Friendly"
      : "First Floor Berths • Elevated Sleeper Berths"

    // Group seats by row for 2D diagram
    const rows = {}
    deckObj.seats.forEach((s) => {
      if (!rows[s.row]) rows[s.row] = { left: [], right: [] }
      if (s.side === "left") rows[s.row].left.push(s)
      else rows[s.row].right.push(s)
    })

    const rowNumbers = Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b)

    // Visual grid HTML
    const gridHTML = `
      <div class="bus-coach">
        <div class="coach-header">
          <div class="driver-cabin">
            <span class="steering-icon">☸</span>
            <span class="driver-label">DRIVER CABIN / FRONT</span>
          </div>
          <div class="entry-door">ENTRANCE DOOR</div>
        </div>

        <div class="coach-body">
          <table class="coach-table">
            <thead>
              <tr>
                <th class="col-side">LEFT WINDOW</th>
                ${manifestData.layoutType === "2x2" ? `<th class="col-side">LEFT AISLE</th>` : ""}
                <th class="col-aisle">CENTRAL AISLE / GANGWAY</th>
                <th class="col-side">RIGHT AISLE</th>
                <th class="col-side">RIGHT WINDOW</th>
              </tr>
            </thead>
            <tbody>
              ${rowNumbers
                .map((rowNum) => {
                  const rowData = rows[rowNum]
                  const leftSeats = rowData.left
                  const rightSeats = rowData.right

                  const renderSeatCell = (seat) => {
                    if (!seat) return `<td class="seat-cell empty"></td>`
                    const isBooked = seat.status === "booked"
                    const p = seat.passenger

                    return `
                      <td class="seat-cell ${isBooked ? "seat-booked" : "seat-available"}">
                        <div class="seat-box">
                          <div class="seat-head">
                            <span class="seat-number">${seat.label}</span>
                            <span class="seat-status-tag">${isBooked ? "BOOKED" : "AVAILABLE"}</span>
                          </div>
                          ${
                            isBooked
                              ? `
                            <div class="pax-name">${escapeHtml(formatShortPassengerName(p.name || "Passenger"))}</div>
                            <div class="pax-meta">${p.age ? escapeHtml(p.age) + "y" : ""} ${escapeHtml(p.gender || "")}</div>
                          `
                              : `
                            <div class="pax-available-label">AVAILABLE</div>
                            <div class="pax-meta-empty">Seat Vacant</div>
                          `
                          }
                        </div>
                      </td>
                    `
                  }

                  return `
                    <tr>
                      ${leftSeats.map(renderSeatCell).join("")}
                      <td class="aisle-cell">
                        <span class="aisle-marker">ROW ${rowNum}</span>
                      </td>
                      ${rightSeats.map(renderSeatCell).join("")}
                    </tr>
                  `
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="coach-footer">
          <span>REAR / BACK OF COACH</span>
          <span>EMERGENCY EXIT ⛛</span>
        </div>
      </div>
    `

    // Passenger Roster Table HTML
    const sortedSeats = [...deckObj.seats].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row
      return a.col - b.col
    })

    const rosterRows = sortedSeats
      .map((seat, index) => {
        const isBooked = seat.status === "booked"
        const p = seat.passenger
        return `
          <tr class="${isBooked ? "" : "row-vacant"}">
            <td class="text-center font-bold">${index + 1}</td>
            <td class="seat-badge-col">
              <span class="seat-tag ${isBooked ? "tag-booked" : "tag-avail"}">${seat.label}</span>
            </td>
            <td class="font-bold ${isBooked ? "pax-col-name" : "text-muted"}">
              ${isBooked ? escapeHtml(p.name) : "Available (Vacant Berth)"}
            </td>
            <td class="text-center">${isBooked && p.age ? `${escapeHtml(p.age)} / ${escapeHtml(p.gender?.[0] || "—")}` : "—"}</td>
            <td>${isBooked ? escapeHtml(p.contactPhone || p.contact || "—") : "—"}</td>
            <td>${isBooked ? escapeHtml(p.city || "Boarding Point") : "—"}</td>
            <td class="text-center font-mono">${isBooked ? "#" + escapeHtml(p.invoiceNo) : "—"}</td>
            <td class="text-center">
              ${
                isBooked
                  ? `<span class="badge ${p.isPaid ? "badge-paid" : "badge-due"}">${p.isPaid ? "PAID" : `DUE ₹${escapeHtml(p.balanceDue)}`}</span>`
                  : `<span class="badge badge-avail">VACANT</span>`
              }
            </td>
            <td class="conductor-box">
              <div class="check-square"></div>
            </td>
          </tr>
        `
      })
      .join("")

    return `
      <div class="deck-page">
        <!-- Top Operator Header -->
        <div class="page-header">
          <div class="header-left">
            <h1 class="company-name">${companyName.toUpperCase()}</h1>
            <p class="company-sub">${companyHQ ? "📍 " + companyHQ : ""} ${companyPhone ? " • 📞 " + companyPhone : ""} ${gstNumber ? " • GST: " + gstNumber : ""}</p>
          </div>
          <div class="header-right">
            <div class="chart-badge">${deckTitle}</div>
            <p class="chart-date">Generated: ${printedAt}</p>
          </div>
        </div>

        <!-- Trip Information Strip -->
        <div class="trip-banner">
          <div class="trip-col">
            <span class="trip-label">TOUR / DESTINATION</span>
            <span class="trip-val-bold">${tourName}</span>
          </div>
          <div class="trip-col">
            <span class="trip-label">JOURNEY DATE & TIME</span>
            <span class="trip-val-bold">${journeyDate}</span>
          </div>
          <div class="trip-col">
            <span class="trip-label">BUS / COACH NO</span>
            <span class="trip-val-bold">${busNumber} (${busType})</span>
          </div>
          <div class="trip-col">
            <span class="trip-label">CONDUCTOR / ORGANIZER</span>
            <span class="trip-val-bold">${organizerInfo}</span>
          </div>
        </div>

        <!-- Stats Bar -->
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">DECK CAPACITY</span>
            <span class="stat-num">${deckObj.capacity} Berths</span>
          </div>
          <div class="stat-item highlight-booked">
            <span class="stat-label">BOOKED PASSENGERS</span>
            <span class="stat-num">${deckObj.bookedCount} Booked</span>
          </div>
          <div class="stat-item highlight-avail">
            <span class="stat-label">VACANT / AVAILABLE</span>
            <span class="stat-num">${deckObj.availableCount} Available</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">OCCUPANCY RATE</span>
            <span class="stat-num">${deckObj.capacity > 0 ? Math.round((deckObj.bookedCount / deckObj.capacity) * 100) : 0}%</span>
          </div>
        </div>

        <!-- Section 1: Visual Bus Berth Map -->
        <div class="section-title">
          <span>1. COACH BERTH SEAT MAP (2×1 SLEEPER ARRANGEMENT)</span>
          <span class="section-note">${deckSub}</span>
        </div>
        ${gridHTML}

        <!-- Section 2: Conductor Boarding Checklist Table -->
        <div class="section-title" style="margin-top: 22px;">
          <span>2. PASSENGER MANIFEST & BOARDING CHECKLIST</span>
          <span class="section-note">Check off passengers during coach boarding</span>
        </div>

        <table class="roster-table">
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="width: 65px;">SEAT</th>
              <th>PASSENGER NAME</th>
              <th style="width: 60px;">AGE/G</th>
              <th style="width: 100px;">PHONE</th>
              <th style="width: 110px;">BOARDING / CITY</th>
              <th style="width: 80px;">INVOICE</th>
              <th style="width: 80px;">STATUS</th>
              <th style="width: 55px;">BOARDED</th>
            </tr>
          </thead>
          <tbody>
            ${rosterRows}
          </tbody>
        </table>

        <!-- Signatures & Notes Footer -->
        <div class="footer-sign">
          <div class="sign-block">
            <div class="sign-line"></div>
            <p>Conductor / Trip Manager Signature</p>
          </div>
          <div class="notes-block">
            <p><strong>Note for Conductor:</strong> Verify Government Photo ID (Aadhaar / Voter ID) for all traveling passengers prior to coach departure.</p>
          </div>
          <div class="sign-block">
            <div class="sign-line"></div>
            <p>Driver / Operator Counter Signature</p>
          </div>
        </div>
      </div>
    `
  }

  const decksToRender = []
  if (deckFilter === "both" || deckFilter === "lower") {
    decksToRender.push(renderDeckSection(manifestData.lowerDeck))
  }
  if (deckFilter === "both" || deckFilter === "upper") {
    decksToRender.push(renderDeckSection(manifestData.upperDeck))
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: 'self'; font-src data:; script-src 'none';"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Passenger Seat Layout - ${tourName} - ${busNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    background: #f1f5f9;
    color: #0f172a;
    padding: 16px;
    font-size: 11px;
    line-height: 1.35;
  }

  .deck-page {
    max-width: 960px;
    margin: 0 auto 30px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 24px 28px;
    page-break-after: always;
    box-shadow: 0 4px 14px rgba(0,0,0,0.06);
  }
  .deck-page:last-child {
    page-break-after: avoid;
  }

  /* Header */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid ${accentColor};
    padding-bottom: 10px;
    margin-bottom: 12px;
  }
  .company-name {
    font-size: 18px;
    font-weight: 900;
    color: ${accentColor};
    letter-spacing: -0.02em;
  }
  .company-sub {
    font-size: 9.5px;
    color: #475569;
    margin-top: 2px;
    font-weight: 600;
  }
  .header-right {
    text-align: right;
  }
  .chart-badge {
    background: #0f172a;
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
    padding: 4px 12px;
    border-radius: 6px;
    letter-spacing: 0.08em;
  }
  .chart-date {
    font-size: 8.5px;
    color: #64748b;
    margin-top: 4px;
    font-weight: 700;
  }

  /* Trip banner */
  .trip-banner {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 12px;
    gap: 10px;
  }
  .trip-col {
    display: flex;
    flex-direction: column;
  }
  .trip-label {
    font-size: 8px;
    font-weight: 800;
    color: #64748b;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .trip-val-bold {
    font-size: 11.5px;
    font-weight: 800;
    color: #0f172a;
    margin-top: 2px;
  }

  /* Stats bar */
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .stat-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 12px;
    text-align: center;
  }
  .stat-label {
    display: block;
    font-size: 8px;
    font-weight: 800;
    color: #64748b;
    letter-spacing: 0.06em;
  }
  .stat-num {
    display: block;
    font-size: 13px;
    font-weight: 900;
    color: #0f172a;
    margin-top: 2px;
  }
  .highlight-booked {
    background: #eef2ff;
    border-color: #c7d2fe;
  }
  .highlight-booked .stat-num { color: #4338ca; }
  .highlight-avail {
    background: #ecfdf5;
    border-color: #a7f3d0;
  }
  .highlight-avail .stat-num { color: #047857; }

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 10px;
    font-weight: 900;
    color: #1e293b;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
    margin-bottom: 10px;
  }
  .section-note {
    font-size: 9px;
    color: #64748b;
    font-weight: 600;
  }

  /* Coach 2D diagram */
  .bus-coach {
    background: #ffffff;
    border: 2px solid #94a3b8;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  .coach-header {
    background: #334155;
    color: #ffffff;
    padding: 6px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.1em;
  }
  .driver-cabin {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .steering-icon {
    font-size: 14px;
  }
  .entry-door {
    background: #475569;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 8px;
  }

  .coach-table {
    width: 100%;
    border-collapse: collapse;
  }
  .coach-table th {
    background: #f1f5f9;
    font-size: 8px;
    font-weight: 800;
    color: #475569;
    padding: 4px;
    text-align: center;
    border-bottom: 1px solid #cbd5e1;
    letter-spacing: 0.05em;
  }
  .col-aisle {
    width: 80px;
    background: #e2e8f0 !important;
  }

  .seat-cell {
    padding: 4px;
    vertical-align: top;
    width: 25%;
    border: 1px solid #e2e8f0;
  }
  .seat-box {
    border-radius: 6px;
    padding: 6px 8px;
    min-height: 58px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .seat-booked .seat-box {
    background: #eff6ff;
    border: 1.5px solid #93c5fd;
  }
  .seat-available .seat-box {
    background: #f8fafc;
    border: 1.5px dashed #cbd5e1;
  }
  .seat-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
  }
  .seat-number {
    font-size: 10px;
    font-weight: 900;
    color: #0f172a;
  }
  .seat-status-tag {
    font-size: 7px;
    font-weight: 900;
    padding: 1px 4px;
    border-radius: 3px;
  }
  .seat-booked .seat-status-tag {
    background: #2563eb;
    color: #ffffff;
  }
  .seat-available .seat-status-tag {
    background: #e2e8f0;
    color: #475569;
  }
  .pax-name {
    font-size: 10px;
    font-weight: 800;
    color: #1e3a8a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pax-meta {
    font-size: 8px;
    color: #475569;
    font-weight: 600;
  }
  .pax-phone {
    font-size: 8px;
    font-weight: 700;
    color: #0f172a;
  }
  .pax-available-label {
    font-size: 9.5px;
    font-weight: 700;
    color: #94a3b8;
    text-align: center;
    margin-top: 8px;
  }
  .pax-meta-empty {
    font-size: 7.5px;
    color: #cbd5e1;
    text-align: center;
  }

  .aisle-cell {
    background: #f8fafc;
    border-left: 1px dashed #cbd5e1;
    border-right: 1px dashed #cbd5e1;
    text-align: center;
    vertical-align: middle;
  }
  .aisle-marker {
    font-size: 7.5px;
    font-weight: 800;
    color: #94a3b8;
    letter-spacing: 0.1em;
  }

  .coach-footer {
    background: #334155;
    color: #94a3b8;
    padding: 5px 14px;
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  /* Roster Table */
  .roster-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
    font-size: 9.5px;
  }
  .roster-table th {
    background: #0f172a;
    color: #ffffff;
    padding: 5px 8px;
    font-size: 8px;
    font-weight: 800;
    text-align: left;
    letter-spacing: 0.05em;
  }
  .roster-table td {
    padding: 4.5px 8px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: middle;
  }
  .roster-table tr:nth-child(even) td {
    background: #f8fafc;
  }
  .row-vacant td {
    background: #fcfcfc !important;
    opacity: 0.65;
  }
  .seat-tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 900;
    font-size: 9px;
  }
  .tag-booked {
    background: #dbeafe;
    color: #1e40af;
  }
  .tag-avail {
    background: #f1f5f9;
    color: #64748b;
  }
  .pax-col-name {
    font-size: 10px;
    color: #0f172a;
  }
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7.5px;
    font-weight: 800;
  }
  .badge-paid {
    background: #ecfdf5;
    color: #047857;
  }
  .badge-due {
    background: #fffbeb;
    color: #b45309;
  }
  .badge-avail {
    background: #f1f5f9;
    color: #64748b;
  }
  .check-square {
    width: 14px;
    height: 14px;
    border: 1.5px solid #64748b;
    border-radius: 3px;
    margin: 0 auto;
  }

  /* Signatures */
  .footer-sign {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    gap: 16px;
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid #cbd5e1;
    align-items: flex-end;
  }
  .sign-block {
    text-align: center;
  }
  .sign-line {
    border-bottom: 1px dashed #64748b;
    margin-bottom: 6px;
    height: 25px;
  }
  .sign-block p {
    font-size: 8px;
    font-weight: 800;
    color: #475569;
  }
  .notes-block {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 8px;
    color: #475569;
  }

  @page {
    size: A4 portrait;
    margin: 8mm;
  }
  @media print {
    body { background: #ffffff; padding: 0; }
    .deck-page {
      box-shadow: none;
      border: none;
      padding: 0;
      margin: 0 auto;
    }
  }
</style>
</head>
<body>
  ${decksToRender.join("")}
</body>
</html>`
}
