/**
 * Pure Client-Side Canvas Seat Map Image Generator (Part 6S-3a)
 *
 * Generates high-resolution (1080px wide) PNG seat confirmation card for manual WhatsApp sharing.
 * Renders the accurate bus layout matching the physical coach (berth boxes, aisles, rear seats, seater).
 *
 * PRIVACY CONTRACT:
 * - Highlights only the shared booking's selected passenger seats (vibrant blue, checkmark, seat label).
 * - Other occupied seats appear strictly neutral "Booked" (slate grey, diagonal hatch, lock mark).
 * - NEVER reveals other passengers' names, phones, Aadhaar, fares, or financial details.
 * - Shows balance due ONLY when explicitly opted-in (showBalance toggle).
 */

import { getSeatLayout, resolveSeatId, DEFAULT_LAYOUT_KEY } from "../../shared/seatLayouts.js"
import { formatSeatLabel } from "./seatFormatting.js"

export const DEFAULT_FONT_STACK =
  '"Noto Sans Gujarati", "Noto Sans Devanagari", "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

/**
 * Normalizes Indian phone number to 12 digits (with 91 country code) or null if invalid.
 * Rules:
 * - 10 digits: prefix 91
 * - 12 digits starting with 91: return as is
 * - 11 digits starting with 0: strip 0, prefix 91
 * - other formats: null
 */
