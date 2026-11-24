import express from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import SeatHold from "../models/SeatHold.js"
import Booking from "../models/Booking.js"
import { logAudit } from "../models/AuditLog.js"
import verifyToken from "../middleware/auth.js"
import { parseDepartureKey, getBusCondition } from "../utils/departureKey.js"
import { getSeatLayout, layoutKeyForBusType, resolveSeatId } from "../../shared/seatLayouts.js"
import { calculateBookingFinancials } from "../../shared/profitLoss.js"
import { validateIndianPhone } from "../../shared/businessLogic.js"

const router = express.Router()

/**
 * Dedicated rate limiters (SEC compliance):
 * - Read: 120 requests per 15 minutes
 * - Write: 60 requests per 15 minutes
 */
export const seatMapReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { message: "Too many seat map requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

export const seatHoldWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: "Too many seat hold requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

// Validation schemas
const createSeatHoldSchema = z
  .object({
    key: z.string().optional(),
    tourName: z.string().min(1).max(100).optional(),
    journeyDate: z.string().min(1).optional(),
    busType: z.string().optional(),
    seatIds: z.array(z.string().min(1)).min(1, "At least one seat ID is required"),
    mode: z.enum(["timed", "manual"]),
    durationMinutes: z.number().int().min(5).max(43200).optional(),
    kind: z.enum(["hold", "block"]).default("hold"),
    holderName: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    note: z.string().max(200).optional(),
  })
  .refine(
    (data) => {
      if (data.mode === "timed") {
        return typeof data.durationMinutes === "number" && data.durationMinutes >= 5 && data.durationMinutes <= 43200
      }
      return true
    },
    {
      message: "Timed hold requires durationMinutes between 5 and 43200 (up to 30 days)",
      path: ["durationMinutes"],
    },
  )

const extendSeatHoldSchema = z.object({
  durationMinutes: z.number().int().min(5).max(43200),
})

const convertModeSchema = z
  .object({
    mode: z.enum(["timed", "manual"]),
    durationMinutes: z.number().int().min(5).max(43200).optional(),
  })
  .refine(
    (data) => {
      if (data.mode === "timed") {
        return typeof data.durationMinutes === "number" && data.durationMinutes >= 5 && data.durationMinutes <= 43200
      }
      return true
    },
    {
      message: "Switching to timed mode requires durationMinutes between 5 and 43200",
      path: ["durationMinutes"],
    },
  )

/**
 * Controller: GET /api/departures/:key/seat-map
 */
export async function getDepartureSeatMap(req, res) {
  try {
    const dep = parseDepartureKey(req.params.key)
    if (!dep) {
      return res.status(400).json({ error: "Invalid departure key format. Expected <tourName>___<dateKey>___<busType>" })
    }

    const { tourName, dateStr, busType, start, end } = dep
    const layoutKey = layoutKeyForBusType(busType)
    const layout = getSeatLayout(layoutKey)

    if (!layout) {
      return res.status(400).json({ error: `No seat layout definition found for bus type "${busType}".` })
    }

    const busCondition = getBusCondition(busType)

    // 1. Fetch active non-cancelled bookings
    const bookings = await Booking.find({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
      status: { $nin: ["Cancelled", "cancelled"] },
      deletedAt: null,
      ...busCondition,
    }).lean()

    // 2. Fetch currently effective holds
    const now = new Date()
    const activeHolds = await SeatHold.find({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
      status: "active",
      ...busCondition,
      $or: [{ mode: "manual" }, { expiresAt: { $gt: now } }],
    }).lean()

    // Build lookup maps
    const bookedSeats = new Map() // canonicalId -> seat detail
    for (const b of bookings) {
      const bLayoutKey = layoutKeyForBusType(b.busType || busType)
      const fin = calculateBookingFinancials(b)
      const total = Math.round(Number(b.totalAmount || 0) * 100) / 100
      const balance = Math.round(Number(fin.outstanding || fin.balanceDue || 0) * 100) / 100
      const paid = Math.round(Number(fin.collected || fin.totalPaid || 0) * 100) / 100

      let paymentState = "unpaid"
      if (total > 0 && balance <= 0.01) {
        paymentState = "paid"
      } else if (paid > 0 && balance > 0.01) {
        paymentState = "partial"
      } else if (total === 0) {
        paymentState = "paid"
      }

      for (const p of b.passengers || []) {
        const rawSeat = p.seatId || p.seatNumber
        if (!rawSeat) continue
        const canonical = resolveSeatId(bLayoutKey, rawSeat)
        bookedSeats.set(canonical, {
          status: "booked",
          seatId: canonical,
          originalSeatId: rawSeat,
          bookingId: b._id.toString(),
          bookingRef: b.invoiceNo,
          passengerName: p.name,
          gender: p.gender || "Other",
          age: p.age || null,
          pickupPoint: b.pickupPoint || p.pickupPoint || p.city || "",
          city: p.city || "",
          contactPhone: p.contact || b.contactPhone || "",
          contactName: b.contactName || "",
          groupId: b._id.toString(),
          paymentState,
          balanceDue: balance,
          totalAmount: total,
          paxId: (p._id || "").toString(),
          checkedIn: Boolean(p.checkedIn),
        })
      }
    }

    const heldSeats = new Map() // canonicalId -> hold detail
    for (const h of activeHolds) {
      const hLayoutKey = h.seatLayoutKey || layoutKey
      for (const s of h.seatIds || []) {
        const canonical = resolveSeatId(hLayoutKey, s)
        heldSeats.set(canonical, {
          status: h.kind === "block" ? "blocked" : "held",
          seatId: canonical,
          holdId: h._id.toString(),
          kind: h.kind,
          holderName: h.holderName || "",
          phone: h.phone || "",
          note: h.note || "",
          mode: h.mode,
          expiresAt: h.expiresAt ? h.expiresAt.toISOString() : null,
          createdAt: h.createdAt ? h.createdAt.toISOString() : null,
        })
      }
    }

    // Assemble comprehensive seat status map
    const seatsData = {}
    let availableCount = 0
    let bookedCount = 0
    let heldCount = 0
    let blockedCount = 0

    for (const seat of layout.seats) {
      const canonical = seat.id
      let seatInfo = null

      if (bookedSeats.has(canonical)) {
        seatInfo = {
          ...bookedSeats.get(canonical),
          seatName: seat.name,
          seatNumber: seat.number,
          deck: seat.deck,
          cabin: seat.cabin,
        }
        bookedCount++
      } else if (heldSeats.has(canonical)) {
        const hInfo = heldSeats.get(canonical)
        seatInfo = {
          ...hInfo,
          seatName: seat.name,
          seatNumber: seat.number,
          deck: seat.deck,
          cabin: seat.cabin,
        }
        if (hInfo.kind === "block") blockedCount++
        else heldCount++
      } else {
        seatInfo = {
          status: "available",
          seatId: canonical,
          seatName: seat.name,
          seatNumber: seat.number,
          deck: seat.deck,
          cabin: seat.cabin,
        }
        availableCount++
      }

      seatsData[canonical] = seatInfo
    }

    res.setHeader("Cache-Control", "no-store")
    res.json({
      departureKey: req.params.key,
      tourName,
      journeyDate: dateStr,
      busType,
      layoutKey,
      category: layout.category,
      totalSeats: layout.totalSeats,
      counts: {
        total: layout.totalSeats,
        available: availableCount,
        booked: bookedCount,
        held: heldCount,
        blocked: blockedCount,
      },
      seats: seatsData,
    })
  } catch (error) {
    console.error("Error generating departure seat map:", error)
    res.status(500).json({ message: "Failed to generate seat map" })
  }
}

/**
 * Controller: GET /api/departures/:key/seat-holds
 */
export async function getDepartureSeatHolds(req, res) {
  try {
    const dep = parseDepartureKey(req.params.key)
    if (!dep) {
      return res.status(400).json({ error: "Invalid departure key format. Expected <tourName>___<dateKey>___<busType>" })
    }

    const { tourName, start, end, busType } = dep
    const busCondition = getBusCondition(busType)

    const holds = await SeatHold.find({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
      ...busCondition,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    const now = new Date()
    const enriched = holds.map((h) => {
      const isEffective = h.status === "active" && (h.mode === "manual" || (h.expiresAt && new Date(h.expiresAt) > now))
      return {
        ...h,
        isEffective,
      }
    })

    res.setHeader("Cache-Control", "no-store")
    res.json(enriched)
  } catch (error) {
    console.error("Error listing departure seat holds:", error)
    res.status(500).json({ message: "Failed to list seat holds" })
  }
}

/**
 * POST /api/seat-holds
 * Create a new hold or block for 1..N seats
 */
router.post("/", seatHoldWriteLimiter, verifyToken, async (req, res) => {
  try {
    const parseResult = createSeatHoldSchema.safeParse(req.body)
    if (!parseResult.success) {
      const err = parseResult.error.errors[0]
      return res.status(400).json({ message: err ? `${err.path.join(".")}: ${err.message}` : "Validation failed" })
    }

    const data = parseResult.data
    let tourName = data.tourName
    let journeyDateStr = data.journeyDate
    let busType = data.busType || ""

    if (data.key) {
      const parsed = parseDepartureKey(data.key)
      if (parsed) {
        tourName = tourName || parsed.tourName
        journeyDateStr = journeyDateStr || parsed.dateStr
        busType = busType || parsed.busType
      }
    }

    if (!tourName || !journeyDateStr) {
      return res.status(400).json({ message: "tourName and journeyDate (or a valid departure key) are required." })
    }

    const dep = parseDepartureKey(`${tourName}___${journeyDateStr}___${busType || "2x1 Sleeper Luxury"}`)
    if (!dep) {
      return res.status(400).json({ message: "Invalid departure information." })
    }

    const { start, end } = dep
    const layoutKey = layoutKeyForBusType(busType)
    const layout = getSeatLayout(layoutKey)

    if (!layout) {
      return res.status(400).json({ message: `No seat layout definition found for bus type "${busType}".` })
    }

    // Validate phone if provided
    if (data.phone && data.phone.trim()) {
      if (!validateIndianPhone(data.phone.trim())) {
        return res.status(400).json({ message: "Please provide a valid 10-digit Indian phone number." })
      }
    }

    // Resolve canonical seat IDs and ensure every seat exists in layout
    const canonicalSeatIds = []
    for (const rawId of data.seatIds) {
      const canonical = resolveSeatId(layoutKey, rawId)
      const exists = layout.seats.some((s) => s.id === canonical)
      if (!exists) {
        return res.status(400).json({ message: `Seat "${rawId}" does not exist in this coach layout.` })
      }
      if (!canonicalSeatIds.includes(canonical)) {
        canonicalSeatIds.push(canonical)
      }
    }

    const busCondition = getBusCondition(busType)

    // 1. Check if any seat is already booked
    const activeBookings = await Booking.find({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
      status: { $nin: ["Cancelled", "cancelled"] },
      deletedAt: null,
      ...busCondition,
    }).lean()

    const bookedConflicts = []
    for (const b of activeBookings) {
      const bLayoutKey = layoutKeyForBusType(b.busType || busType)
      for (const p of b.passengers || []) {
        if (!p.seatId) continue
        const canon = resolveSeatId(bLayoutKey, p.seatId)
        if (canonicalSeatIds.includes(canon)) {
          bookedConflicts.push(p.seatId)
        }
      }
    }

    if (bookedConflicts.length > 0) {
      return res.status(409).json({
        code: "SEAT_CONFLICT",
        message: `Seat(s) ${bookedConflicts.join(", ")} are already booked on this departure.`,
        conflictingSeats: bookedConflicts,
      })
    }

    // 2. Check if any seat is already effectively held or blocked
    const now = new Date()
    const activeHolds = await SeatHold.find({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
      status: "active",
      ...busCondition,
      $or: [{ mode: "manual" }, { expiresAt: { $gt: now } }],
    }).lean()

    const holdConflicts = []
    for (const h of activeHolds) {
      const hLayout = h.seatLayoutKey || layoutKey
      for (const s of h.seatIds || []) {
        const canon = resolveSeatId(hLayout, s)
        if (canonicalSeatIds.includes(canon)) {
          holdConflicts.push(s)
        }
      }
    }

    if (holdConflicts.length > 0) {
      return res.status(409).json({
        code: "SEAT_HELD",
        message: `Seat(s) ${holdConflicts.join(", ")} are already held or blocked on this departure.`,
        conflictingSeats: holdConflicts,
      })
    }

    // Calculate expiry
    let expiresAt = null
    if (data.mode === "timed") {
      expiresAt = new Date(Date.now() + data.durationMinutes * 60 * 1000)
    }

    const newHold = new SeatHold({
      userId: req.user.id,
      tourName,
      journeyDate: dep.start,
      busType,
      seatLayoutKey: layoutKey,
      seatIds: canonicalSeatIds,
      mode: data.mode,
      expiresAt,
      kind: data.kind || "hold",
      holderName: data.holderName ? data.holderName.trim() : "",
      phone: data.phone ? data.phone.trim() : "",
      note: data.note ? data.note.trim() : "",
      status: "active",
    })

    const savedHold = await newHold.save()

    // Operational audit logging without PII
    await logAudit({
      userId: req.user.id,
      action: data.kind === "block" ? "seat_block_created" : "seat_hold_created",
      category: "seat_management",
      entityType: "SeatHold",
      entityId: savedHold._id,
      description: `${data.kind === "block" ? "Blocked" : "Held"} ${canonicalSeatIds.length} seat(s) (${canonicalSeatIds.join(", ")}) for ${tourName} on ${journeyDateStr}`,
      metadata: {
        tourName,
        journeyDate: journeyDateStr,
        busType,
        seatIds: canonicalSeatIds,
        mode: data.mode,
        kind: data.kind || "hold",
        holderName: data.holderName ? data.holderName.trim() : undefined,
        expiresAt,
      },
    })

    res.status(201).json(savedHold)
  } catch (error) {
    console.error("Error creating seat hold:", error)
    res.status(500).json({ message: "Failed to create seat hold" })
  }
})

/**
 * PATCH /api/seat-holds/:id/extend
 * Extend a timed hold (timed only; new duration from now)
 */
router.patch("/:id/extend", seatHoldWriteLimiter, verifyToken, async (req, res) => {
  try {
    const parseResult = extendSeatHoldSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ message: parseResult.error.errors[0]?.message || "Invalid durationMinutes" })
    }

    const hold = await SeatHold.findOne({ _id: req.params.id, userId: req.user.id })
    if (!hold) {
      return res.status(404).json({ message: "Seat hold not found" })
    }

    if (hold.status !== "active") {
      return res.status(400).json({ message: `Cannot extend hold with status "${hold.status}".` })
    }

    if (hold.mode !== "timed") {
      return res.status(400).json({ message: "Only timed holds can be extended." })
    }

    const newExpiresAt = new Date(Date.now() + parseResult.data.durationMinutes * 60 * 1000)
    hold.expiresAt = newExpiresAt
    await hold.save()

    await logAudit({
      userId: req.user.id,
      action: "seat_hold_extended",
      category: "seat_management",
      entityType: "SeatHold",
      entityId: hold._id,
      description: `Extended hold on ${hold.seatIds.length} seat(s) by ${parseResult.data.durationMinutes} minutes`,
      metadata: {
        holdId: hold._id,
        newExpiresAt,
      },
    })

    res.json(hold)
  } catch (error) {
    console.error("Error extending seat hold:", error)
    res.status(500).json({ message: "Failed to extend seat hold" })
  }
})

