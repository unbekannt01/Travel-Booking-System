/**
 * Passenger Exchange Routes (Part 6X)
 *
 * Implements export and departure lookup for exchange with yatriDesk (SeatDesk v18).
 * Tenant isolated, rate-limited, Aadhaar decrypt audit-logged.
 */

import express from "express"
import rateLimit from "express-rate-limit"
import verifyToken from "../middleware/auth.js"
import Booking from "../models/Booking.js"
import Payment from "../models/Payment.js"
import Tour from "../models/Tour.js"
import { logAudit } from "../models/AuditLog.js"
import { decryptAadhaar } from "../utils/aadhaar.js"
import { getDayBounds, round2 } from "../../shared/businessLogic.js"
import { getBusCondition } from "../utils/departureKey.js"
import {
  EXCHANGE_FORMAT,
  EXCHANGE_VERSION,
  SUPPORTED_LAYOUT,
  CANONICAL_BUS_TYPE,
  derivePassengerFares,
} from "../../shared/passengerExchange.js"
import { layoutKeyForBusType, resolveSeatId } from "../../shared/seatLayouts.js"
import { normalizeIndianMobile } from "../../shared/customers.js"

const router = express.Router()

// Dedicated rate limiter for exchange export (30 requests / 15 min)
export const exchangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: "Too many passenger exchange requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

function toDateStr(d) {
  if (!d) return ""
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10)
}

/**
 * GET /api/exchange/departures
 * Lists 48-berth departures available for exchange export.
 */
router.get("/departures", verifyToken, exchangeLimiter, async (req, res) => {
  try {
    const userId = req.user.id
    const busCondition = getBusCondition(CANONICAL_BUS_TYPE)

    const bookings = await Booking.find({
      userId,
      status: "Confirmed",
      deletedAt: null,
      ...busCondition,
    }).select("tourName journeyDate busType seatLayoutKey passengers totalAmount").lean()

    const departuresMap = new Map()

    for (const b of bookings) {
      const layout = layoutKeyForBusType(b.busType || b.seatLayoutKey)
      if (layout !== SUPPORTED_LAYOUT) continue

      const dateStr = toDateStr(b.journeyDate)
      const depKey = `${b.tourName}___${dateStr}___${CANONICAL_BUS_TYPE}`

      if (!departuresMap.has(depKey)) {
        departuresMap.set(depKey, {
          departureKey: depKey,
          tourName: b.tourName,
          journeyDate: dateStr,
          busType: CANONICAL_BUS_TYPE,
          layout: SUPPORTED_LAYOUT,
          bookingCount: 0,
          passengerCount: 0,
        })
      }

      const dep = departuresMap.get(depKey)
      dep.bookingCount++
      dep.passengerCount += b.passengers?.length || 0
    }

    const departures = Array.from(departuresMap.values()).sort((a, b) =>
      b.journeyDate.localeCompare(a.journeyDate)
    )

    res.json({ departures })
  } catch (err) {
    console.error("Fetch exchange departures error:", err.name)
    res.status(500).json({ message: "Failed to fetch departures for exchange." })
  }
})

/**
 * GET /api/exchange/passengers
 * Exports passenger data for yatriDesk in format 'yatri-passengers' v1.
 */
