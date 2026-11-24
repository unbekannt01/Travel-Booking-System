import express from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import DepartureSeatConfig from "../models/DepartureSeatConfig.js"
import { logAudit } from "../models/AuditLog.js"
import verifyToken from "../middleware/auth.js"
import { parseDepartureKey, getBusCondition } from "../utils/departureKey.js"
import { getSeatLayout, layoutKeyForBusType, resolveSeatId } from "../../shared/seatLayouts.js"

const router = express.Router({ mergeParams: true })

/**
 * Dedicated rate limiters (SEC compliance):
 * - Read: 120 requests per 15 minutes
 * - Write: 60 requests per 15 minutes
 */
export const seatConfigReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { message: "Too many seat config requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

export const seatConfigWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: "Too many seat config updates. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

// Validation Schema for DepartureSeatConfig
const updateSeatConfigSchema = z.object({
  ladiesSeats: z.array(z.string()).default([]),
  couplePairs: z
    .array(
      z.object({
        a: z.string().min(1, "Pair seat A is required"),
        b: z.string().min(1, "Pair seat B is required"),
      }),
    )
    .default([]),
  fares: z
    .object({
      lower: z.number().int().min(0).max(10000000).default(0),
      upper: z.number().int().min(0).max(10000000).default(0),
      rear: z.number().int().min(0).max(10000000).default(0),
      seat: z.number().int().min(0).max(10000000).default(0),
    })
    .default({ lower: 0, upper: 0, rear: 0, seat: 0 }),
})

/**
 * GET /api/departures/:key/seat-config
 * Fetches the departure seat configuration (ladies seats, couple pairs, fare presets).
 */
router.get("/", seatConfigReadLimiter, verifyToken, async (req, res) => {
  try {
    const rawKey = req.params.key
    const dep = parseDepartureKey(rawKey)
    if (!dep) {
      return res.status(400).json({ error: "Invalid departure key format." })
    }

    const { tourName, busType, start, end } = dep
    const busCondition = getBusCondition(busType)

    const config = await DepartureSeatConfig.findOne({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
      ...busCondition,
    }).lean()

    res.setHeader("Cache-Control", "no-store")
    return res.json({
      success: true,
      departureKey: rawKey,
      config: config
        ? {
            ladiesSeats: config.ladiesSeats || [],
            couplePairs: config.couplePairs || [],
            fares: config.fares || { lower: 0, upper: 0, rear: 0, seat: 0 },
            updatedAt: config.updatedAt,
          }
        : {
            ladiesSeats: [],
            couplePairs: [],
            fares: { lower: 0, upper: 0, rear: 0, seat: 0 },
            updatedAt: null,
          },
    })
  } catch (error) {
    console.error("Error fetching departure seat config:", error)
    return res.status(500).json({ message: "Failed to fetch departure seat config" })
  }
})

/**
 * PUT /api/departures/:key/seat-config
 * Replaces the departure seat configuration (ladies seats, couple pairs, fare presets).
 */
router.put("/", seatConfigWriteLimiter, verifyToken, async (req, res) => {
  try {
    const rawKey = req.params.key
    const dep = parseDepartureKey(rawKey)
    if (!dep) {
      return res.status(400).json({ error: "Invalid departure key format." })
    }

    const parseResult = updateSeatConfigSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        message: "Invalid seat config data",
        errors: parseResult.error.flatten(),
      })
    }

    const { ladiesSeats, couplePairs, fares } = parseResult.data
    const { tourName, dateStr, busType, start, end } = dep
    const layoutKey = layoutKeyForBusType(busType)
    const layout = getSeatLayout(layoutKey)

    if (!layout) {
      return res.status(400).json({ error: `No seat layout definition found for bus type "${busType}".` })
    }

    // 1. Validate ladies seat IDs against layout
    const canonicalLadies = []
    for (const rawSeat of ladiesSeats) {
      const canonical = resolveSeatId(layoutKey, rawSeat)
      const seatExists = layout.seats.some((s) => s.id === canonical)
      if (!seatExists) {
        return res.status(400).json({
          message: `Invalid seat ID "${rawSeat}" for layout "${layout.label}".`,
        })
      }
      if (!canonicalLadies.includes(canonical)) {
        canonicalLadies.push(canonical)
      }
    }

    // 2. Validate couple pairs: a !== b, both exist, no seat in multiple pairs
    const canonicalPairs = []
    const pairedSeatsSet = new Set()

    for (const pair of couplePairs) {
      const canA = resolveSeatId(layoutKey, pair.a)
      const canB = resolveSeatId(layoutKey, pair.b)

      if (canA === canB) {
        return res.status(400).json({
          message: `Couple pair cannot link seat "${pair.a}" to itself.`,
        })
      }

      const existsA = layout.seats.some((s) => s.id === canA)
      const existsB = layout.seats.some((s) => s.id === canB)
      if (!existsA || !existsB) {
        return res.status(400).json({
          message: `Couple pair contains invalid seat ID(s): "${pair.a}" or "${pair.b}".`,
        })
      }

      if (pairedSeatsSet.has(canA) || pairedSeatsSet.has(canB)) {
        return res.status(400).json({
          message: `Seat "${pairedSeatsSet.has(canA) ? pair.a : pair.b}" is already part of another couple pair.`,
        })
      }

      pairedSeatsSet.add(canA)
      pairedSeatsSet.add(canB)
      canonicalPairs.push({ a: canA, b: canB })
    }

    // 3. Atomically upsert departure seat config
    const busCondition = getBusCondition(busType)
    let config = await DepartureSeatConfig.findOne({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
      ...busCondition,
    })

    if (!config) {
      config = new DepartureSeatConfig({
        userId: req.user.id,
        tourName,
        journeyDate: new Date(dateStr),
        busType,
        ladiesSeats: canonicalLadies,
        couplePairs: canonicalPairs,
        fares,
        updatedAt: new Date(),
      })
    } else {
      config.ladiesSeats = canonicalLadies
      config.couplePairs = canonicalPairs
      config.fares = fares
      config.updatedAt = new Date()
    }

    await config.save()

    // 4. Audit logging
    await logAudit({
      userId: req.user.id,
      action: "SEAT_CONFIG_UPDATED",
      req,
      meta: {
        departureKey: rawKey,
        tourName,
        dateStr,
        busType,
        ladiesCount: canonicalLadies.length,
        couplePairsCount: canonicalPairs.length,
        fares,
      },
    })

    res.setHeader("Cache-Control", "no-store")
    return res.json({
      success: true,
      departureKey: rawKey,
      config: {
        ladiesSeats: config.ladiesSeats,
        couplePairs: config.couplePairs,
        fares: config.fares,
        updatedAt: config.updatedAt,
      },
    })
  } catch (error) {
    console.error("Error updating departure seat config:", error)
    return res.status(500).json({ message: "Failed to update departure seat config" })
  }
})

export default router