/**
 * PATCH /api/seat-holds/:id/convert-mode
 * Convert between timed and manual hold modes
 */
router.patch("/:id/convert-mode", seatHoldWriteLimiter, verifyToken, async (req, res) => {
  try {
    const parseResult = convertModeSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ message: parseResult.error.errors[0]?.message || "Validation failed" })
    }

    const hold = await SeatHold.findOne({ _id: req.params.id, userId: req.user.id })
    if (!hold) {
      return res.status(404).json({ message: "Seat hold not found" })
    }

    if (hold.status !== "active") {
      return res.status(400).json({ message: `Cannot convert mode of hold with status "${hold.status}".` })
    }

    const targetMode = parseResult.data.mode
    hold.mode = targetMode

    if (targetMode === "manual") {
      hold.expiresAt = null
    } else {
      hold.expiresAt = new Date(Date.now() + (parseResult.data.durationMinutes || 60) * 60 * 1000)
    }

    await hold.save()

    await logAudit({
      userId: req.user.id,
      action: "seat_hold_mode_converted",
      category: "seat_management",
      entityType: "SeatHold",
      entityId: hold._id,
      description: `Converted hold to ${targetMode} mode`,
      metadata: {
        holdId: hold._id,
        mode: targetMode,
        expiresAt: hold.expiresAt,
      },
    })

    res.json(hold)
  } catch (error) {
    console.error("Error converting hold mode:", error)
    res.status(500).json({ message: "Failed to convert hold mode" })
  }
})

/**
 * POST /api/seat-holds/:id/release
 * Release an active hold or block immediately
 */
router.post("/:id/release", seatHoldWriteLimiter, verifyToken, async (req, res) => {
  try {
    const hold = await SeatHold.findOne({ _id: req.params.id, userId: req.user.id })
    if (!hold) {
      return res.status(404).json({ message: "Seat hold not found" })
    }

    if (hold.status === "released") {
      return res.status(400).json({ message: "Seat hold is already released." })
    }

    hold.status = "released"
    hold.releasedAt = new Date()
    await hold.save()

    await logAudit({
      userId: req.user.id,
      action: hold.kind === "block" ? "seat_block_released" : "seat_hold_released",
      category: "seat_management",
      entityType: "SeatHold",
      entityId: hold._id,
      description: `Released ${hold.kind} on ${hold.seatIds.length} seat(s) (${hold.seatIds.join(", ")})`,
      metadata: {
        holdId: hold._id,
        kind: hold.kind,
        seatIds: hold.seatIds,
      },
    })

    res.json(hold)
  } catch (error) {
    console.error("Error releasing seat hold:", error)
    res.status(500).json({ message: "Failed to release seat hold" })
  }
})

export default router