router.get("/passengers", verifyToken, exchangeLimiter, async (req, res) => {
  try {
    const userId = req.user.id
    const { tourName, startDate, endDate, departureKey } = req.query
    const includeAadhaar = req.query.includeAadhaar === "true"

    // Date range validation (max 366 days)
    if (startDate && endDate) {
      const dStart = new Date(startDate)
      const dEnd = new Date(endDate)
      if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Expected YYYY-MM-DD." })
      }
      const diffMs = dEnd.getTime() - dStart.getTime()
      if (diffMs < 0) {
        return res.status(400).json({ message: "Start date must be before or equal to end date." })
      }
      if (diffMs > 366 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ message: "Date range cannot exceed 366 days." })
      }
    }

    const filter = {
      userId,
      status: "Confirmed",
      deletedAt: null,
    }

    if (tourName) {
      filter.tourName = tourName
    }

    if (startDate && endDate) {
      const { start } = getDayBounds(startDate)
      const { end } = getDayBounds(endDate)
      filter.journeyDate = { $gte: start, $lte: end }
    } else if (startDate) {
      const { start } = getDayBounds(startDate)
      filter.journeyDate = { $gte: start }
    } else if (endDate) {
      const { end } = getDayBounds(endDate)
      filter.journeyDate = { $lte: end }
    }

    // Specific departure filter if supplied
    if (departureKey) {
      const parts = decodeURIComponent(departureKey).split("___")
      if (parts.length >= 3) {
        const depBus = parts[parts.length - 1]
        const depDate = parts[parts.length - 2]
        const depTour = parts.slice(0, parts.length - 2).join("___")
        const { start, end } = getDayBounds(depDate)
        filter.tourName = depTour
        filter.journeyDate = { $gte: start, $lte: end }
        Object.assign(filter, getBusCondition(depBus))
      }
    }

    const bookings = await Booking.find(filter)
      .sort({ journeyDate: 1, invoiceNo: 1 })
      .lean()

    let skippedBookingsLayout = 0
    let skippedBookingsNoSeat = 0

    // Group bookings into trips by departure key
    const tripsMap = new Map() // departureKey -> { trip, bookings }

    for (const b of bookings) {
      const layout = layoutKeyForBusType(b.busType || b.seatLayoutKey)
      if (layout !== SUPPORTED_LAYOUT) {
        skippedBookingsLayout++
        continue
      }

      const dateStr = toDateStr(b.journeyDate)
      const tripXid = `tbs:${b.tourName}___${dateStr}___${CANONICAL_BUS_TYPE}`
      const depKey = `${b.tourName}___${dateStr}`

      if (!tripsMap.has(depKey)) {
        tripsMap.set(depKey, {
          xid: tripXid,
          route: b.tourName,
          date: dateStr,
          time: "",
          bus: CANONICAL_BUS_TYPE,
          layout: SUPPORTED_LAYOUT,
          bookings: [],
        })
      }

      tripsMap.get(depKey).bookings.push(b)
    }

    // Load tours for fare lookup
    const uniqueTourNames = [...new Set(Array.from(tripsMap.values()).map((t) => t.route))]
    const tours = await Tour.find({ userId, name: { $in: uniqueTourNames } }).lean()
    const tourByName = new Map(tours.map((t) => [t.name, t]))

    // Load payments for all eligible bookings
    const eligibleBookingIds = []
    for (const tripData of tripsMap.values()) {
      for (const b of tripData.bookings) {
        eligibleBookingIds.push(b._id)
      }
    }

    const allPayments = await Payment.find({
      userId,
      bookingId: { $in: eligibleBookingIds },
      isVoid: false,
      type: { $ne: "refund" },
    }).lean()

    const paymentsByBookingId = new Map()
    for (const pm of allPayments) {
      const bKey = pm.bookingId.toString()
      if (!paymentsByBookingId.has(bKey)) {
        paymentsByBookingId.set(bKey, [])
      }
      paymentsByBookingId.get(bKey).push(pm)
    }

    let aadhaarDecryptedCount = 0
    const trips = []
    let totalExportedPassengers = 0

    for (const tripData of tripsMap.values()) {
      const matchingTour = tourByName.get(tripData.route)
      let fareLower = 0
      let fareUpper = 0
      if (matchingTour) {
        if (matchingTour.pricingType === "fixed" || (matchingTour.fixedPrice && !matchingTour.pricingType)) {
          fareLower = Number(matchingTour.fixedPrice) || 0
          fareUpper = Number(matchingTour.fixedPrice) || 0
        } else {
          fareLower = Number(matchingTour.lowerPrice) || 0
          fareUpper = Number(matchingTour.upperPrice) || 0
        }
      }

      const tripPassengers = []
      let bookingGroupOrdinal = 1

      for (const b of tripData.bookings) {
        const rawPax = b.passengers || []
        const hasMultiple = rawPax.length >= 2
        const currentGroup = hasMultiple ? bookingGroupOrdinal++ : null

        // Derive proportionate passenger fares
        const fares = derivePassengerFares(rawPax, matchingTour, b.totalAmount)
        const bookingPayments = paymentsByBookingId.get(b._id.toString()) || []

        // Sort payments chronologically
        bookingPayments.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate))

        // Allocate payments sequentially across passengers or via passengerSeatId
        const paxPayments = Array.from({ length: rawPax.length }, () => [])

        // 1. First assign payments with explicit passengerSeatId
        const remainingPayments = []
        for (const pm of bookingPayments) {
          if (pm.passengerSeatId) {
            const pIdx = rawPax.findIndex(
              (p) => resolveSeatId(SUPPORTED_LAYOUT, p.seatId) === pm.passengerSeatId
            )
            if (pIdx !== -1) {
              const xid = pm.referenceNo?.startsWith("sd:")
                ? pm.referenceNo
                : `tbs:${pm._id}`
              paxPayments[pIdx].push({
                xid,
                amount: pm.amount,
                mode: pm.paymentMode || "Cash",
                date: toDateStr(pm.paymentDate),
              })
              continue
            }
          }
          remainingPayments.push(pm)
        }

        // 2. Allocate remaining payments sequentially across passengers up to their fare
        let currentPaxIdx = 0
        let currentPaxRemainingFare = fares[0] || 0

        for (const pm of remainingPayments) {
          let paymentRemaining = pm.amount
          let fragmentIdx = 1

          while (paymentRemaining > 0 && currentPaxIdx < rawPax.length) {
            const take = Math.min(paymentRemaining, currentPaxRemainingFare)
            if (take > 0 || currentPaxIdx === rawPax.length - 1) {
              const actualTake = currentPaxIdx === rawPax.length - 1 ? paymentRemaining : take
              const xidBase = pm.referenceNo?.startsWith("sd:")
                ? pm.referenceNo
                : `tbs:${pm._id}`
              const xid = fragmentIdx === 1 && actualTake === pm.amount ? xidBase : `${xidBase}#${fragmentIdx++}`

              paxPayments[currentPaxIdx].push({
                xid,
                amount: round2(actualTake),
                mode: pm.paymentMode || "Cash",
                date: toDateStr(pm.paymentDate),
              })

              paymentRemaining = round2(paymentRemaining - actualTake)
              currentPaxRemainingFare = round2(currentPaxRemainingFare - actualTake)
            }

            if (currentPaxRemainingFare <= 0 && currentPaxIdx < rawPax.length - 1) {
              currentPaxIdx++
              currentPaxRemainingFare = fares[currentPaxIdx] || 0
            }
          }
        }

        // Build exported passenger records
        for (let i = 0; i < rawPax.length; i++) {
          const p = rawPax[i]
          const canonicalSeat = p.seatId ? resolveSeatId(SUPPORTED_LAYOUT, p.seatId) : ""
          if (!canonicalSeat) {
            skippedBookingsNoSeat++
            continue
          }

          let decryptedAadhaar = ""
          if (includeAadhaar && p.aadhar) {
            try {
              decryptedAadhaar = decryptAadhaar(p.aadhar)
              aadhaarDecryptedCount++
            } catch {
              decryptedAadhaar = ""
            }
          }

          let gender = "Male"
          const gRaw = String(p.gender || "").toLowerCase()
          if (gRaw === "female" || gRaw === "f") gender = "Female"
          else if (gRaw === "male" || gRaw === "m") gender = "Male"
          else gender = ""

          const paxRecord = {
            seat: canonicalSeat,
            name: p.name || "",
            age: p.age || null,
            gender,
            phone: normalizeIndianMobile(p.contact || b.contactPhone)?.normalized || "",
            city: p.city || "",
            pickup: p.pickupPoint || b.pickupPoint || "",
            note: "",
            fare: fares[i] || 0,
            group: currentGroup,
            invoiceNo: b.invoiceNo,
            payments: paxPayments[i] || [],
          }

          if (includeAadhaar && decryptedAadhaar) {
            paxRecord.aadhaar = decryptedAadhaar
          }

          tripPassengers.push(paxRecord)
          totalExportedPassengers++
        }
      }

      trips.push({
        xid: tripData.xid,
        route: tripData.route,
        date: tripData.date,
        time: tripData.time,
        bus: tripData.bus,
        layout: tripData.layout,
        fare: { lower: fareLower, upper: fareUpper },
        passengers: tripPassengers,
      })
    }

    if (includeAadhaar && aadhaarDecryptedCount > 0) {
      await logAudit(userId, "REVEAL_AADHAAR", {
        count: aadhaarDecryptedCount,
        action: "EXCHANGE_EXPORT",
      })
    }

    const file = {
      format: EXCHANGE_FORMAT,
      version: EXCHANGE_VERSION,
      source: "tbs",
      exportedAt: new Date().toISOString(),
      aadhaarIncluded: includeAadhaar,
      trips,
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private")
    res.setHeader("Pragma", "no-cache")

    res.json({
      file,
      meta: {
        trips: trips.length,
        passengers: totalExportedPassengers,
        skippedBookingsLayout,
        skippedBookingsNoSeat,
      },
    })
  } catch (err) {
    console.error("Exchange export error:", err.name)
    res.status(500).json({ message: "Failed to export passenger data." })
  }
})

export default router