export function normalizeIndianPhone(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, "")
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith("91")) return digits
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`
  return null
}

/**
 * Localized labels for seat image rendering and messaging
 */
export const SEAT_IMAGE_I18N = {
  en: {
    front: "▲ FRONT",
    driver: "DRIVER",
    leftLower: "LEFT LOWER",
    leftUpper: "LEFT UPPER",
    rightLower: "RIGHT LOWER",
    rightUpper: "RIGHT UPPER",
    leftWindow: "L-WINDOW",
    leftAisle: "L-AISLE",
    rightAisle: "R-AISLE",
    rightMiddle: "R-MIDDLE",
    rightWindow: "R-WINDOW",
    rearSeats: "REAR SEATS",
    sleeperAisle: "SLEEPER",
    seaterAisle: "AISLE",
    tour: "Tour",
    date: "Date",
    bus: "Bus",
    passenger: "Passenger(s)",
    pickup: "Pickup",
    drop: "Drop",
    seats: "Seat(s)",
    balanceDue: "Balance Due",
    paidInFull: "Paid in Full",
    happyJourney: "Wish you a happy & safe journey!",
    legendYourSeat: "Your Seat(s)",
    legendBooked: "Booked",
    legendAvailable: "Available",
    bookedStatus: "Booked",
    title: "SEAT CONFIRMATION",
    confirmationMsg: "Your seat booking is confirmed!",
    contactMsg: "For any assistance, please contact",
  },
  gu: {
    front: "▲ આગળ (FRONT)",
    driver: "ડ્રાઇવર (DRIVER)",
    leftLower: "ડાબી નીચે (LOWER)",
    leftUpper: "ડાબી ઉપર (UPPER)",
    rightLower: "જમણી નીચે (LOWER)",
    rightUpper: "જમણી ઉપર (UPPER)",
    leftWindow: "ડાબી બારી",
    leftAisle: "ડાબી ગેલેરી",
    rightAisle: "જમણી ગેલેરી",
    rightMiddle: "જમણી વચ્ચે",
    rightWindow: "જમણી બારી",
    rearSeats: "પાછળની સીટ (REAR)",
    sleeperAisle: "સ્લીપર",
    seaterAisle: "ગેલેરી",
    tour: "ટૂર",
    date: "તારીખ",
    bus: "બસ",
    passenger: "મુસાફર",
    pickup: "પીકઅપ સ્થળ",
    drop: "ડ્રોપ સ્થળ",
    seats: "સીટ નંબર",
    balanceDue: "બાકી રકમ",
    paidInFull: "સંપૂર્ણ ચૂકવેલ",
    happyJourney: "આપની યાત્રા મંગલમય અને સુખદ રહે!",
    legendYourSeat: "તમારી સીટ",
    legendBooked: "બુક થયેલ",
    legendAvailable: "ઉપલબ્ધ",
    bookedStatus: "બુક થયેલ",
    title: "સીટ કન્ફર્મેશન",
    confirmationMsg: "તમારી સીટ બુકિંગ કન્ફર્મ થઈ ગઈ છે!",
    contactMsg: "વધુ માહિતી માટે સંપર્ક કરો",
  },
  hi: {
    front: "▲ आगे (FRONT)",
    driver: "ड्राइवर (DRIVER)",
    leftLower: "बाईं निचली (LOWER)",
    leftUpper: "बाईં ऊपरी (UPPER)",
    rightLower: "दायीં निचली (LOWER)",
    rightUpper: "दायीં ऊपरी (UPPER)",
    leftWindow: "बाएं खिड़की",
    leftAisle: "बाएं गलियारा",
    rightAisle: "दाएं गलियारा",
    rightMiddle: "दाएं मध्य",
    rightWindow: "दाएं खिड़की",
    rearSeats: "पिछली सीटें (REAR)",
    sleeperAisle: "स्लीपर",
    seaterAisle: "गलियारा",
    tour: "यात्रा",
    date: "दिनांक",
    bus: "बस",
    passenger: "यात्री",
    pickup: "पिकअप स्थान",
    drop: "ड्रॉप स्थान",
    seats: "सीट संख्या",
    balanceDue: "बकाया राशि",
    paidInFull: "पूर्ण भुगतान",
    happyJourney: "आपकी यात्रा मंगलमय और सुखद हो!",
    legendYourSeat: "आपकी सीट",
    legendBooked: "बुक",
    legendAvailable: "उपलब्ध",
    bookedStatus: "बुक",
    title: "सीट पुष्टि",
    confirmationMsg: "आपकी सीट बुकिंग कन्फर्म हो गई है!",
    contactMsg: "किसी भी सहायता के लिए संपर्क करें",
  },
}

/**
 * Canvas 2D rounded rectangle helper
 */
function drawRoundRect(ctx, x, y, width, height, radius, fill = false, stroke = true) {
  if (typeof radius === "number") {
    radius = { tl: radius, tr: radius, br: radius, bl: radius }
  } else {
    radius = { tl: 0, tr: 0, br: 0, bl: 0, ...radius }
  }
  ctx.beginPath()
  ctx.moveTo(x + radius.tl, y)
  ctx.lineTo(x + width - radius.tr, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr)
  ctx.lineTo(x + width, y + height - radius.br)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height)
  ctx.lineTo(x + radius.bl, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl)
  ctx.lineTo(x, y + radius.tl)
  ctx.quadraticCurveTo(x, y, x + radius.tl, y)
  ctx.closePath()
  if (fill) ctx.fill()
  if (stroke) ctx.stroke()
}

/**
 * Draws diagonal hatch lines inside a rectangular area for booked seats
 */
function drawDiagonalHatch(ctx, x, y, width, height, color = "#cbd5e1", spacing = 8) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  for (let offset = -height; offset < width + height; offset += spacing) {
    ctx.beginPath()
    ctx.moveTo(x + offset, y)
    ctx.lineTo(x + offset + height, y + height)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Formats a journey date string or Date object
 */
function formatDisplayDate(dateVal) {
  if (!dateVal) return ""
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return String(dateVal)
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return String(dateVal)
  }
}

/**
 * Pure Canvas 2D seat map generator
 *
 * @param {Object} options
 * @param {string} [options.layoutKey]
 * @param {string} [options.busType]
 * @param {Object} [options.departureInfo]
 * @param {Object} [options.booking]
 * @param {string[]} [options.sharedSeatIds=[]] - The specific seat IDs to highlight for this passenger
 * @param {Object} [options.occupiedSeatsMap={}] - Map of seatId -> { status: 'booked'|'held'|'blocked' }
 * @param {Object} [options.operatorInfo={}]
 * @param {boolean} [options.showBalance=false]
 * @param {string} [options.lang='en']
 * @returns {Promise<Blob>}
 */
export async function generateSeatImageBlob({
  layoutKey,
  busType,
  departureInfo = {},
  booking = {},
  sharedSeatIds = [],
  occupiedSeatsMap = {},
  operatorInfo = {},
  showBalance = false,
  lang = "en",
}) {
  // Wait for web fonts if document.fonts is available (with safety timeout)
  if (typeof document !== "undefined" && document.fonts?.ready && document.fonts.status !== "loaded") {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 150)),
      ])
    } catch {
      // Non-blocking font wait fallback
    }
  }

  const resolvedLayoutKey = layoutKey || booking.seatLayoutKey || DEFAULT_LAYOUT_KEY
  const layout = getSeatLayout(resolvedLayoutKey) || getSeatLayout(DEFAULT_LAYOUT_KEY)
  const isSleeper = layout.category === "sleeper"
  const is2x1 = layout.key === "sleeper-2x1-38"
  const rowsCount = layout.grid?.rows || 6
  const hasRear = Boolean(layout.grid?.hasRear)

  const i18n = SEAT_IMAGE_I18N[lang] || SEAT_IMAGE_I18N.en

  // Normalize shared seat IDs set
  const sharedSet = new Set(
    (sharedSeatIds || []).map((s) => resolveSeatId(layout.key, s)),
  )

  // Canvas geometry constants
  const CANVAS_WIDTH = 1080
  const MARGIN_X = 40
  const CONTENT_WIDTH = CANVAS_WIDTH - MARGIN_X * 2 // 1000px

  // Compute dynamic height based on layout category and rows
  const HEADER_HEIGHT = 230
  const FRONT_STRIP_HEIGHT = 44
  const COL_HEADERS_HEIGHT = 38
  const ROW_GAP = 8
  const ROW_HEIGHT = isSleeper ? (is2x1 ? 76 : 80) : 48
  const MAIN_GRID_HEIGHT = rowsCount * ROW_HEIGHT + (rowsCount - 1) * ROW_GAP
  const REAR_SECTION_HEIGHT = hasRear ? 86 : 0
  const BUS_CONTAINER_PADDING = 20
  const BUS_CONTAINER_HEIGHT =
    FRONT_STRIP_HEIGHT +
    COL_HEADERS_HEIGHT +
    MAIN_GRID_HEIGHT +
    REAR_SECTION_HEIGHT +
    BUS_CONTAINER_PADDING * 2 +
    16

  const LEGEND_HEIGHT = 50
  const FOOTER_HEIGHT = showBalance ? 220 : 180
  const TOTAL_HEIGHT =
    HEADER_HEIGHT + BUS_CONTAINER_HEIGHT + LEGEND_HEIGHT + FOOTER_HEIGHT + 60

  // Create offscreen canvas
  let canvas
  if (typeof document !== "undefined") {
    canvas = document.createElement("canvas")
  } else if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(CANVAS_WIDTH, TOTAL_HEIGHT)
  } else {
    throw new Error("Canvas environment not available")
  }

  canvas.width = CANVAS_WIDTH
  canvas.height = TOTAL_HEIGHT
  const ctx = canvas.getContext("2d")

  // Fill background
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, CANVAS_WIDTH, TOTAL_HEIGHT)

  // ==========================================
  // 1. TOP HEADER SECTION (Card Info & Branding)
  // ==========================================
  let curY = 32

  // Outer header card box
  ctx.fillStyle = "#f8fafc"
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 1.5
  drawRoundRect(ctx, MARGIN_X, curY, CONTENT_WIDTH, HEADER_HEIGHT - 10, 16, true, true)

  // Company Name
  const companyName =
    operatorInfo.companyName || departureInfo.companyName || "YATRA HUB"
  ctx.fillStyle = "#0f172a"
  ctx.font = `bold 28px ${DEFAULT_FONT_STACK}`
  ctx.textAlign = "left"
  ctx.fillText(companyName, MARGIN_X + 24, curY + 40)

  // Badge: SEAT CONFIRMATION
  ctx.fillStyle = "#2563eb"
  ctx.strokeStyle = "#1d4ed8"
  ctx.lineWidth = 1
  drawRoundRect(ctx, MARGIN_X + CONTENT_WIDTH - 240, curY + 16, 216, 36, 18, true, true)
  ctx.fillStyle = "#ffffff"
  ctx.font = `bold 14px ${DEFAULT_FONT_STACK}`
  ctx.textAlign = "center"
  ctx.fillText(i18n.title, MARGIN_X + CONTENT_WIDTH - 132, curY + 40)

  // Company Phone / Details
  const companyPhone =
    operatorInfo.phone ||
    departureInfo.companyPhone ||
    operatorInfo.companyPhone ||
    ""
  if (companyPhone) {
    ctx.fillStyle = "#64748b"
    ctx.font = `14px ${DEFAULT_FONT_STACK}`
    ctx.textAlign = "left"
    ctx.fillText(`Phone: ${companyPhone}`, MARGIN_X + 24, curY + 66)
  }

  // Divider line
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(MARGIN_X + 24, curY + 82)
  ctx.lineTo(MARGIN_X + CONTENT_WIDTH - 24, curY + 82)
  ctx.stroke()

  // Trip & Booking Details Grid
  const tourName = departureInfo.tourName || booking.tourName || "Tour"
  const journeyDateStr = formatDisplayDate(
    departureInfo.journeyDate || departureInfo.dateStr || booking.journeyDate,
  )
  const busTypeLabel = layout.label || busType || booking.busType || "Luxury Bus"

  // Passenger names (for highlighted seats)
  const relevantPassengers = (booking.passengers || []).filter(
    (p) => p.seatId && sharedSet.has(resolveSeatId(layout.key, p.seatId)),
  )
  const passengerNames =
    relevantPassengers.length > 0
      ? relevantPassengers.map((p) => p.name).join(", ")
      : booking.contactName || "Valued Passenger"

  const pickupPoint =
    relevantPassengers[0]?.pickupPoint ||
    booking.pickupPoint ||
    relevantPassengers[0]?.city ||
    ""
  const pickupTime = relevantPassengers[0]?.pickupTime || booking.pickupTime || ""
  const pickupText =
    pickupPoint && pickupTime
      ? `${pickupPoint} (${pickupTime})`
      : pickupPoint || pickupTime || "As scheduled"

  // Left Column: Tour & Date
  ctx.fillStyle = "#475569"
  ctx.font = `13px ${DEFAULT_FONT_STACK}`
  ctx.textAlign = "left"
  ctx.fillText(`${i18n.tour}:`, MARGIN_X + 24, curY + 110)
  ctx.fillStyle = "#0f172a"
  ctx.font = `bold 18px ${DEFAULT_FONT_STACK}`
  ctx.fillText(tourName, MARGIN_X + 76, curY + 110)

  ctx.fillStyle = "#475569"
  ctx.font = `13px ${DEFAULT_FONT_STACK}`
  ctx.fillText(`${i18n.date}:`, MARGIN_X + 24, curY + 140)
  ctx.fillStyle = "#0f172a"
  ctx.font = `bold 16px ${DEFAULT_FONT_STACK}`
  ctx.fillText(journeyDateStr, MARGIN_X + 76, curY + 140)

  ctx.fillStyle = "#475569"
  ctx.font = `13px ${DEFAULT_FONT_STACK}`
  ctx.fillText(`${i18n.bus}:`, MARGIN_X + 24, curY + 170)
  ctx.fillStyle = "#334155"
  ctx.font = `14px ${DEFAULT_FONT_STACK}`
  ctx.fillText(busTypeLabel, MARGIN_X + 76, curY + 170)

  // Right Column: Passenger & Pickup
  const midX = MARGIN_X + CONTENT_WIDTH / 2 + 20
  ctx.fillStyle = "#475569"
  ctx.font = `13px ${DEFAULT_FONT_STACK}`
  ctx.fillText(`${i18n.passenger}:`, midX, curY + 110)
  ctx.fillStyle = "#0f172a"
  ctx.font = `bold 18px ${DEFAULT_FONT_STACK}`
  const truncatedPax =
    passengerNames.length > 32
      ? passengerNames.slice(0, 30) + "..."
      : passengerNames
  ctx.fillText(truncatedPax, midX + 110, curY + 110)

  ctx.fillStyle = "#475569"
  ctx.font = `13px ${DEFAULT_FONT_STACK}`
  ctx.fillText(`${i18n.pickup}:`, midX, curY + 140)
  ctx.fillStyle = "#2563eb"
  ctx.font = `bold 16px ${DEFAULT_FONT_STACK}`
  ctx.fillText(pickupText, midX + 110, curY + 140)

  if (booking.invoiceNo) {
    ctx.fillStyle = "#64748b"
    ctx.font = `12px ${DEFAULT_FONT_STACK}`
    ctx.fillText(`Ref: ${booking.invoiceNo}`, midX, curY + 170)
  }

  curY += HEADER_HEIGHT + 14

  // ==========================================
  // 2. BUS BODY CONTAINER
  // ==========================================
  const busShellX = MARGIN_X
  const busShellY = curY
  const busShellW = CONTENT_WIDTH
  const busShellH = BUS_CONTAINER_HEIGHT

  // Outer Bus Shell (smooth rounded outline)
  ctx.fillStyle = "#f8fafc"
  ctx.strokeStyle = "#94a3b8"
  ctx.lineWidth = 2.5
  drawRoundRect(ctx, busShellX, busShellY, busShellW, busShellH, 24, true, true)

  let busInnerY = busShellY + BUS_CONTAINER_PADDING

  // Front Amber Strip
  ctx.fillStyle = "#fef3c7"
  ctx.strokeStyle = "#fcd34d"
  ctx.lineWidth = 1.5
  drawRoundRect(
    ctx,
    busShellX + 16,
    busInnerY,
    busShellW - 32,
    FRONT_STRIP_HEIGHT,
    10,
    true,
    true,
  )

  ctx.fillStyle = "#78350f"
  ctx.font = `bold 16px ${DEFAULT_FONT_STACK}`
  ctx.textAlign = "left"
  ctx.fillText(i18n.front, busShellX + 36, busInnerY + 28)

  ctx.textAlign = "right"
  ctx.fillText(`☸  ${i18n.driver}`, busShellX + busShellW - 36, busInnerY + 28)

  busInnerY += FRONT_STRIP_HEIGHT + 10

  // ------------------------------------------
  // Layout Columns & Grid
  // ------------------------------------------
  if (isSleeper) {
    // 5 Columns: Left Lower, Left Upper, Central Aisle, Right Lower, Right Upper
    const usableW = busShellW - 48
    const aisleW = 60
    const colW = (usableW - aisleW) / 4
    const startX = busShellX + 24

    const colX = [
      startX,
      startX + colW,
      startX + colW * 2, // Aisle
      startX + colW * 2 + aisleW,
      startX + colW * 3 + aisleW,
    ]

    // Column Headers
    ctx.fillStyle = "#64748b"
    ctx.font = `bold 12px ${DEFAULT_FONT_STACK}`
    ctx.textAlign = "center"

    ctx.fillText(i18n.leftLower, colX[0] + colW / 2, busInnerY + 22)
    ctx.fillText(i18n.leftUpper, colX[1] + colW / 2, busInnerY + 22)
    ctx.fillText("||", colX[2] + aisleW / 2, busInnerY + 22)
    ctx.fillText(i18n.rightLower, colX[3] + colW / 2, busInnerY + 22)
    ctx.fillText(i18n.rightUpper, colX[4] + colW / 2, busInnerY + 22)

    // Divider under column headers
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(busShellX + 24, busInnerY + 32)
    ctx.lineTo(busShellX + busShellW - 24, busInnerY + 32)
    ctx.stroke()

    busInnerY += COL_HEADERS_HEIGHT

    // Map seats by key: `${row}-${side}-${deck}-${slot}`
    const seatMap = new Map()
    for (const seat of layout.seats) {
      if (seat.section === "main") {
        seatMap.set(`${seat.row}-${seat.side}-${seat.deck}-${seat.slot}`, seat)
      }
    }

    // Helper to render individual berth seat box
    const renderSeat = (seat, sx, sy, sw, sh) => {
      if (!seat) return

      const isShared = sharedSet.has(seat.id)
      const occupiedInfo = occupiedSeatsMap[seat.id]
      const isOccupiedOther = !isShared && (occupiedInfo?.status === "booked" || occupiedInfo?.status === "held" || occupiedInfo?.status === "blocked")

      if (isShared) {
        // Highlighting for passenger's seat
        ctx.fillStyle = "#2563eb"
        ctx.strokeStyle = "#1d4ed8"
        ctx.lineWidth = 2
        drawRoundRect(ctx, sx, sy, sw, sh, 6, true, true)

        // White text
        ctx.fillStyle = "#ffffff"
        ctx.font = `bold 12px ${DEFAULT_FONT_STACK}`
        ctx.textAlign = "left"
        ctx.fillText(`#${seat.number}`, sx + 6, sy + 16)

        ctx.textAlign = "right"
        ctx.fillText("✓", sx + sw - 6, sy + 16)

        ctx.font = `bold 13px ${DEFAULT_FONT_STACK}`
        ctx.textAlign = "center"
        ctx.fillText(formatSeatLabel(seat.id, { layoutKey: layout.key }), sx + sw / 2, sy + sh - 8)
      } else if (isOccupiedOther) {
        // STRICT PRIVACY: Neutral Slate Grey with diagonal hatch
        ctx.fillStyle = "#f1f5f9"
        ctx.strokeStyle = "#cbd5e1"
        ctx.lineWidth = 1
        drawRoundRect(ctx, sx, sy, sw, sh, 6, true, true)
        drawDiagonalHatch(ctx, sx, sy, sw, sh, "#e2e8f0", 6)

        ctx.fillStyle = "#64748b"
        ctx.font = `bold 11px ${DEFAULT_FONT_STACK}`
        ctx.textAlign = "center"
        ctx.fillText(`🔒 ${i18n.bookedStatus}`, sx + sw / 2, sy + sh / 2 + 4)
      } else {
        // Available Seat
        ctx.fillStyle = "#ffffff"
        ctx.strokeStyle = "#e2e8f0"
        ctx.lineWidth = 1
        drawRoundRect(ctx, sx, sy, sw, sh, 6, true, true)

        ctx.fillStyle = "#94a3b8"
        ctx.font = `11px ${DEFAULT_FONT_STACK}`
        ctx.textAlign = "left"
        ctx.fillText(`#${seat.number}`, sx + 6, sy + 15)

        ctx.fillStyle = "#64748b"
        ctx.font = `11px ${DEFAULT_FONT_STACK}`
        ctx.textAlign = "center"
        const label = is2x1 && seat.side === "left" ? `L${seat.row}` : `${seat.box}-${seat.slot}`
        ctx.fillText(label, sx + sw / 2, sy + sh - 7)
      }
    }

    // Render Main Rows
    for (let r = 1; r <= rowsCount; r++) {
      const rowY = busInnerY + (r - 1) * (ROW_HEIGHT + ROW_GAP)

      // Berth Box rendering helper
      const renderBerthBox = (boxTitle, bx, by, bw, bh, seat1, seat2) => {
        // Subtle container for the box
        ctx.fillStyle = "#f8fafc"
        ctx.strokeStyle = "#e2e8f0"
        ctx.lineWidth = 1
        drawRoundRect(ctx, bx, by, bw, bh, 8, true, true)

        // Box label
        ctx.fillStyle = "#94a3b8"
        ctx.font = `bold 10px ${DEFAULT_FONT_STACK}`
        ctx.textAlign = "center"
        ctx.fillText(boxTitle, bx + bw / 2, by + 12)

        const innerPadding = 4
        const innerTop = by + 16
        const innerH = bh - 20

        if (seat1 && seat2) {
          // Stacked two seats vertically inside box
          const seatH = (innerH - 4) / 2
          renderSeat(seat1, bx + innerPadding, innerTop, bw - innerPadding * 2, seatH)
          renderSeat(seat2, bx + innerPadding, innerTop + seatH + 4, bw - innerPadding * 2, seatH)
        } else if (seat1) {
          // Single seat inside box
          renderSeat(seat1, bx + innerPadding, innerTop, bw - innerPadding * 2, innerH)
        }
      }

      // Col 0: Left Lower Box
      const ll1 = seatMap.get(`${r}-left-lower-1`)
      const ll2 = seatMap.get(`${r}-left-lower-2`)
      renderBerthBox(`L${r}`, colX[0], rowY, colW - 6, ROW_HEIGHT, ll1, ll2)

      // Col 1: Left Upper Box
      const lu1 = seatMap.get(`${r}-left-upper-1`)
      const lu2 = seatMap.get(`${r}-left-upper-2`)
      renderBerthBox(`U${r}`, colX[1], rowY, colW - 6, ROW_HEIGHT, lu1, lu2)

      // Col 2: Central Aisle
      ctx.strokeStyle = "#cbd5e1"
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(colX[2] + 4, rowY)
      ctx.lineTo(colX[2] + 4, rowY + ROW_HEIGHT)
      ctx.moveTo(colX[2] + aisleW - 4, rowY)
      ctx.lineTo(colX[2] + aisleW - 4, rowY + ROW_HEIGHT)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = "#cbd5e1"
      ctx.font = `bold 10px ${DEFAULT_FONT_STACK}`
      ctx.textAlign = "center"
      ctx.fillText(i18n.sleeperAisle, colX[2] + aisleW / 2, rowY + ROW_HEIGHT / 2 + 4)

      // Col 3: Right Lower Box
      const rl1 = seatMap.get(`${r}-right-lower-1`)
      const rl2 = seatMap.get(`${r}-right-lower-2`)
      renderBerthBox(`L${r}`, colX[3], rowY, colW - 6, ROW_HEIGHT, rl1, rl2)

      // Col 4: Right Upper Box
      const ru1 = seatMap.get(`${r}-right-upper-1`)
      const ru2 = seatMap.get(`${r}-right-upper-2`)
      renderBerthBox(`U${r}`, colX[4], rowY, colW - 6, ROW_HEIGHT, ru1, ru2)
    }

    busInnerY += MAIN_GRID_HEIGHT + 10

    // Rear Section for 2x1-38 (Boxes B1 & B2)
    if (hasRear) {
      ctx.strokeStyle = "#cbd5e1"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(busShellX + 24, busInnerY)
      ctx.lineTo(busShellX + busShellW - 24, busInnerY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = "#64748b"
      ctx.font = `bold 11px ${DEFAULT_FONT_STACK}`
      ctx.textAlign = "center"
      ctx.fillText(i18n.rearSeats, busShellX + busShellW / 2, busInnerY + 16)

      const rearY = busInnerY + 24
      const rearSeats = layout.seats.filter((s) => s.section === "rear")
      const rearBoxW = (busShellW - 64) / 2

      rearSeats.forEach((rs, idx) => {
        const rx = busShellX + 24 + idx * (rearBoxW + 16)
        ctx.fillStyle = "#f8fafc"
        ctx.strokeStyle = "#e2e8f0"
        ctx.lineWidth = 1
        drawRoundRect(ctx, rx, rearY, rearBoxW, 44, 8, true, true)

        ctx.fillStyle = "#94a3b8"
        ctx.font = `bold 10px ${DEFAULT_FONT_STACK}`
        ctx.textAlign = "left"
        ctx.fillText(`BOX ${rs.box}`, rx + 8, rearY + 26)

        renderSeat(rs, rx + 60, rearY + 4, rearBoxW - 66, 36)
      })
    }
  } else {
    // ------------------------------------------
    // Seater (2x3-60)
    // ------------------------------------------
    const usableW = busShellW - 48
    const aisleW = 60
    const seatW = (usableW - aisleW) / 5
    const startX = busShellX + 24

    // Col X coords: Left 2 seats, Aisle, Right 3 seats
    const colX = [
      startX,
      startX + seatW,
      startX + seatW * 2, // Aisle
      startX + seatW * 2 + aisleW,
      startX + seatW * 3 + aisleW,
      startX + seatW * 4 + aisleW,
    ]

    // Headers
    ctx.fillStyle = "#64748b"
    ctx.font = `bold 11px ${DEFAULT_FONT_STACK}`
    ctx.textAlign = "center"
    ctx.fillText(i18n.leftWindow, colX[0] + seatW / 2, busInnerY + 22)
    ctx.fillText(i18n.leftAisle, colX[1] + seatW / 2, busInnerY + 22)
    ctx.fillText("||", colX[2] + aisleW / 2, busInnerY + 22)
    ctx.fillText(i18n.rightAisle, colX[3] + seatW / 2, busInnerY + 22)
    ctx.fillText(i18n.rightMiddle, colX[4] + seatW / 2, busInnerY + 22)
    ctx.fillText(i18n.rightWindow, colX[5] + seatW / 2, busInnerY + 22)

    busInnerY += COL_HEADERS_HEIGHT

    for (let r = 1; r <= rowsCount; r++) {
      const rowY = busInnerY + (r - 1) * (ROW_HEIGHT + ROW_GAP)
      const rowSeats = layout.seats.filter((s) => s.row === r)

      // Helper for Seater seat
      const renderSeaterBtn = (seat, sx, sy, sw, sh) => {
        if (!seat) return
        const isShared = sharedSet.has(seat.id)
        const occ = occupiedSeatsMap[seat.id]
        const isOccOther = !isShared && (occ?.status === "booked" || occ?.status === "held" || occ?.status === "blocked")

        if (isShared) {
          ctx.fillStyle = "#2563eb"
          ctx.strokeStyle = "#1d4ed8"
          ctx.lineWidth = 2
          drawRoundRect(ctx, sx, sy, sw, sh, 6, true, true)

          ctx.fillStyle = "#ffffff"
          ctx.font = `bold 13px ${DEFAULT_FONT_STACK}`
          ctx.textAlign = "center"
          ctx.fillText(`✓ #${seat.number}`, sx + sw / 2, sy + sh / 2 + 5)
        } else if (isOccOther) {
          ctx.fillStyle = "#f1f5f9"
          ctx.strokeStyle = "#cbd5e1"
          ctx.lineWidth = 1
          drawRoundRect(ctx, sx, sy, sw, sh, 6, true, true)
          drawDiagonalHatch(ctx, sx, sy, sw, sh, "#e2e8f0", 6)

          ctx.fillStyle = "#64748b"
          ctx.font = `bold 10px ${DEFAULT_FONT_STACK}`
          ctx.textAlign = "center"
          ctx.fillText(`🔒 ${i18n.bookedStatus}`, sx + sw / 2, sy + sh / 2 + 4)
        } else {
          ctx.fillStyle = "#ffffff"
          ctx.strokeStyle = "#e2e8f0"
          ctx.lineWidth = 1
          drawRoundRect(ctx, sx, sy, sw, sh, 6, true, true)

          ctx.fillStyle = "#475569"
          ctx.font = `bold 12px ${DEFAULT_FONT_STACK}`
          ctx.textAlign = "center"
          ctx.fillText(`#${seat.number}`, sx + sw / 2, sy + sh / 2 + 4)
        }
      }

      renderSeaterBtn(rowSeats.find((s) => s.col === 1), colX[0], rowY, seatW - 6, ROW_HEIGHT)
      renderSeaterBtn(rowSeats.find((s) => s.col === 2), colX[1], rowY, seatW - 6, ROW_HEIGHT)

      // Aisle
      ctx.fillStyle = "#cbd5e1"
      ctx.font = `bold 10px ${DEFAULT_FONT_STACK}`
      ctx.textAlign = "center"
      ctx.fillText(i18n.seaterAisle, colX[2] + aisleW / 2, rowY + ROW_HEIGHT / 2 + 4)

      renderSeaterBtn(rowSeats.find((s) => s.col === 4), colX[3], rowY, seatW - 6, ROW_HEIGHT)
      renderSeaterBtn(rowSeats.find((s) => s.col === 5), colX[4], rowY, seatW - 6, ROW_HEIGHT)
      renderSeaterBtn(rowSeats.find((s) => s.col === 6), colX[5], rowY, seatW - 6, ROW_HEIGHT)
    }
  }

  curY += BUS_CONTAINER_HEIGHT + 14

  // ==========================================
  // 3. LEGEND BAR
  // ==========================================
  const legendY = curY
  const legendW = CONTENT_WIDTH
  const legendH = 40

  ctx.fillStyle = "#f8fafc"
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 1
  drawRoundRect(ctx, MARGIN_X, legendY, legendW, legendH, 8, true, true)

  const legendCenterX = MARGIN_X + legendW / 2

  // Legend 1: Your Seat
  ctx.fillStyle = "#2563eb"
  drawRoundRect(ctx, legendCenterX - 240, legendY + 12, 16, 16, 4, true, false)
  ctx.fillStyle = "#0f172a"
  ctx.font = `bold 13px ${DEFAULT_FONT_STACK}`
  ctx.textAlign = "left"
  ctx.fillText(i18n.legendYourSeat, legendCenterX - 216, legendY + 25)

  // Legend 2: Booked
  ctx.fillStyle = "#f1f5f9"
  ctx.strokeStyle = "#cbd5e1"
  ctx.lineWidth = 1
  drawRoundRect(ctx, legendCenterX - 50, legendY + 12, 16, 16, 4, true, true)
  drawDiagonalHatch(ctx, legendCenterX - 50, legendY + 12, 16, 16, "#cbd5e1", 4)
  ctx.fillStyle = "#64748b"
  ctx.font = `bold 13px ${DEFAULT_FONT_STACK}`
  ctx.textAlign = "left"
  ctx.fillText(i18n.legendBooked, legendCenterX - 26, legendY + 25)

  // Legend 3: Available
  ctx.fillStyle = "#ffffff"
  ctx.strokeStyle = "#cbd5e1"
  ctx.lineWidth = 1
  drawRoundRect(ctx, legendCenterX + 120, legendY + 12, 16, 16, 4, true, true)
  ctx.fillStyle = "#64748b"
  ctx.font = `bold 13px ${DEFAULT_FONT_STACK}`
  ctx.textAlign = "left"
  ctx.fillText(i18n.legendAvailable, legendCenterX + 144, legendY + 25)

  curY += legendH + 16

  // ==========================================
  // 4. FOOTER & SUMMARY
  // ==========================================
  const footerY = curY
  const footerW = CONTENT_WIDTH
  const footerH = FOOTER_HEIGHT

  // Footer card
  ctx.fillStyle = "#f8fafc"
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 1.5
  drawRoundRect(ctx, MARGIN_X, footerY, footerW, footerH, 16, true, true)

  // Seat list string
  const formattedSeats = Array.from(sharedSet)
    .map((s) => {
      const match = layout.seats.find((ls) => ls.id === s)
      const num = match ? `#${match.number}` : ""
      const label = formatSeatLabel(s, { layoutKey: layout.key })
      return num ? `${label} (${num})` : label
    })
    .join(", ")

  ctx.fillStyle = "#0f172a"
  ctx.font = `bold 20px ${DEFAULT_FONT_STACK}`
  ctx.textAlign = "center"
  ctx.fillText(`${i18n.seats}: ${formattedSeats || "None"}`, MARGIN_X + footerW / 2, footerY + 38)

  let footerSubY = footerY + 70

  // Optional Balance line
  if (showBalance) {
    const totalAmount = booking.totalAmount || 0
    const advanceReceived = booking.advanceReceived || 0
    const balanceDue = Math.max(0, totalAmount - advanceReceived)

    if (balanceDue > 0) {
      ctx.fillStyle = "#dc2626"
      ctx.font = `bold 18px ${DEFAULT_FONT_STACK}`
      ctx.fillText(
        `${i18n.balanceDue}: ₹${balanceDue.toLocaleString("en-IN")}`,
        MARGIN_X + footerW / 2,
        footerSubY,
      )
    } else {
      ctx.fillStyle = "#16a34a"
      ctx.font = `bold 18px ${DEFAULT_FONT_STACK}`
      ctx.fillText(
        `✓ ${i18n.paidInFull} (₹${totalAmount.toLocaleString("en-IN")})`,
        MARGIN_X + footerW / 2,
        footerSubY,
      )
    }
    footerSubY += 34
  }

  // Happy Journey Greeting
  ctx.fillStyle = "#2563eb"
  ctx.font = `bold 18px ${DEFAULT_FONT_STACK}`
  ctx.fillText(i18n.happyJourney, MARGIN_X + footerW / 2, footerSubY)

  // Operator Contact Line
  if (companyPhone) {
    ctx.fillStyle = "#64748b"
    ctx.font = `14px ${DEFAULT_FONT_STACK}`
    ctx.fillText(
      `${i18n.contactMsg}: ${companyPhone}`,
      MARGIN_X + footerW / 2,
      footerSubY + 28,
    )
  }

  // ==========================================
  // Export to Blob
  // ==========================================
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Canvas toBlob failed"))
      }, "image/png")
    } else if (canvas.convertToBlob) {
      canvas.convertToBlob({ type: "image/png" }).then(resolve, reject)
    } else {
      reject(new Error("Canvas export not supported in this runtime"))
    }
  })
}

