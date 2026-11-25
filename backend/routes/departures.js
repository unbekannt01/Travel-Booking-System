import express from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import verifyToken from "../middleware/auth.js"
import Booking from "../models/Booking.js"
import User from "../models/User.js"
import { logAudit } from "../models/AuditLog.js"
import { decryptAadhaar } from "../utils/aadhaar.js"
import { getDayBounds } from "../../shared/businessLogic.js"
import { parseDepartureKey, getBusCondition } from "../utils/departureKey.js"
import { getDepartureSeatMap, getDepartureSeatHolds, seatMapReadLimiter } from "./seatHolds.js"
import seatConfigRoutes from "./seatConfig.js"

export { parseDepartureKey, getBusCondition }

const router = express.Router()

/**
 * General rate limiter for reading departure data (120 req / 15 min).
 */
export const departureReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { message: "Too many departure requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Dedicated strict rate limiter for manifests that contain decrypted Aadhaar (10 req / 15 min).
 */
export const manifestAadhaarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.user?.id || req.ip}-manifest-aadhaar`,
  message: { message: "Too many Aadhaar manifest requests. Maximum 10 per 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
})

const manifestQuerySchema = z.object({
  columns: z.string().optional(),
  aadhaar: z.enum(["yes", "no", "true", "false"]).optional(),
  sort: z.enum(["seat", "name", "booking"]).optional(),
  aadhaarMode: z.enum(["full", "last4"]).optional(),
})

/**
 * GET /api/departures
 * Lists active departures grouped by Tour, Date, and Bus Type.
 */
router.get("/", verifyToken, departureReadLimiter, async (req, res) => {
  try {
    const bookings = await Booking.find({
      userId: req.user.id,
      status: { $nin: ["Cancelled", "cancelled"] },
      deletedAt: null,
    }).sort({ journeyDate: 1 })

    const departureMap = new Map()

    for (const b of bookings) {
      if (!b.tourName || !b.journeyDate) continue
      const { dateStr } = getDayBounds(b.journeyDate)
      const bus = b.busType || "2x1 Sleeper Luxury"
      const key = `${b.tourName}___${dateStr}___${bus}`

      if (!departureMap.has(key)) {
        departureMap.set(key, {
          key,
          tourName: b.tourName,
          journeyDate: b.journeyDate,
          dateStr,
          busType: bus,
          totalPax: 0,
          checkedInPax: 0,
          bookingsCount: 0,
        })
      }

      const dep = departureMap.get(key)
      dep.bookingsCount += 1
      for (const p of b.passengers || []) {
        dep.totalPax += 1
        if (p.checkedIn) dep.checkedInPax += 1
      }
    }

    const departures = Array.from(departureMap.values()).sort(
      (a, b) => new Date(a.journeyDate) - new Date(b.journeyDate),
    )

    return res.json({ success: true, departures })
  } catch (err) {
    console.error("Error listing departures:", err)
    return res.status(500).json({ error: "Failed to list departures" })
  }
})

/**
 * GET /api/departures/:key/manifest
 * Returns passenger manifest data for a specific departure.
 */
router.get("/:key/manifest", verifyToken, departureReadLimiter, async (req, res) => {
  try {
    const parsedQuery = manifestQuerySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parsedQuery.error.flatten(),
      })
    }

    const wantsAadhaar =
      parsedQuery.data.aadhaar === "yes" || parsedQuery.data.aadhaar === "true"

    // Gated check for strict Aadhaar rate limiting
    if (wantsAadhaar) {
      let limitHit = false
      await new Promise((resolve) => {
        manifestAadhaarLimiter(req, res, (err) => {
          if (err) limitHit = true
          resolve()
        })
      })
      if (res.headersSent || limitHit) return
    }

    res.setHeader("Cache-Control", "no-store")

    const rawKey = req.params.key
    const dep = parseDepartureKey(rawKey)
    if (!dep) {
      return res.status(400).json({
        error: "Invalid departure key format. Expected <tourName>___<dateKey>___<busType>",
      })
    }

    const { tourName, dateStr, start, end, busType } = dep
    const busCondition = getBusCondition(busType)

    const bookings = await Booking.find({
      userId: req.user.id,
      tourName,
      journeyDate: { $gte: start, $lte: end },
      status: { $nin: ["Cancelled", "cancelled"] },
      deletedAt: null,
      ...busCondition,
    }).sort({ createdAt: 1 })

    const columnsList = parsedQuery.data.columns
      ? parsedQuery.data.columns.split(",").map((s) => s.trim())
      : []

    const shouldDecryptAadhaar =
      wantsAadhaar && (columnsList.length === 0 || columnsList.includes("aadhaar"))

    const passengers = []

    for (const b of bookings) {
      const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
      const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
      const isPaid = !isCancelled && (b.isPaid || balance === 0)
      const paymentStatus = isCancelled ? "Cancelled" : isPaid ? "Paid" : "Pending"

      for (const p of b.passengers || []) {
        const aadharVal = p.aadhar !== undefined ? p.aadhar : p.aadhaar
        const aadharEnc =
          p.aadharEncrypted !== undefined ? p.aadharEncrypted : p.aadhaarEncrypted

        let decryptedAadhaar = ""
        if (shouldDecryptAadhaar && aadharVal) {
          decryptedAadhaar = aadharEnc ? decryptAadhaar(aadharVal) : aadharVal
        }

        const pCount = (b.passengers || []).length || 1
        const pFare = p.fare !== undefined ? p.fare : Math.round((b.totalAmount || 0) / pCount)
        const pPaid = p.paid !== undefined ? p.paid : Math.round((b.advanceReceived || 0) / pCount)
        const pBalance = Math.max(0, pFare - pPaid)

        passengers.push({
          id: p._id || p.id,
          bookingId: b._id || b.id,
          bookingRef: b.invoiceNo || "",
          name: p.name || "",
          seat: p.seatId || "",
          seatId: p.seatId || "",
          gender: p.gender || "",
          age: p.age !== undefined && p.age !== null ? p.age : "",
          mobile: p.contact || b.contactPhone || "",
          city: p.city || "",
          pickup: p.pickupPoint || b.pickupPoint || "",
          pickupPoint: p.pickupPoint || b.pickupPoint || "",
          pickupTime: p.pickupTime || b.pickupTime || "",
          groupId: b.groupId ? String(b.groupId) : (pCount > 1 ? `booking-${b._id || b.id}` : null),
          groupName: b.groupName || (pCount > 1 ? `${(b.passengers[0]?.name || b.contactName || "Traveler")} + ${pCount - 1}` : ""),
          fare: pFare,
          paid: pPaid,
          balance: pBalance,
          balanceDue: balance,
          paymentStatus,
          isPaid,
          aadhaar: shouldDecryptAadhaar ? decryptedAadhaar : "",
          boarded: Boolean(p.checkedIn),
          remarks: "",
        })
      }
    }

    // Operational audit logging - strictly without PII
    await logAudit({
      userId: req.user.id,
      action: "MANIFEST_ACCESSED",
      req,
      meta: {
        departureKey: rawKey,
        passengerCount: passengers.length,
        columns: columnsList,
        aadhaar: wantsAadhaar,
      },
    })

    const user = await User.findById(req.user.id).select(
      "companyName phone address email",
    )

    return res.json({
      success: true,
      departure: {
        key: rawKey,
        tourName,
        dateStr,
        busType,
        companyName: user?.companyName || "YATRA HUB",
        companyPhone: user?.phone || "",
        companyAddress: user?.address || "",
        totalPax: passengers.length,
      },
      passengers,
    })
  } catch (err) {
    console.error("Error fetching departure manifest:", err)
    return res.status(500).json({ error: "Failed to generate departure manifest" })
  }
})

// GET /api/departures/:key/seat-map
router.get("/:key/seat-map", seatMapReadLimiter, verifyToken, getDepartureSeatMap)

// GET /api/departures/:key/seat-holds
router.get("/:key/seat-holds", seatMapReadLimiter, verifyToken, getDepartureSeatHolds)

// GET & PUT /api/departures/:key/seat-config
router.use("/:key/seat-config", seatConfigRoutes)

export default router
