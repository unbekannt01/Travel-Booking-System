/**
 * Bus Seat Layout and Manifest Generation Utilities
 * Supports standard Indian sleeper coaches (2x1 and 2x2 layouts)
 * with separate Upper and Lower Deck mapping.
 */

export const BUS_LAYOUT_TYPES = {
  "2x1": {
    id: "2x1",
    label: "2x1 Sleeper (36 Berths)",
    rows: 6,
    deckSeats: 18,
    totalCapacity: 36,
  },
  "2x2": {
    id: "2x2",
    label: "2x2 Sleeper (40 Berths)",
    rows: 5,
    deckSeats: 20,
    totalCapacity: 40,
  },
}

/**
 * Generates seat definitions for a given deck and layout type.
 * @param {'lower' | 'upper'} deck
 * @param {'2x1' | '2x2'} layoutType
 * @returns {Array<{ id: string, label: string, row: number, side: 'left' | 'right', col: number }>}
 */
export const getDeckPhysicalSeats = (deck = "lower", layoutType = "2x1") => {
  const is2x2 = layoutType === "2x2"
  const seats = []
  const prefix = deck.toLowerCase()

  if (is2x2) {
    const rows = [1, 2, 3, 4, 5]
    rows.forEach((row) => {
      // Left side (2 seats: L1, L2)
      seats.push({
        id: `${prefix}-L${row}-1`,
        label: `${prefix[0].toUpperCase()}${row}-L1`,
        shortLabel: `${prefix[0].toUpperCase()}${row}L1`,
        row,
        side: "left",
        col: 1,
        deck,
      })
      seats.push({
        id: `${prefix}-L${row}-2`,
        label: `${prefix[0].toUpperCase()}${row}-L2`,
        shortLabel: `${prefix[0].toUpperCase()}${row}L2`,
        row,
        side: "left",
        col: 2,
        deck,
      })
      // Right side (2 seats: R1, R2)
      seats.push({
        id: `${prefix}-R${row}-1`,
        label: `${prefix[0].toUpperCase()}${row}-R1`,
        shortLabel: `${prefix[0].toUpperCase()}${row}R1`,
        row,
        side: "right",
        col: 1,
        deck,
      })
      seats.push({
        id: `${prefix}-R${row}-2`,
        label: `${prefix[0].toUpperCase()}${row}-R2`,
        shortLabel: `${prefix[0].toUpperCase()}${row}R2`,
        row,
        side: "right",
        col: 2,
        deck,
      })
    })
  } else {
    // 2x1 Layout (6 rows: Left has 1 seat, Right has 2 seats)
    const rows = [1, 2, 3, 4, 5, 6]
    rows.forEach((row) => {
      seats.push({
        id: `${prefix}-L${row}`,
        label: `${prefix[0].toUpperCase()}${row}-L`,
        shortLabel: `${prefix[0].toUpperCase()}${row}L`,
        row,
        side: "left",
        col: 1,
        deck,
      })
      seats.push({
        id: `${prefix}-R${row}-1`,
        label: `${prefix[0].toUpperCase()}${row}-R1`,
        shortLabel: `${prefix[0].toUpperCase()}${row}R1`,
        row,
        side: "right",
        col: 1,
        deck,
      })
      seats.push({
        id: `${prefix}-R${row}-2`,
        label: `${prefix[0].toUpperCase()}${row}-R2`,
        shortLabel: `${prefix[0].toUpperCase()}${row}R2`,
        row,
        side: "right",
        col: 2,
        deck,
      })
    })
  }

  return seats
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
  const is2x2 =
    layoutType === "2x2" ||
    departure?.busType?.startsWith("2x2") ||
    departure?.seatLayout === "2x2"

  const effectiveLayout = is2x2 ? "2x2" : "2x1"

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
 * Builds printable HTML document for conductor passenger seat layout.
 * Generates separate dedicated pages for Lower Deck and Upper Deck.
 */
export const buildSeatLayoutPrintHTML = ({
  manifestData,
  departure,
  user,
  deckFilter = "both", // 'both' | 'lower' | 'upper'
}) => {
  const companyName = user?.companyName || "YATRA TOURS"
  const companyPhone = user?.companyPhone || ""
  const companyHQ = user?.companyHeadquarters || ""
  const gstNumber = user?.gstNumber || ""
  const accentColor = user?.invoiceColor || "#4f46e5"

  const tourName = departure?.tourName || "Scheduled Tour"
  const journeyDate = departure?.journeyDate
    ? new Date(departure.journeyDate).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—"
  const busNumber = departure?.busNumber || "AC Sleeper Coach"
  const busType = departure?.busType || `${manifestData.layoutType} Luxury Sleeper`
  const printedAt = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const primaryOrganizer = user?.organizers?.[0]
  const organizerInfo = primaryOrganizer
    ? `${primaryOrganizer.name} (${primaryOrganizer.phone})`
    : companyPhone || "Operator Office"

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
                            <div class="pax-name">${p.name || "Passenger"}</div>
                            <div class="pax-meta">${p.age ? p.age + "y" : ""} ${p.gender || ""} • Inv #${p.invoiceNo}</div>
                            <div class="pax-phone">📞 ${p.contactPhone || p.contact || "—"}</div>
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
              ${isBooked ? p.name : "Available (Vacant Berth)"}
            </td>
            <td class="text-center">${isBooked && p.age ? `${p.age} / ${p.gender?.[0] || "—"}` : "—"}</td>
            <td>${isBooked ? p.contactPhone || p.contact || "—" : "—"}</td>
            <td>${isBooked ? p.city || "Boarding Point" : "—"}</td>
            <td class="text-center font-mono">${isBooked ? "#" + p.invoiceNo : "—"}</td>
            <td class="text-center">
              ${
                isBooked
                  ? `<span class="badge ${p.isPaid ? "badge-paid" : "badge-due"}">${p.isPaid ? "PAID" : `DUE ₹${p.balanceDue}`}</span>`
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