/**
 * Downloads a Blob as a PNG file in browser
 */
export function downloadSeatImage(blob, filename = "seat-confirmation.png") {
  if (typeof window === "undefined" || !blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Builds WhatsApp message text formatted with asterisks for bolding
 */
export function formatWhatsAppSeatMessage({
  departureInfo = {},
  booking = {},
  sharedSeatIds = [],
  operatorInfo = {},
  showBalance = false,
  lang = "en",
  customTemplate = "",
}) {
  const resolvedLayoutKey = booking.seatLayoutKey || departureInfo.layoutKey || DEFAULT_LAYOUT_KEY
  const layout = getSeatLayout(resolvedLayoutKey) || getSeatLayout(DEFAULT_LAYOUT_KEY)

  const companyName =
    operatorInfo.companyName || departureInfo.companyName || "YatraHub"
  const companyPhone =
    operatorInfo.phone ||
    departureInfo.companyPhone ||
    operatorInfo.companyPhone ||
    ""
  const tourName = departureInfo.tourName || booking.tourName || "Tour"
  const journeyDate = formatDisplayDate(
    departureInfo.journeyDate || departureInfo.dateStr || booking.journeyDate,
  )
  const busType = layout.label || booking.busType || "Bus"

  const sharedSet = new Set(
    (sharedSeatIds || []).map((s) => resolveSeatId(layout.key, s)),
  )

  const relevantPassengers = (booking.passengers || []).filter(
    (p) => p.seatId && sharedSet.has(resolveSeatId(layout.key, p.seatId)),
  )
  const passengerNames =
    relevantPassengers.length > 0
      ? relevantPassengers.map((p) => p.name).join(", ")
      : booking.contactName || "Valued Passenger"

  const pickupPoint =
    relevantPassengers[0]?.pickupPoint ||
    booking.pickupPoint ||
    relevantPassengers[0]?.city ||
    ""
  const pickupTime = relevantPassengers[0]?.pickupTime || booking.pickupTime || ""
  const pickupLine =
    pickupPoint && pickupTime
      ? `${pickupPoint} (${pickupTime})`
      : pickupPoint || pickupTime || "Scheduled pickup"

  const seatList = Array.from(sharedSet)
    .map((s) => {
      const match = layout.seats.find((ls) => ls.id === s)
      const num = match ? `#${match.number}` : ""
      const label = formatSeatLabel(s, { layoutKey: layout.key })
      return num ? `${label} (${num})` : label
    })
    .join(", ")

  let balanceLine = ""
  if (showBalance) {
    const total = booking.totalAmount || 0
    const advance = booking.advanceReceived || 0
    const bal = Math.max(0, total - advance)
    if (bal > 0) {
      balanceLine =
        lang === "gu"
          ? `💰 *બાકી રકમ:* ₹${bal.toLocaleString("en-IN")}`
          : lang === "hi"
            ? `💰 *बकाया राशि:* ₹${bal.toLocaleString("en-IN")}`
            : `💰 *Balance Due:* ₹${bal.toLocaleString("en-IN")}`
    } else {
      balanceLine =
        lang === "gu"
          ? `✅ *ચુકવણી સ્થિતિ:* સંપૂર્ણ ચૂકવેલ`
          : lang === "hi"
            ? `✅ *भुगतान स्थिति:* पूर्ण भुगतान`
            : `✅ *Payment Status:* Paid in Full`
    }
  }

  if (customTemplate && typeof customTemplate === "string" && customTemplate.trim()) {
    return customTemplate
      .replace(/\{companyName\}/g, companyName)
      .replace(/\{companyPhone\}/g, companyPhone)
      .replace(/\{passengerName\}/g, passengerNames)
      .replace(/\{tourName\}/g, tourName)
      .replace(/\{journeyDate\}/g, journeyDate)
      .replace(/\{busType\}/g, busType)
      .replace(/\{seatList\}/g, seatList)
      .replace(/\{pickupPoint\}/g, pickupPoint)
      .replace(/\{pickupTime\}/g, pickupTime)
      .replace(/\{balanceLine\}/g, balanceLine ? `\n${balanceLine}` : "")
  }

  if (lang === "gu") {
    return `*${companyName.toUpperCase()} - સીટ કન્ફર્મેશન*
નમસ્તે ${passengerNames},

તમારી *${tourName}* માટેની સીટ બુકિંગ કન્ફર્મ થઈ ગઈ છે!
📅 *પ્રવાસ તારીખ:* ${journeyDate}
🚌 *બસ:* ${busType}
💺 *સીટ નંબર:* ${seatList}
📍 *પીકઅપ સ્થળ:* ${pickupLine}${balanceLine ? `\n${balanceLine}` : ""}

આપની યાત્રા મંગલમય અને સુખદ રહે!
${companyPhone ? `વધુ માહિતી માટે સંપર્ક કરો: ${companyPhone}` : ""}`.trim()
  }

  if (lang === "hi") {
    return `*${companyName.toUpperCase()} - सीट पुष्टि*
नमस्ते ${passengerNames},

आपकी *${tourName}* के लिए सीट बुकिंग कन्फर्म हो गई है!
📅 *यात्रा दिनांक:* ${journeyDate}
🚌 *बस:* ${busType}
💺 *सीट संख्या:* ${seatList}
📍 *पिकअप स्थान:* ${pickupLine}${balanceLine ? `\n${balanceLine}` : ""}

आपकी यात्रा मंगलमय और सुखद हो!
${companyPhone ? `किसी भी सहायता के लिए संपर्क करें: ${companyPhone}` : ""}`.trim()
  }

  return `*${companyName.toUpperCase()} - SEAT CONFIRMATION*
Dear ${passengerNames},

Your seats for *${tourName}* are confirmed!
📅 *Journey Date:* ${journeyDate}
🚌 *Bus:* ${busType}
💺 *Seat(s):* ${seatList}
📍 *Pickup:* ${pickupLine}${balanceLine ? `\n${balanceLine}` : ""}

Wish you a happy and safe journey!
${companyPhone ? `For any queries, please contact: ${companyPhone}` : ""}`.trim()
}
